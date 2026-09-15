from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import DuplicateKeyError
import os
import re
import ipaddress
import logging
import secrets
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, field_validator, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timedelta, timezone
import bcrypt
import jwt
import httpx
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors as rl_colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)
from fastapi.responses import Response


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT
JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGO = "HS256"
JWT_TTL_DAYS = 30

# Emergent-managed email proxy (constant, do NOT read from env in code)
EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY", "")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "Leray-Pointel")
EMAIL_REPLY_TO = os.environ.get("EMAIL_REPLY_TO")
APP_PUBLIC_URL = os.environ.get("APP_PUBLIC_URL", "").rstrip("/")

RESET_TOKEN_TTL_HOURS = 2

app = FastAPI(title="Leray-Pointel B2B API")
api = APIRouter(prefix="/api")
bearer = HTTPBearer(auto_error=False)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("leray-pointel")


# ============================== EMAIL GUARDRAILS ==============================

_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan()
    scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} ≠ real link host {real!r} (G3)")


async def send_email(*, to: str, subject: str, html: str, reply_to: Optional[str] = None) -> Optional[str]:
    _assert_safe_email(subject, html)
    if not EMAIL_KEY:
        logger.warning("EMERGENT_EMAIL_KEY not configured — skipping email send")
        return None
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    if reply_to or EMAIL_REPLY_TO:
        payload["contact_email"] = reply_to or EMAIL_REPLY_TO
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{EMAIL_BASE_URL}/api/v1/email/send",
                headers={"X-Email-Key": EMAIL_KEY},
                json=payload,
            )
        resp.raise_for_status()
        return resp.json().get("id")
    except httpx.HTTPStatusError as e:
        logger.error(f"Email send failed: {e.response.status_code} {e.response.text}")
        raise HTTPException(status_code=502, detail="Envoi d'email impossible")
    except Exception as e:
        logger.error(f"Email send error: {e}")
        raise HTTPException(status_code=500, detail="Envoi d'email impossible")


# ============================== MODELS ==============================

class RegisterIn(BaseModel):
    company_name: str = Field(min_length=2, max_length=200)
    siret: str = Field(min_length=14, max_length=14, pattern=r"^\d{14}$")
    email: EmailStr
    phone: str = Field(min_length=6, max_length=30)
    delivery_address: str = Field(min_length=5, max_length=500)
    password: str = Field(min_length=6, max_length=128)

    @field_validator("email")
    @classmethod
    def norm_email(cls, v):
        return str(v).strip().lower()


class RegisterPersonalIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=200)
    email: EmailStr
    phone: str = Field(min_length=6, max_length=30)
    delivery_address: str = Field(min_length=5, max_length=500)
    password: str = Field(min_length=6, max_length=128)

    @field_validator("email")
    @classmethod
    def norm_email(cls, v):
        return str(v).strip().lower()


class LoginIn(BaseModel):
    email: EmailStr
    password: str

    @field_validator("email")
    @classmethod
    def norm_email(cls, v):
        return str(v).strip().lower()


class UserOut(BaseModel):
    id: str
    company_name: str
    siret: str
    email: EmailStr
    phone: str
    delivery_address: str
    role: str = "user"
    account_type: str = "business"  # "business" or "personal"
    status: str = "approved"  # "pending" | "approved" | "rejected"


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class Product(BaseModel):
    id: str
    name: str
    category: str
    subcategory: Optional[str] = None
    origin: str
    unit: str
    sell_unit: str = "piece"
    price: float
    price_kg: Optional[float] = None
    price_piece: Optional[float] = None
    price_kg_ttc: Optional[float] = None
    price_piece_ttc: Optional[float] = None
    cagette_content_pieces: Optional[int] = None
    cagette_content_kg: Optional[float] = None
    season: str = "all"  # "summer" | "winter" | "all"
    is_active: bool = True
    image_url: str
    description: str


class CartItem(BaseModel):
    product_id: str
    name: str
    unit: str
    sell_unit: str = "piece"
    price: float
    quantity: float


class OrderCreate(BaseModel):
    items: List[CartItem]
    notes: Optional[str] = ""


class Order(BaseModel):
    id: str
    user_id: str
    company_name: str
    account_type: str = "business"  # "business" | "personal"
    delivery_address: str
    items: List[CartItem]
    total: float
    status: str
    notes: str
    created_at: str


# ============================== HELPERS ==============================

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt(rounds=12)).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def make_token(user_id: str, token_version: int = 0) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "iat": now,
        "exp": now + timedelta(days=JWT_TTL_DAYS),
        "tv": token_version,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def user_public(doc: dict) -> dict:
    return {
        "id": doc["id"],
        "company_name": doc["company_name"],
        "siret": doc.get("siret", ""),
        "email": doc["email"],
        "phone": doc["phone"],
        "delivery_address": doc["delivery_address"],
        "role": doc.get("role", "user"),
        "account_type": doc.get("account_type", "business"),
        "status": doc.get("status", "approved"),
    }


async def current_user(cred: Optional[HTTPAuthorizationCredentials] = Depends(bearer)):
    if not cred or cred.scheme.lower() != "bearer":
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(cred.credentials, JWT_SECRET, algorithms=[JWT_ALGO])
        uid = payload["sub"]
        token_version = int(payload.get("tv", 0))
    except Exception:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": uid}, {"_id": 0})
    if not user:
        raise HTTPException(401, "User not found")
    # Session invalidation: token issued before latest password change is rejected
    if int(user.get("token_version", 0)) != token_version:
        raise HTTPException(401, "Session révoquée, veuillez vous reconnecter")
    return user


async def require_admin(user: dict = Depends(current_user)):
    if user.get("role") != "admin":
        raise HTTPException(403, "Réservé aux administrateurs")
    return user


# ============================== SEED PRODUCTS ==============================

SEED_PRODUCTS = [
    # Fruits — vendus au kg
    {"name": "Pommes Gala", "category": "Fruits", "origin": "France", "unit": "Cagette 5kg", "sell_unit": "kg", "price": 2.58,
     "image_url": "https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=600",
     "description": "Pommes Gala croquantes et sucrées, catégorie Extra."},
    {"name": "Bananes", "category": "Fruits", "origin": "Équateur", "unit": "Carton 18kg", "sell_unit": "kg", "price": 1.36,
     "image_url": "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=600",
     "description": "Bananes Cavendish mûrissage contrôlé."},
    {"name": "Oranges à jus", "category": "Fruits", "origin": "Espagne", "unit": "Sac 10kg", "sell_unit": "kg", "price": 1.50,
     "image_url": "https://images.unsplash.com/photo-1580052614034-c55d20bfee3b?w=600",
     "description": "Oranges juteuses idéales pour presser."},
    {"name": "Fraises Gariguette", "category": "Fruits", "origin": "France", "unit": "Barquette 500g", "sell_unit": "kg", "price": 8.00,
     "image_url": "https://images.unsplash.com/photo-1543528176-61b239494933?w=600",
     "description": "Fraises Gariguette parfumées, saison de printemps."},
    {"name": "Citrons jaunes", "category": "Fruits", "origin": "Italie", "unit": "Cagette 5kg", "sell_unit": "kg", "price": 2.84,
     "image_url": "https://images.unsplash.com/photo-1587496679742-bad5f8034b8f?w=600",
     "description": "Citrons de Sicile calibre moyen."},
    # Légumes — au kg sauf salade (pièce)
    {"name": "Tomates grappe", "category": "Légumes", "origin": "France", "unit": "Cagette 6kg", "sell_unit": "kg", "price": 3.15,
     "image_url": "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600",
     "description": "Tomates grappe rouges, mûres à point."},
    {"name": "Pommes de terre Charlotte", "category": "Légumes", "origin": "France", "unit": "Sac 25kg", "sell_unit": "kg", "price": 0.90,
     "image_url": "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=600",
     "description": "Charlotte à chair ferme, idéale pour vapeur et poêlée."},
    {"name": "Carottes", "category": "Légumes", "origin": "France", "unit": "Sac 10kg", "sell_unit": "kg", "price": 1.10,
     "image_url": "https://images.unsplash.com/photo-1445282768818-728615cc910a?w=600",
     "description": "Carottes lavées calibre 200/300g."},
    {"name": "Courgettes", "category": "Légumes", "origin": "Maroc", "unit": "Cagette 5kg", "sell_unit": "kg", "price": 2.76,
     "image_url": "https://images.unsplash.com/photo-1596566267081-c7cbe07850f6?w=600",
     "description": "Courgettes vertes fermes, calibre régulier."},
    {"name": "Poivrons rouges", "category": "Légumes", "origin": "Espagne", "unit": "Cagette 5kg", "sell_unit": "kg", "price": 3.30,
     "image_url": "https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=600",
     "description": "Poivrons rouges charnus."},
    {"name": "Salade batavia", "category": "Légumes", "origin": "France", "unit": "Pièce", "sell_unit": "piece", "price": 1.20,
     "image_url": "https://images.unsplash.com/photo-1622206151246-c47eb45f0263?w=600",
     "description": "Batavia française, croquante."},
    {"name": "Oignons jaunes", "category": "Légumes", "origin": "France", "unit": "Sac 10kg", "sell_unit": "kg", "price": 0.98,
     "image_url": "https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=600",
     "description": "Oignons jaunes à cuire."},
    # Herbes — à la pièce (botte)
    {"name": "Basilic frais", "category": "Herbes", "origin": "France", "unit": "Botte", "sell_unit": "piece", "price": 1.50,
     "image_url": "https://images.unsplash.com/photo-1618375569909-3c8616cf7733?w=600",
     "description": "Basilic frais parfumé, coupé du jour."},
    {"name": "Persil plat", "category": "Herbes", "origin": "France", "unit": "Botte", "sell_unit": "piece", "price": 1.00,
     "image_url": "https://images.unsplash.com/photo-1600231915711-cbc80c8d6a2b?w=600",
     "description": "Persil plat frais, aromatique."},
    {"name": "Coriandre fraîche", "category": "Herbes", "origin": "France", "unit": "Botte", "sell_unit": "piece", "price": 1.13,
     "image_url": "https://images.unsplash.com/photo-1611089547453-af23c98f1503?w=600",
     "description": "Coriandre fraîche pour cuisine du monde."},
]


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    # Drop the legacy unique index on siret so personal users can have empty siret
    try:
        await db.users.drop_index("siret_1")
    except Exception:
        pass
    # Recreate as unique only when siret is a non-empty regex match
    await db.users.create_index(
        "siret",
        unique=True,
        partialFilterExpression={"siret": {"$gt": ""}},
    )
    await db.users.create_index("id", unique=True)
    await db.products.create_index("id", unique=True)
    await db.orders.create_index("id", unique=True)
    await db.orders.create_index("user_id")
    # Password reset tokens: unique + auto-expire from expires_at
    await db.password_reset_tokens.create_index("token", unique=True)

    # Migrate existing users to have account_type + status
    await db.users.update_many(
        {"role": {"$ne": "admin"}, "account_type": {"$exists": False}},
        {"$set": {"account_type": "business", "status": "approved"}},
    )
    await db.users.update_many(
        {"role": "admin", "account_type": {"$exists": False}},
        {"$set": {"account_type": "business", "status": "approved"}},
    )

    # Seed products — only if DB is empty. Never destructively delete existing catalog.
    total = await db.products.count_documents({})
    if total == 0:
        docs = [{"id": str(uuid.uuid4()), **p} for p in SEED_PRODUCTS]
        await db.products.insert_many(docs)
        logger.info(f"Seeded {len(docs)} initial products")

    # Idempotent migration: fill missing legacy fields on any pre-existing product.
    await db.products.update_many(
        {"sell_unit": {"$exists": False}},
        {"$set": {"sell_unit": "piece"}},
    )
    async for p in db.products.find({"$or": [{"price_kg": {"$exists": False}}, {"price_piece": {"$exists": False}}]}):
        set_fields = {}
        if "price_kg" not in p:
            set_fields["price_kg"] = p["price"] if p.get("sell_unit") == "kg" else None
        if "price_piece" not in p:
            set_fields["price_piece"] = p["price"] if p.get("sell_unit") == "piece" else None
        if set_fields:
            await db.products.update_one({"id": p["id"]}, {"$set": set_fields})

    # Migrate: default season to "all" for legacy products
    await db.products.update_many(
        {"season": {"$exists": False}},
        {"$set": {"season": "all"}},
    )
    # Migrate: default TTC prices to None for legacy products
    await db.products.update_many(
        {"price_kg_ttc": {"$exists": False}},
        {"$set": {"price_kg_ttc": None}},
    )
    await db.products.update_many(
        {"price_piece_ttc": {"$exists": False}},
        {"$set": {"price_piece_ttc": None}},
    )
    # Cagette content migration (default None)
    await db.products.update_many(
        {"cagette_content_pieces": {"$exists": False}},
        {"$set": {"cagette_content_pieces": None}},
    )
    await db.products.update_many(
        {"cagette_content_kg": {"$exists": False}},
        {"$set": {"cagette_content_kg": None}},
    )
    # Subcategory migration (default None)
    await db.products.update_many(
        {"subcategory": {"$exists": False}},
        {"$set": {"subcategory": None}},
    )
    # is_active migration (default True — existing products stay online)
    await db.products.update_many(
        {"is_active": {"$exists": False}},
        {"$set": {"is_active": True}},
    )

    # Backfill account_type on legacy orders by joining with the user
    async for o in db.orders.find({"account_type": {"$exists": False}}, {"user_id": 1, "id": 1}):
        u = await db.users.find_one({"id": o.get("user_id")}, {"_id": 0, "account_type": 1})
        acc = (u or {}).get("account_type", "business")
        await db.orders.update_one({"id": o["id"]}, {"$set": {"account_type": acc}})

    # Backfill token_version to 0 for legacy users (never triggers a mass logout)
    await db.users.update_many(
        {"token_version": {"$exists": False}},
        {"$set": {"token_version": 0}},
    )

    # Seed default global season setting
    existing_season = await db.settings.find_one({"key": "current_season"})
    if not existing_season:
        await db.settings.insert_one({"key": "current_season", "value": "all"})

    # Seed default supplier (admin) account — only if not yet present.
    # Credentials come from env (ADMIN_EMAIL / ADMIN_PASSWORD) with safe defaults.
    admin_email = os.environ.get("ADMIN_EMAIL", "sarl.leraypointel@orange.fr").strip().lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "")
    admin = await db.users.find_one({"email": admin_email})
    if not admin:
        # Only auto-create when a password is provided. In production, the admin
        # is expected to be provisioned once and then manage credentials in-app.
        if admin_password:
            try:
                await db.users.insert_one({
                    "id": str(uuid.uuid4()),
                    "company_name": os.environ.get("ADMIN_COMPANY_NAME", "SARL Leray-Pointel"),
                    "siret": "00000000000000",
                    "email": admin_email,
                    "phone": "+33100000000",
                    "delivery_address": os.environ.get("ADMIN_ADDRESS", "Siège Leray-Pointel"),
                    "password_hash": hash_password(admin_password),
                    "role": "admin",
                    "account_type": "business",
                    "status": "approved",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                })
                logger.info(f"Seeded supplier account {admin_email}")
            except DuplicateKeyError:
                pass
        else:
            logger.warning(
                "No admin account found and ADMIN_PASSWORD env var is not set — "
                "skipping admin seeding. Set ADMIN_EMAIL/ADMIN_PASSWORD to bootstrap."
            )


@app.on_event("shutdown")
async def shutdown():
    client.close()


# ============================== ROUTES ==============================

@api.get("/")
async def root():
    return {"ok": True, "app": "Leray-Pointel B2B"}


@api.post("/auth/register", response_model=TokenOut, status_code=201)
async def register(body: RegisterIn):
    user_id = str(uuid.uuid4())
    doc = {
        "id": user_id,
        "company_name": body.company_name.strip(),
        "siret": body.siret.strip(),
        "email": body.email,
        "phone": body.phone.strip(),
        "delivery_address": body.delivery_address.strip(),
        "password_hash": hash_password(body.password),
        "role": "user",
        "account_type": "business",
        "status": "pending",  # awaits supplier approval
        "token_version": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        await db.users.insert_one(doc)
    except DuplicateKeyError:
        # Neutral 202 response prevents email/SIRET enumeration
        return JSONResponse(
            status_code=202,
            content={"access_token": None, "token_type": "bearer", "user": None},
        )
    return {"access_token": make_token(user_id, 0), "token_type": "bearer", "user": user_public(doc)}


@api.post("/auth/register-personal", response_model=TokenOut, status_code=201)
async def register_personal(body: RegisterPersonalIn):
    user_id = str(uuid.uuid4())
    doc = {
        "id": user_id,
        "company_name": body.full_name.strip(),
        "siret": "",
        "email": body.email,
        "phone": body.phone.strip(),
        "delivery_address": body.delivery_address.strip(),
        "password_hash": hash_password(body.password),
        "role": "user",
        "account_type": "personal",
        "status": "approved",  # no approval needed for personal buyers
        "token_version": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        await db.users.insert_one(doc)
    except DuplicateKeyError:
        # Neutral 202 response prevents email enumeration
        return JSONResponse(
            status_code=202,
            content={"access_token": None, "token_type": "bearer", "user": None},
        )
    return {"access_token": make_token(user_id, 0), "token_type": "bearer", "user": user_public(doc)}


@api.post("/auth/login", response_model=TokenOut)
async def login(body: LoginIn):
    doc = await db.users.find_one({"email": body.email}, {"_id": 0})
    if not doc or not verify_password(body.password, doc["password_hash"]):
        raise HTTPException(401, "Email ou mot de passe incorrect")
    if doc.get("status") == "rejected":
        raise HTTPException(403, "Votre accès a été retiré. Contactez Leray-Pointel.")
    return {
        "access_token": make_token(doc["id"], int(doc.get("token_version", 0))),
        "token_type": "bearer",
        "user": user_public(doc),
    }


@api.get("/auth/me", response_model=UserOut)
async def me(user: dict = Depends(current_user)):
    return user_public(user)


@api.delete("/auth/me", status_code=204)
async def delete_me(user: dict = Depends(current_user)):
    """Authenticated account deletion. Admin accounts cannot be deleted this way."""
    if user.get("role") == "admin":
        raise HTTPException(403, "Le compte administrateur ne peut pas être supprimé depuis l'application.")
    # Anonymize past orders so history stays valid but personal info is wiped.
    await db.orders.update_many(
        {"user_id": user["id"]},
        {"$set": {"company_name": "Compte supprimé", "delivery_address": "—"}},
    )
    await db.users.delete_one({"id": user["id"]})
    return None


# ---- Password reset (email-based, automatic) ----

class ForgotIn(BaseModel):
    email: EmailStr

    @field_validator("email")
    @classmethod
    def norm_email(cls, v):
        return str(v).strip().lower()


class ResetWithTokenIn(BaseModel):
    token: str = Field(min_length=16, max_length=128)
    password: str = Field(min_length=6, max_length=128)


def _reset_link(token: str) -> str:
    base = APP_PUBLIC_URL or ""
    # Build the deep-link URL that opens the reset screen (Expo Router web + native)
    return f"{base}/reset-password?token={token}" if base else ""


def _reset_email_html(company_name: str, link: str) -> str:
    safe_name = escape(company_name or "cher client")
    safe_link = escape(link)
    return (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        'style="background-color:#F3F4F6;padding:24px 0;font-family:Arial,Helvetica,sans-serif">'
        '<tr><td align="center">'
        '<table role="presentation" width="560" cellpadding="0" cellspacing="0" '
        'style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden">'
        '<tr><td style="background:#194B32;padding:24px 28px;color:#ffffff">'
        '<div style="font-size:12px;letter-spacing:2px;font-weight:700;opacity:0.85">LERAY-POINTEL</div>'
        '<div style="font-size:22px;font-weight:800;margin-top:6px">Réinitialisation du mot de passe</div>'
        '</td></tr>'
        f'<tr><td style="padding:28px;color:#111827;font-size:15px;line-height:22px">'
        f'<p style="margin:0 0 14px 0">Bonjour {safe_name},</p>'
        '<p style="margin:0 0 14px 0">Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous pour en choisir un nouveau. Le lien est valable 2 heures.</p>'
        '<p style="margin:24px 0" align="center">'
        f'<a href="{safe_link}" style="display:inline-block;background:#194B32;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:10px;font-weight:700;font-size:15px">Choisir un nouveau mot de passe</a>'
        '</p>'
        '<p style="margin:0 0 14px 0;color:#6B7280;font-size:13px">Si vous n\'êtes pas à l\'origine de cette demande, vous pouvez ignorer ce message : votre mot de passe restera inchangé.</p>'
        '</td></tr>'
        '<tr><td style="padding:16px 28px;background:#F9FAFB;color:#6B7280;font-size:11px;line-height:16px">'
        f'Email envoyé par {escape(EMAIL_FROM_NAME)}. Nous ne vous demanderons jamais votre mot de passe par email.'
        '</td></tr>'
        '</table></td></tr></table>'
    )


@api.post("/auth/forgot-password", status_code=202)
async def forgot_password(body: ForgotIn):
    """Send a password-reset email if the account exists. Always returns 202 to
    prevent email enumeration attacks."""
    user = await db.users.find_one(
        {"email": body.email},
        {"_id": 0, "id": 1, "role": 1, "company_name": 1, "email": 1},
    )
    if user and user.get("role") != "admin":
        # Invalidate any previous unused tokens for this user
        await db.password_reset_tokens.update_many(
            {"user_id": user["id"], "used": False},
            {"$set": {"used": True, "invalidated_at": datetime.now(timezone.utc).isoformat()}},
        )
        token = secrets.token_urlsafe(32)
        now = datetime.now(timezone.utc)
        await db.password_reset_tokens.insert_one({
            "token": token,
            "user_id": user["id"],
            "email": user["email"],
            "created_at": now.isoformat(),
            "expires_at": (now + timedelta(hours=RESET_TOKEN_TTL_HOURS)).isoformat(),
            "used": False,
        })
        link = _reset_link(token)
        if link:
            try:
                await send_email(
                    to=user["email"],
                    subject="Réinitialisation de votre mot de passe Leray-Pointel",
                    html=_reset_email_html(user.get("company_name", ""), link),
                )
            except HTTPException as e:
                logger.error(f"Reset email send failed: {e.detail}")
                # Swallow to avoid revealing send failures to the caller
    return {"ok": True}


@api.post("/auth/reset-password")
async def reset_password(body: ResetWithTokenIn):
    """Consume a reset token and set a new password."""
    doc = await db.password_reset_tokens.find_one({"token": body.token, "used": False}, {"_id": 0})
    if not doc:
        raise HTTPException(400, "Lien invalide ou déjà utilisé")
    try:
        expires_at = datetime.fromisoformat(doc["expires_at"])
    except Exception:
        expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(400, "Lien expiré, refaites une demande")
    user = await db.users.find_one({"id": doc["user_id"]}, {"_id": 0})
    if not user or user.get("role") == "admin":
        raise HTTPException(400, "Lien invalide")
    await db.users.update_one(
        {"id": doc["user_id"]},
        {"$set": {"password_hash": hash_password(body.password)}, "$inc": {"token_version": 1}},
    )
    await db.password_reset_tokens.update_one(
        {"token": body.token},
        {"$set": {"used": True, "used_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"ok": True}


@api.get("/products", response_model=List[Product])
async def list_products(category: Optional[str] = None, subcategory: Optional[str] = None):
    q = {"is_active": {"$ne": False}}  # hide products explicitly disabled by the admin
    if category and category.lower() != "tous":
        q["category"] = category
    if subcategory:
        q["subcategory"] = subcategory
    # Filter by current season: always keep "all" + current active season
    current = await _get_current_season()
    if current != "all":
        q["season"] = {"$in": ["all", current]}
    docs = await db.products.find(q, {"_id": 0}).to_list(500)
    return docs


async def _get_current_season() -> str:
    doc = await db.settings.find_one({"key": "current_season"}, {"_id": 0})
    return (doc or {}).get("value", "all")


@api.get("/products/subcategories")
async def subcategories(category: Optional[str] = None):
    """Return { category: [subcategories...] } grouped, ordered alphabetically."""
    match = {"subcategory": {"$ne": None}, "is_active": {"$ne": False}}
    if category and category.lower() != "tous":
        match["category"] = category
    pipeline = [
        {"$match": match},
        {"$group": {"_id": {"category": "$category", "subcategory": "$subcategory"}}},
        {"$sort": {"_id.subcategory": 1}},
    ]
    out: dict[str, list[str]] = {}
    async for row in db.products.aggregate(pipeline):
        cat = row["_id"]["category"]
        sub = row["_id"]["subcategory"]
        if sub:
            out.setdefault(cat, []).append(sub)
    return {"by_category": out}


@api.get("/products/categories")
async def categories():
    cats = await db.products.distinct("category")
    return {"categories": ["Tous"] + sorted(cats)}


@api.get("/products/{product_id}", response_model=Product)
async def get_product(product_id: str):
    doc = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Produit introuvable")
    return doc


@api.post("/orders", response_model=Order, status_code=201)
async def create_order(body: OrderCreate, user: dict = Depends(current_user)):
    if user.get("status", "approved") != "approved":
        raise HTTPException(403, "Votre compte est en attente de validation par Leray-Pointel")
    if not body.items:
        raise HTTPException(400, "Panier vide")
    total = round(sum(i.price * i.quantity for i in body.items), 2)
    order_id = str(uuid.uuid4())
    doc = {
        "id": order_id,
        "user_id": user["id"],
        "company_name": user["company_name"],
        "account_type": user.get("account_type", "business"),
        "delivery_address": user["delivery_address"],
        "items": [i.model_dump() for i in body.items],
        "total": total,
        "status": "En attente",
        "notes": body.notes or "",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.orders.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.get("/orders", response_model=List[Order])
async def list_orders(user: dict = Depends(current_user)):
    docs = await db.orders.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return docs


@api.get("/orders/habits", response_model=List[Product])
async def order_habits(user: dict = Depends(current_user), limit: int = 8):
    """Return the user's most frequently ordered products, honoring the current season filter."""
    orders = await db.orders.find({"user_id": user["id"]}, {"_id": 0, "items": 1}).to_list(500)
    # Score: appearances across orders (primary) + total quantity (tiebreaker)
    freq: dict[str, dict] = {}
    for o in orders:
        seen_in_order = set()
        for it in o.get("items", []):
            pid = it.get("product_id")
            if not pid:
                continue
            entry = freq.setdefault(pid, {"orders": 0, "qty": 0.0})
            if pid not in seen_in_order:
                entry["orders"] += 1
                seen_in_order.add(pid)
            entry["qty"] += float(it.get("quantity", 0) or 0)
    if not freq:
        return []
    ranked_ids = sorted(freq.keys(), key=lambda p: (freq[p]["orders"], freq[p]["qty"]), reverse=True)
    # Filter by current season and hide deactivated products
    current = await _get_current_season()
    q = {"id": {"$in": ranked_ids}, "is_active": {"$ne": False}}
    if current != "all":
        q["season"] = {"$in": ["all", current]}
    docs = await db.products.find(q, {"_id": 0}).to_list(200)
    by_id = {d["id"]: d for d in docs}
    ordered = [by_id[pid] for pid in ranked_ids if pid in by_id]
    return ordered[:limit]


@api.get("/orders/{order_id}/invoice-pdf")
async def customer_invoice_pdf(order_id: str, user: dict = Depends(current_user)):
    doc = await db.orders.find_one({"id": order_id, "user_id": user["id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Commande introuvable")
    return _pdf_response(doc)


# ============================== ADMIN ROUTES ==============================

ALLOWED_STATUSES = ["En attente", "Validée", "En préparation", "Livrée", "Annulée"]


class ProductIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    category: str = Field(min_length=1, max_length=100)
    subcategory: Optional[str] = Field(default=None, max_length=100)
    origin: str = Field(min_length=1, max_length=100)
    unit: str = Field(min_length=1, max_length=100)
    price_kg: Optional[float] = Field(default=None, gt=0)
    price_piece: Optional[float] = Field(default=None, gt=0)
    price_kg_ttc: Optional[float] = Field(default=None, gt=0)
    price_piece_ttc: Optional[float] = Field(default=None, gt=0)
    cagette_content_pieces: Optional[int] = Field(default=None, gt=0)
    cagette_content_kg: Optional[float] = Field(default=None, gt=0)
    season: str = Field(default="all")
    image_url: str = Field(min_length=1, max_length=5_000_000)
    description: str = Field(default="", max_length=1000)

    @field_validator("season")
    @classmethod
    def check_season(cls, v):
        if v not in ("summer", "winter", "all"):
            raise ValueError("season doit être 'summer', 'winter' ou 'all'")
        return v

    @field_validator("price_kg", "price_piece", "price_kg_ttc", "price_piece_ttc", "cagette_content_kg")
    @classmethod
    def norm_prices(cls, v):
        return None if v in (0, 0.0) else v

    @field_validator("cagette_content_pieces")
    @classmethod
    def norm_pieces(cls, v):
        return None if v in (0,) else v

    @field_validator("subcategory")
    @classmethod
    def norm_subcategory(cls, v):
        if v is None:
            return None
        v = v.strip()
        return v or None

    def resolved(self) -> dict:
        if self.price_kg is None and self.price_piece is None:
            raise HTTPException(422, "Au moins un prix HT (au kilo ou à la pièce) est requis")
        # Cagette must reference an actual base price it can compute from
        if self.cagette_content_pieces is not None and self.price_piece is None:
            raise HTTPException(422, "Prix à la pièce requis pour vendre en cagette (nombre de pièces)")
        if self.cagette_content_kg is not None and self.price_kg is None:
            raise HTTPException(422, "Prix au kilo requis pour vendre en cagette (poids)")
        if self.cagette_content_pieces is not None and self.cagette_content_kg is not None:
            raise HTTPException(422, "La cagette doit être définie en pièces OU en kg, pas les deux")
        sell_unit = "kg" if self.price_kg is not None else "piece"
        price = self.price_kg if sell_unit == "kg" else self.price_piece
        return {
            "name": self.name.strip(),
            "category": self.category.strip(),
            "subcategory": self.subcategory,
            "origin": self.origin.strip(),
            "unit": self.unit.strip(),
            "sell_unit": sell_unit,
            "price": price,
            "price_kg": self.price_kg,
            "price_piece": self.price_piece,
            "price_kg_ttc": self.price_kg_ttc,
            "price_piece_ttc": self.price_piece_ttc,
            "cagette_content_pieces": self.cagette_content_pieces,
            "cagette_content_kg": self.cagette_content_kg,
            "season": self.season,
            "image_url": self.image_url.strip(),
            "description": self.description or "",
        }


class StatusUpdate(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def check_status(cls, v):
        if v not in ALLOWED_STATUSES:
            raise ValueError(f"Statut invalide. Autorisés: {', '.join(ALLOWED_STATUSES)}")
        return v


@api.get("/admin/statuses")
async def admin_statuses(_: dict = Depends(require_admin)):
    return {"statuses": ALLOWED_STATUSES}


@api.post("/admin/products", response_model=Product, status_code=201)
async def admin_create_product(body: ProductIn, _: dict = Depends(require_admin)):
    doc = {"id": str(uuid.uuid4()), **body.resolved(), "is_active": True}
    await db.products.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.get("/admin/products", response_model=List[Product])
async def admin_list_products(_: dict = Depends(require_admin)):
    """Admin view returns EVERY product, including deactivated ones."""
    docs = await db.products.find({}, {"_id": 0}).sort("name", 1).to_list(2000)
    # Ensure the is_active field is present in the response (safety for legacy docs)
    for d in docs:
        d.setdefault("is_active", True)
    return docs


class ProductActiveIn(BaseModel):
    is_active: bool


@api.patch("/admin/products/{product_id}/active", response_model=Product)
async def admin_toggle_product_active(product_id: str, body: ProductActiveIn, _: dict = Depends(require_admin)):
    updated = await db.products.find_one_and_update(
        {"id": product_id},
        {"$set": {"is_active": bool(body.is_active)}},
        projection={"_id": 0},
        return_document=True,
    )
    if not updated:
        raise HTTPException(404, "Produit introuvable")
    updated.setdefault("is_active", True)
    return updated


@api.put("/admin/products/{product_id}", response_model=Product)
async def admin_update_product(product_id: str, body: ProductIn, _: dict = Depends(require_admin)):
    # Preserve is_active across ProductIn updates (the form does not carry it)
    existing = await db.products.find_one({"id": product_id}, {"_id": 0, "is_active": 1})
    if not existing:
        raise HTTPException(404, "Produit introuvable")
    payload = body.resolved()
    payload["is_active"] = existing.get("is_active", True)
    updated = await db.products.find_one_and_update(
        {"id": product_id},
        {"$set": payload},
        projection={"_id": 0},
        return_document=True,
    )
    return updated


@api.delete("/admin/products/{product_id}", status_code=204)
async def admin_delete_product(product_id: str, _: dict = Depends(require_admin)):
    res = await db.products.delete_one({"id": product_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Produit introuvable")
    return None


@api.get("/admin/orders/export")
async def admin_export_all(_: dict = Depends(require_admin)):
    docs = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(5000)
    lines = ["Numéro,Date,Client,SIRET livraison,Statut,Nb articles,Total HT"]
    for o in docs:
        lines.append(",".join([
            _csv_escape("#" + o["id"][:8].upper()),
            _csv_escape(o["created_at"]),
            _csv_escape(o["company_name"]),
            _csv_escape(o["delivery_address"]),
            _csv_escape(o["status"]),
            _csv_escape(sum(i["quantity"] for i in o["items"])),
            _csv_escape(f"{o['total']:.2f}"),
        ]))
    return {"filename": "commandes-export.csv", "content": "\n".join(lines), "count": len(docs)}


@api.get("/admin/orders", response_model=List[Order])
async def admin_list_orders(account_type: Optional[str] = None, _: dict = Depends(require_admin)):
    q = {}
    if account_type in ("business", "personal"):
        q["account_type"] = account_type
    docs = await db.orders.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return docs


@api.get("/admin/orders-latest")
async def admin_latest_order(_: dict = Depends(require_admin)):
    """Lightweight endpoint used for polling: returns the most recent order's created_at
    plus counts, so the admin app can compare with the last-seen marker to display a
    red badge and trigger a sound alert."""
    latest = await db.orders.find_one({}, {"_id": 0, "created_at": 1}, sort=[("created_at", -1)])
    total = await db.orders.count_documents({})
    return {
        "latest_created_at": (latest or {}).get("created_at"),
        "total": total,
    }


@api.get("/admin/orders/{order_id}", response_model=Order)
async def admin_get_order(order_id: str, _: dict = Depends(require_admin)):
    doc = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Commande introuvable")
    return doc


@api.patch("/admin/orders/{order_id}", response_model=Order)
async def admin_update_status(order_id: str, body: StatusUpdate, _: dict = Depends(require_admin)):
    updated = await db.orders.find_one_and_update(
        {"id": order_id},
        {"$set": {"status": body.status}},
        projection={"_id": 0},
        return_document=True,
    )
    if not updated:
        raise HTTPException(404, "Commande introuvable")
    return updated


def _csv_escape(v) -> str:
    s = "" if v is None else str(v)
    if any(ch in s for ch in [",", "\"", "\n", "\r"]):
        s = '"' + s.replace('"', '""') + '"'
    return s


def _generate_invoice_pdf(order: dict) -> bytes:
    """Render a printable A4 invoice PDF for a given order document."""
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title=f"Facture {order['id'][:8].upper()}",
    )
    brand = rl_colors.HexColor("#194B32")
    muted = rl_colors.HexColor("#6B7280")
    surface = rl_colors.HexColor("#F3F4F6")

    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=styles["Heading1"], fontSize=20, textColor=brand, spaceAfter=2)
    small = ParagraphStyle("small", parent=styles["Normal"], fontSize=8, textColor=muted)
    normal = ParagraphStyle("normal", parent=styles["Normal"], fontSize=10)
    strong = ParagraphStyle("strong", parent=styles["Normal"], fontSize=10, textColor=brand, spaceAfter=2)
    label = ParagraphStyle("label", parent=styles["Normal"], fontSize=8, textColor=muted, spaceAfter=2)

    story = []

    # ---------- Header (brand + invoice meta) ----------
    header_data = [
        [
            Paragraph("<b>LERAY-POINTEL</b>", h1),
            Paragraph("<b>FACTURE</b>", ParagraphStyle(
                "invTitle", parent=h1, alignment=2, fontSize=18
            )),
        ],
        [
            Paragraph("Fruits &amp; légumes frais — vente en gros", small),
            Paragraph(
                f"N° {order['id'][:8].upper()}<br/>"
                f"Date : {order['created_at'][:10]}",
                ParagraphStyle("meta", parent=small, alignment=2, fontSize=9),
            ),
        ],
    ]
    header_table = Table(header_data, colWidths=[95 * mm, 75 * mm])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 10 * mm))

    # ---------- Parties (supplier + client) ----------
    supplier_html = (
        "<b>SARL Leray-Pointel</b><br/>"
        "Siège Leray-Pointel<br/>"
        "France<br/>"
        "sarl.leraypointel@orange.fr"
    )
    client_html = (
        f"<b>{escape(order['company_name'])}</b><br/>"
        f"{escape(order['delivery_address'])}"
    )
    parties = Table(
        [
            [Paragraph("ÉMETTEUR", label), Paragraph("CLIENT", label)],
            [Paragraph(supplier_html, normal), Paragraph(client_html, normal)],
        ],
        colWidths=[85 * mm, 85 * mm],
    )
    parties.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), surface),
        ("BOX", (0, 0), (-1, -1), 0.5, rl_colors.HexColor("#E5E7EB")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, rl_colors.HexColor("#E5E7EB")),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(parties)
    story.append(Spacer(1, 8 * mm))

    # ---------- Status ----------
    story.append(Paragraph(f"<b>Statut :</b> {escape(order['status'])}", normal))
    story.append(Spacer(1, 4 * mm))

    # ---------- Products table ----------
    items_data = [["Produit", "Format", "Qté", "PU HT (€)", "Total HT (€)"]]
    for it in order["items"]:
        sell_unit = it.get("sell_unit", "piece")
        unit_label = "kg" if sell_unit == "kg" else "cag." if sell_unit == "cagette" else "pce"
        # Format quantity: integer without trailing .0, else 2 decimals
        q = it["quantity"]
        q_str = f"{q:.2f}".rstrip("0").rstrip(".") if isinstance(q, float) else str(q)
        items_data.append([
            escape(it["name"]),
            escape(it["unit"]),
            f"{q_str} {unit_label}",
            f"{it['price']:.2f}/{unit_label}",
            f"{it['price'] * q:.2f}",
        ])
    items_table = Table(items_data, colWidths=[55 * mm, 35 * mm, 25 * mm, 25 * mm, 30 * mm])
    items_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), brand),
        ("TEXTCOLOR", (0, 0), (-1, 0), rl_colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
        ("ALIGN", (0, 0), (1, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [rl_colors.white, surface]),
        ("GRID", (0, 0), (-1, -1), 0.4, rl_colors.HexColor("#E5E7EB")),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(items_table)
    story.append(Spacer(1, 6 * mm))

    # ---------- Totals ----------
    totals_table = Table(
        [
            ["Total HT", f"{order['total']:.2f} €"],
        ],
        colWidths=[145 * mm, 25 * mm],
    )
    totals_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 12),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
        ("TEXTCOLOR", (1, 0), (1, -1), brand),
        ("ALIGN", (0, 0), (0, -1), "RIGHT"),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("LINEABOVE", (0, 0), (-1, 0), 1, brand),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(totals_table)

    if order.get("notes"):
        story.append(Spacer(1, 6 * mm))
        story.append(Paragraph("<b>Note du client</b>", strong))
        story.append(Paragraph(escape(order["notes"]).replace("\n", "<br/>"), normal))

    story.append(Spacer(1, 10 * mm))
    story.append(Paragraph(
        "Paiement hors application — facturation. Merci de votre confiance.",
        small,
    ))

    doc.build(story)
    return buf.getvalue()


def _pdf_response(order: dict) -> Response:
    pdf = _generate_invoice_pdf(order)
    filename = f"facture-{order['id'][:8]}.pdf"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@api.get("/admin/orders/{order_id}/invoice")
async def admin_invoice(order_id: str, _: dict = Depends(require_admin)):
    o = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Commande introuvable")
    return _pdf_response(o)


# ---- Pending business accounts ----

@api.get("/admin/pending", response_model=List[UserOut])
async def admin_list_pending(_: dict = Depends(require_admin)):
    docs = await db.users.find(
        {"account_type": "business", "status": "pending"}, {"_id": 0, "password_hash": 0}
    ).sort("created_at", -1).to_list(500)
    return [user_public(d) for d in docs]


@api.post("/admin/pending/{user_id}/approve", response_model=UserOut)
async def admin_approve(user_id: str, _: dict = Depends(require_admin)):
    doc = await db.users.find_one_and_update(
        {"id": user_id, "account_type": "business"},
        {"$set": {"status": "approved"}},
        projection={"_id": 0},
        return_document=True,
    )
    if not doc:
        raise HTTPException(404, "Compte introuvable")
    return user_public(doc)


@api.post("/admin/pending/{user_id}/reject", response_model=UserOut)
async def admin_reject(user_id: str, _: dict = Depends(require_admin)):
    doc = await db.users.find_one_and_update(
        {"id": user_id, "account_type": "business"},
        {"$set": {"status": "rejected"}},
        projection={"_id": 0},
        return_document=True,
    )
    if not doc:
        raise HTTPException(404, "Compte introuvable")
    return user_public(doc)


# ---- Business clients (Pros) management ----

class BusinessUserOut(UserOut):
    created_at: Optional[str] = None


@api.get("/admin/users", response_model=List[BusinessUserOut])
async def admin_list_business_users(_: dict = Depends(require_admin)):
    """List every professional (business) client account with their meta."""
    docs = await db.users.find(
        {"account_type": "business", "role": {"$ne": "admin"}},
        {"_id": 0, "password_hash": 0},
    ).sort("created_at", -1).to_list(2000)
    out = []
    for d in docs:
        base = user_public(d)
        base["created_at"] = d.get("created_at")
        out.append(base)
    return out


@api.post("/admin/users/{user_id}/revoke", response_model=UserOut)
async def admin_revoke_user(user_id: str, _: dict = Depends(require_admin)):
    """Revoke a pro account access without deleting it (kept for order history)."""
    doc = await db.users.find_one_and_update(
        {"id": user_id, "role": {"$ne": "admin"}},
        {"$set": {"status": "rejected"}},
        projection={"_id": 0},
        return_document=True,
    )
    if not doc:
        raise HTTPException(404, "Compte introuvable")
    return user_public(doc)


@api.post("/admin/users/{user_id}/restore", response_model=UserOut)
async def admin_restore_user(user_id: str, _: dict = Depends(require_admin)):
    """Restore access previously revoked."""
    doc = await db.users.find_one_and_update(
        {"id": user_id, "role": {"$ne": "admin"}},
        {"$set": {"status": "approved"}},
        projection={"_id": 0},
        return_document=True,
    )
    if not doc:
        raise HTTPException(404, "Compte introuvable")
    return user_public(doc)


@api.delete("/admin/users/{user_id}", status_code=204)
async def admin_delete_user(user_id: str, _: dict = Depends(require_admin)):
    """Delete a pro account. Their past orders are anonymized (kept for the archives)."""
    target = await db.users.find_one({"id": user_id, "role": {"$ne": "admin"}})
    if not target:
        raise HTTPException(404, "Compte introuvable")
    await db.orders.update_many(
        {"user_id": user_id},
        {"$set": {"company_name": "Compte supprimé", "delivery_address": "—"}},
    )
    await db.users.delete_one({"id": user_id})
    return None


# ---- Global settings (season) ----

class SeasonIn(BaseModel):
    season: str

    @field_validator("season")
    @classmethod
    def check_season(cls, v):
        if v not in ("summer", "winter", "all"):
            raise ValueError("season doit être 'summer', 'winter' ou 'all'")
        return v


@api.get("/settings/season")
async def get_current_season():
    return {"season": await _get_current_season()}


@api.put("/admin/settings/season")
async def set_current_season(body: SeasonIn, _: dict = Depends(require_admin)):
    await db.settings.update_one(
        {"key": "current_season"},
        {"$set": {"key": "current_season", "value": body.season}},
        upsert=True,
    )
    return {"season": body.season}


# ---- Banner ----

class BannerIn(BaseModel):
    image_url: str = Field(min_length=1, max_length=5_000_000)


@api.get("/banner")
async def get_banner():
    doc = await db.settings.find_one({"key": "banner"}, {"_id": 0})
    return {"image_url": doc.get("image_url") if doc else None}


@api.put("/admin/banner")
async def set_banner(body: BannerIn, _: dict = Depends(require_admin)):
    await db.settings.update_one(
        {"key": "banner"},
        {"$set": {"key": "banner", "image_url": body.image_url}},
        upsert=True,
    )
    return {"image_url": body.image_url}


@api.delete("/admin/banner", status_code=204)
async def delete_banner(_: dict = Depends(require_admin)):
    await db.settings.delete_one({"key": "banner"})
    return None


# ---- Login cover image ----

class ImageIn(BaseModel):
    image_url: str = Field(min_length=1, max_length=5_000_000)


@api.get("/login-cover")
async def get_login_cover():
    doc = await db.settings.find_one({"key": "login_cover"}, {"_id": 0})
    return {"image_url": doc.get("image_url") if doc else None}


@api.put("/admin/login-cover")
async def set_login_cover(body: ImageIn, _: dict = Depends(require_admin)):
    await db.settings.update_one(
        {"key": "login_cover"},
        {"$set": {"key": "login_cover", "image_url": body.image_url}},
        upsert=True,
    )
    return {"image_url": body.image_url}


@api.delete("/admin/login-cover", status_code=204)
async def delete_login_cover(_: dict = Depends(require_admin)):
    await db.settings.delete_one({"key": "login_cover"})
    return None


# ---- Catalog watermark ----

@api.get("/watermark")
async def get_watermark():
    doc = await db.settings.find_one({"key": "watermark"}, {"_id": 0})
    return {"image_url": doc.get("image_url") if doc else None}


@api.put("/admin/watermark")
async def set_watermark(body: ImageIn, _: dict = Depends(require_admin)):
    await db.settings.update_one(
        {"key": "watermark"},
        {"$set": {"key": "watermark", "image_url": body.image_url}},
        upsert=True,
    )
    return {"image_url": body.image_url}


@api.delete("/admin/watermark", status_code=204)
async def delete_watermark(_: dict = Depends(require_admin)):
    await db.settings.delete_one({"key": "watermark"})
    return None


# ---- Our Story page (about) ----

DEFAULT_STORY = {
    "title": "Notre histoire",
    "body": (
        "Depuis plusieurs générations, la SARL Leray-Pointel sélectionne chaque jour "
        "les meilleurs fruits et légumes pour les professionnels de la restauration et "
        "les particuliers de la région. Une équipe passionnée, des producteurs de "
        "confiance et une exigence de fraîcheur qui ne se négocie pas."
    ),
    "images": [],
}


class StoryIn(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    body: str = Field(min_length=1, max_length=8000)
    images: List[str] = Field(default_factory=list, max_length=4)


@api.get("/our-story")
async def get_our_story():
    doc = await db.settings.find_one({"key": "our_story"}, {"_id": 0})
    if not doc:
        return DEFAULT_STORY
    return {
        "title": doc.get("title") or DEFAULT_STORY["title"],
        "body": doc.get("body") or DEFAULT_STORY["body"],
        "images": doc.get("images") or [],
    }


@api.put("/admin/our-story")
async def set_our_story(body: StoryIn, _: dict = Depends(require_admin)):
    await db.settings.update_one(
        {"key": "our_story"},
        {"$set": {
            "key": "our_story",
            "title": body.title.strip(),
            "body": body.body.strip(),
            "images": body.images,
        }},
        upsert=True,
    )
    return {"title": body.title, "body": body.body, "images": body.images}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
