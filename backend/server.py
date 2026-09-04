from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import DuplicateKeyError
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, field_validator, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timedelta, timezone
import bcrypt
import jwt


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

app = FastAPI(title="Leray-Pointel B2B API")
api = APIRouter(prefix="/api")
bearer = HTTPBearer(auto_error=False)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("leray-pointel")


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


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class Product(BaseModel):
    id: str
    name: str
    category: str
    origin: str
    unit: str
    price: float
    image_url: str
    description: str


class CartItem(BaseModel):
    product_id: str
    name: str
    unit: str
    price: float
    quantity: int


class OrderCreate(BaseModel):
    items: List[CartItem]
    notes: Optional[str] = ""


class Order(BaseModel):
    id: str
    user_id: str
    company_name: str
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


def make_token(user_id: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": user_id, "iat": now, "exp": now + timedelta(days=JWT_TTL_DAYS)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def user_public(doc: dict) -> dict:
    return {
        "id": doc["id"],
        "company_name": doc["company_name"],
        "siret": doc["siret"],
        "email": doc["email"],
        "phone": doc["phone"],
        "delivery_address": doc["delivery_address"],
        "role": doc.get("role", "user"),
    }


async def current_user(cred: Optional[HTTPAuthorizationCredentials] = Depends(bearer)):
    if not cred or cred.scheme.lower() != "bearer":
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(cred.credentials, JWT_SECRET, algorithms=[JWT_ALGO])
        uid = payload["sub"]
    except Exception:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": uid}, {"_id": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user


async def require_admin(user: dict = Depends(current_user)):
    if user.get("role") != "admin":
        raise HTTPException(403, "Réservé aux administrateurs")
    return user


# ============================== SEED PRODUCTS ==============================

SEED_PRODUCTS = [
    # Fruits
    {"name": "Pommes Gala", "category": "Fruits", "origin": "France", "unit": "Cagette 5kg", "price": 12.90,
     "image_url": "https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=600",
     "description": "Pommes Gala croquantes et sucrées, catégorie Extra."},
    {"name": "Bananes", "category": "Fruits", "origin": "Équateur", "unit": "Carton 18kg", "price": 24.50,
     "image_url": "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=600",
     "description": "Bananes Cavendish mûrissage contrôlé."},
    {"name": "Oranges à jus", "category": "Fruits", "origin": "Espagne", "unit": "Sac 10kg", "price": 15.00,
     "image_url": "https://images.unsplash.com/photo-1580052614034-c55d20bfee3b?w=600",
     "description": "Oranges juteuses idéales pour presser."},
    {"name": "Fraises Gariguette", "category": "Fruits", "origin": "France", "unit": "Barquette 500g x8", "price": 32.00,
     "image_url": "https://images.unsplash.com/photo-1543528176-61b239494933?w=600",
     "description": "Fraises Gariguette parfumées, saison de printemps."},
    {"name": "Citrons jaunes", "category": "Fruits", "origin": "Italie", "unit": "Cagette 5kg", "price": 14.20,
     "image_url": "https://images.unsplash.com/photo-1587496679742-bad5f8034b8f?w=600",
     "description": "Citrons de Sicile calibre moyen."},
    # Légumes
    {"name": "Tomates grappe", "category": "Légumes", "origin": "France", "unit": "Cagette 6kg", "price": 18.90,
     "image_url": "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600",
     "description": "Tomates grappe rouges, mûres à point."},
    {"name": "Pommes de terre Charlotte", "category": "Légumes", "origin": "France", "unit": "Sac 25kg", "price": 22.50,
     "image_url": "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=600",
     "description": "Charlotte à chair ferme, idéale pour vapeur et poêlée."},
    {"name": "Carottes", "category": "Légumes", "origin": "France", "unit": "Sac 10kg", "price": 11.00,
     "image_url": "https://images.unsplash.com/photo-1445282768818-728615cc910a?w=600",
     "description": "Carottes lavées calibre 200/300g."},
    {"name": "Courgettes", "category": "Légumes", "origin": "Maroc", "unit": "Cagette 5kg", "price": 13.80,
     "image_url": "https://images.unsplash.com/photo-1596566267081-c7cbe07850f6?w=600",
     "description": "Courgettes vertes fermes, calibre régulier."},
    {"name": "Poivrons rouges", "category": "Légumes", "origin": "Espagne", "unit": "Cagette 5kg", "price": 16.50,
     "image_url": "https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=600",
     "description": "Poivrons rouges charnus."},
    {"name": "Salade batavia", "category": "Légumes", "origin": "France", "unit": "Colis 12 pièces", "price": 14.40,
     "image_url": "https://images.unsplash.com/photo-1622206151246-c47eb45f0263?w=600",
     "description": "Batavia française, croquante."},
    {"name": "Oignons jaunes", "category": "Légumes", "origin": "France", "unit": "Sac 10kg", "price": 9.80,
     "image_url": "https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=600",
     "description": "Oignons jaunes à cuire."},
    # Herbes
    {"name": "Basilic frais", "category": "Herbes", "origin": "France", "unit": "Colis 12 bottes", "price": 18.00,
     "image_url": "https://images.unsplash.com/photo-1618375569909-3c8616cf7733?w=600",
     "description": "Basilic frais parfumé, coupé du jour."},
    {"name": "Persil plat", "category": "Herbes", "origin": "France", "unit": "Colis 12 bottes", "price": 12.00,
     "image_url": "https://images.unsplash.com/photo-1600231915711-cbc80c8d6a2b?w=600",
     "description": "Persil plat frais, aromatique."},
    {"name": "Coriandre fraîche", "category": "Herbes", "origin": "France", "unit": "Colis 12 bottes", "price": 13.50,
     "image_url": "https://images.unsplash.com/photo-1611089547453-af23c98f1503?w=600",
     "description": "Coriandre fraîche pour cuisine du monde."},
]


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("siret", unique=True)
    await db.users.create_index("id", unique=True)
    await db.products.create_index("id", unique=True)
    await db.orders.create_index("id", unique=True)
    await db.orders.create_index("user_id")

    # Seed products only if empty
    count = await db.products.count_documents({})
    if count == 0:
        docs = []
        for p in SEED_PRODUCTS:
            docs.append({"id": str(uuid.uuid4()), **p})
        await db.products.insert_many(docs)
        logger.info(f"Seeded {len(docs)} products")

    # Seed default supplier (admin) account — only Leray-Pointel has admin access.
    admin_email = "sarlleraypointel@orange.fr"
    admin_password = "teste123"
    # Lock supplier space to Leray-Pointel: remove any stray admin accounts.
    await db.users.delete_many({"role": "admin", "email": {"$ne": admin_email}})
    admin = await db.users.find_one({"email": admin_email})
    if not admin:
        try:
            await db.users.insert_one({
                "id": str(uuid.uuid4()),
                "company_name": "SARL Leray-Pointel",
                "siret": "00000000000000",
                "email": admin_email,
                "phone": "+33100000000",
                "delivery_address": "Siège Leray-Pointel",
                "password_hash": hash_password(admin_password),
                "role": "admin",
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
            logger.info(f"Seeded supplier account {admin_email}")
        except DuplicateKeyError:
            pass
    else:
        # Keep the password aligned with the configured one on every start
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {
                "password_hash": hash_password(admin_password),
                "company_name": "SARL Leray-Pointel",
                "role": "admin",
            }},
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
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        await db.users.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(409, "Email ou SIRET déjà enregistré")
    return {"access_token": make_token(user_id), "token_type": "bearer", "user": user_public(doc)}


@api.post("/auth/login", response_model=TokenOut)
async def login(body: LoginIn):
    doc = await db.users.find_one({"email": body.email}, {"_id": 0})
    if not doc or not verify_password(body.password, doc["password_hash"]):
        raise HTTPException(401, "Email ou mot de passe incorrect")
    return {"access_token": make_token(doc["id"]), "token_type": "bearer", "user": user_public(doc)}


@api.get("/auth/me", response_model=UserOut)
async def me(user: dict = Depends(current_user)):
    return user_public(user)


@api.get("/products", response_model=List[Product])
async def list_products(category: Optional[str] = None):
    q = {}
    if category and category.lower() != "tous":
        q["category"] = category
    docs = await db.products.find(q, {"_id": 0}).to_list(500)
    return docs


@api.get("/products/categories")
async def categories():
    cats = await db.products.distinct("category")
    return {"categories": ["Tous"] + sorted(cats)}


@api.post("/orders", response_model=Order, status_code=201)
async def create_order(body: OrderCreate, user: dict = Depends(current_user)):
    if not body.items:
        raise HTTPException(400, "Panier vide")
    total = round(sum(i.price * i.quantity for i in body.items), 2)
    order_id = str(uuid.uuid4())
    doc = {
        "id": order_id,
        "user_id": user["id"],
        "company_name": user["company_name"],
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


# ============================== ADMIN ROUTES ==============================

ALLOWED_STATUSES = ["En attente", "Validée", "En préparation", "Livrée", "Annulée"]


class ProductIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    category: str = Field(min_length=1, max_length=100)
    origin: str = Field(min_length=1, max_length=100)
    unit: str = Field(min_length=1, max_length=100)
    price: float = Field(gt=0)
    image_url: str = Field(min_length=1, max_length=1000)
    description: str = Field(default="", max_length=1000)


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
    doc = {"id": str(uuid.uuid4()), **body.model_dump()}
    await db.products.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.put("/admin/products/{product_id}", response_model=Product)
async def admin_update_product(product_id: str, body: ProductIn, _: dict = Depends(require_admin)):
    updated = await db.products.find_one_and_update(
        {"id": product_id},
        {"$set": body.model_dump()},
        projection={"_id": 0},
        return_document=True,
    )
    if not updated:
        raise HTTPException(404, "Produit introuvable")
    return updated


@api.delete("/admin/products/{product_id}", status_code=204)
async def admin_delete_product(product_id: str, _: dict = Depends(require_admin)):
    res = await db.products.delete_one({"id": product_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Produit introuvable")
    return None


@api.get("/admin/orders", response_model=List[Order])
async def admin_list_orders(_: dict = Depends(require_admin)):
    docs = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return docs


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


@api.get("/admin/orders/{order_id}/invoice")
async def admin_invoice(order_id: str, _: dict = Depends(require_admin)):
    o = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Commande introuvable")
    lines = []
    lines.append("Facture,Leray-Pointel")
    lines.append(f"Numéro,{_csv_escape('#' + o['id'][:8].upper())}")
    lines.append(f"Date,{_csv_escape(o['created_at'])}")
    lines.append(f"Client,{_csv_escape(o['company_name'])}")
    lines.append(f"Adresse de livraison,{_csv_escape(o['delivery_address'])}")
    lines.append(f"Statut,{_csv_escape(o['status'])}")
    lines.append("")
    lines.append("Produit,Unité,Quantité,Prix unitaire HT,Total HT")
    for it in o["items"]:
        lines.append(",".join([
            _csv_escape(it["name"]),
            _csv_escape(it["unit"]),
            _csv_escape(it["quantity"]),
            _csv_escape(f"{it['price']:.2f}"),
            _csv_escape(f"{it['price'] * it['quantity']:.2f}"),
        ]))
    lines.append("")
    lines.append(f"Total HT,{_csv_escape(format(o['total'], '.2f'))}")
    csv_text = "\n".join(lines)
    return {"filename": f"facture-{o['id'][:8]}.csv", "content": csv_text, "order": o}


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


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
