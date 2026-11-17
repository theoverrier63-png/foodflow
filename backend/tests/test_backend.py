"""Backend API tests for Leray-Pointel B2B."""
import os
import uuid
import pytest
import requests

BASE_URL = "https://web-only-app-3--48bbr5e0.preview.emergentagent.com"
API = f"{BASE_URL}/api"

SEED_EMAIL = "test@leray.fr"
SEED_PASSWORD = "Test1234!"
SEED_SIRET = "12345678901234"


@pytest.fixture(scope="session")
def s():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="session")
def seed_token(s):
    # login or register seed account
    r = s.post(f"{API}/auth/login", json={"email": SEED_EMAIL, "password": SEED_PASSWORD})
    if r.status_code == 200:
        return r.json()["access_token"]
    r = s.post(f"{API}/auth/register", json={
        "company_name": "Restaurant Test",
        "siret": SEED_SIRET,
        "email": SEED_EMAIL,
        "phone": "+33612345678",
        "delivery_address": "1 rue de Paris, 75001 Paris",
        "password": SEED_PASSWORD,
    })
    assert r.status_code == 201, r.text
    return r.json()["access_token"]


# ============================== Health ==============================
def test_root(s):
    r = s.get(f"{API}/")
    assert r.status_code == 200
    assert r.json().get("ok") is True


# ============================== Auth ==============================
def test_register_success(s):
    unique = uuid.uuid4().hex[:10]
    siret = "9" + "".join([str((i * 7) % 10) for i in range(13)])
    # ensure unique siret
    siret = "".join([str((int(unique[i % len(unique)], 16) + i) % 10) for i in range(14)])
    payload = {
        "company_name": f"TEST Co {unique}",
        "siret": siret,
        "email": f"test_{unique}@leray.fr",
        "phone": "+33600000000",
        "delivery_address": "10 rue de Test, 75010 Paris",
        "password": "Passw0rd!",
    }
    r = s.post(f"{API}/auth/register", json=payload)
    assert r.status_code == 201, r.text
    data = r.json()
    assert "access_token" in data and data["token_type"] == "bearer"
    assert data["user"]["email"] == payload["email"]
    assert data["user"]["siret"] == siret
    assert data["user"]["company_name"] == payload["company_name"]


def test_register_duplicate_returns_409(s, seed_token):
    payload = {
        "company_name": "Restaurant Test dup",
        "siret": SEED_SIRET,
        "email": SEED_EMAIL,
        "phone": "+33600000000",
        "delivery_address": "1 rue de Paris, 75001 Paris",
        "password": "Passw0rd!",
    }
    r = s.post(f"{API}/auth/register", json=payload)
    assert r.status_code == 409, r.text


def test_register_invalid_siret_returns_422(s):
    unique = uuid.uuid4().hex[:8]
    r = s.post(f"{API}/auth/register", json={
        "company_name": "Bad", "siret": "123", "email": f"bad_{unique}@x.fr",
        "phone": "+33600000000", "delivery_address": "10 rue", "password": "Passw0rd!",
    })
    assert r.status_code == 422


def test_register_invalid_email_returns_422(s):
    r = s.post(f"{API}/auth/register", json={
        "company_name": "Bad", "siret": "12345678901299", "email": "not-an-email",
        "phone": "+33600000000", "delivery_address": "10 rue", "password": "Passw0rd!",
    })
    assert r.status_code == 422


def test_register_short_password_returns_422(s):
    unique = uuid.uuid4().hex[:8]
    r = s.post(f"{API}/auth/register", json={
        "company_name": "Bad", "siret": "12345678901298", "email": f"sp_{unique}@x.fr",
        "phone": "+33600000000", "delivery_address": "10 rue", "password": "123",
    })
    assert r.status_code == 422


def test_login_success(s, seed_token):
    r = s.post(f"{API}/auth/login", json={"email": SEED_EMAIL, "password": SEED_PASSWORD})
    assert r.status_code == 200
    data = r.json()
    assert "access_token" in data
    assert data["user"]["email"] == SEED_EMAIL


def test_login_wrong_password_returns_401(s, seed_token):
    r = s.post(f"{API}/auth/login", json={"email": SEED_EMAIL, "password": "wrongPass!"})
    assert r.status_code == 401


def test_me_with_token(s, seed_token):
    r = s.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {seed_token}"})
    assert r.status_code == 200
    assert r.json()["email"] == SEED_EMAIL


def test_me_without_token_returns_401(s):
    r = s.get(f"{API}/auth/me")
    assert r.status_code == 401


# ============================== Products ==============================
def test_list_products_15(s):
    r = s.get(f"{API}/products")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) == 15
    cats = {p["category"] for p in data}
    assert cats == {"Fruits", "Légumes", "Herbes"}


def test_filter_products_by_category(s):
    r = s.get(f"{API}/products", params={"category": "Fruits"})
    assert r.status_code == 200
    data = r.json()
    assert all(p["category"] == "Fruits" for p in data)
    assert len(data) == 5


def test_categories(s):
    r = s.get(f"{API}/products/categories")
    assert r.status_code == 200
    assert r.json()["categories"] == ["Tous", "Fruits", "Herbes", "Légumes"]


# ============================== Orders ==============================
def test_create_order_requires_auth(s):
    r = s.post(f"{API}/orders", json={"items": [], "notes": ""})
    assert r.status_code == 401


def test_create_order_and_list(s, seed_token):
    products = s.get(f"{API}/products").json()
    p1, p2 = products[0], products[1]
    items = [
        {"product_id": p1["id"], "name": p1["name"], "unit": p1["unit"], "price": p1["price"], "quantity": 2},
        {"product_id": p2["id"], "name": p2["name"], "unit": p2["unit"], "price": p2["price"], "quantity": 1},
    ]
    expected_total = round(p1["price"] * 2 + p2["price"] * 1, 2)
    r = s.post(f"{API}/orders", json={"items": items, "notes": "TEST order"},
               headers={"Authorization": f"Bearer {seed_token}"})
    assert r.status_code == 201, r.text
    order = r.json()
    assert order["status"] == "En attente"
    assert order["total"] == expected_total
    assert order["notes"] == "TEST order"
    assert len(order["items"]) == 2
    order_id = order["id"]

    # list orders
    r2 = s.get(f"{API}/orders", headers={"Authorization": f"Bearer {seed_token}"})
    assert r2.status_code == 200
    orders = r2.json()
    assert any(o["id"] == order_id for o in orders)
    # sorted desc
    dates = [o["created_at"] for o in orders]
    assert dates == sorted(dates, reverse=True)
