"""Admin panel backend tests for Leray-Pointel B2B (iteration 2)."""
import os
import uuid
import pytest
import requests

BASE_URL = "https://web-only-app-3--48bbr5e0.preview.emergentagent.com"
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@leray-pointel.fr"
ADMIN_PASSWORD = "admin1234"
USER_EMAIL = "test@leray.fr"
USER_PASSWORD = "Test1234!"
USER_SIRET = "12345678901234"

EXPECTED_STATUSES = ["En attente", "Validée", "En préparation", "Livrée", "Annulée"]


@pytest.fixture(scope="module")
def s():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def admin_token(s):
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["user"]["role"] == "admin"
    return data["access_token"]


@pytest.fixture(scope="module")
def user_token(s):
    r = s.post(f"{API}/auth/login", json={"email": USER_EMAIL, "password": USER_PASSWORD})
    if r.status_code != 200:
        r = s.post(f"{API}/auth/register", json={
            "company_name": "Restaurant Test",
            "siret": USER_SIRET,
            "email": USER_EMAIL,
            "phone": "+33612345678",
            "delivery_address": "1 rue de Paris, 75001 Paris",
            "password": USER_PASSWORD,
        })
        assert r.status_code in (201, 409), r.text
        if r.status_code == 409:
            r = s.post(f"{API}/auth/login", json={"email": USER_EMAIL, "password": USER_PASSWORD})
    assert r.status_code == 200
    data = r.json()
    assert data["user"].get("role", "user") == "user"
    return data["access_token"]


def h(tok):
    return {"Authorization": f"Bearer {tok}"}


# ============================== Auth / Role gating ==============================
def test_admin_login_role_admin(s):
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200
    assert r.json()["user"]["role"] == "admin"


def test_user_login_role_user(s, user_token):
    r = s.get(f"{API}/auth/me", headers=h(user_token))
    assert r.status_code == 200
    assert r.json().get("role", "user") == "user"


def test_admin_routes_forbidden_for_regular_user(s, user_token):
    endpoints = [
        ("GET", f"{API}/admin/orders"),
        ("GET", f"{API}/admin/statuses"),
        ("GET", f"{API}/admin/orders/export"),
    ]
    for method, url in endpoints:
        r = s.request(method, url, headers=h(user_token))
        assert r.status_code == 403, f"{method} {url} -> {r.status_code} {r.text}"


def test_admin_routes_unauthenticated_returns_401(s):
    r = s.get(f"{API}/admin/orders")
    assert r.status_code == 401


# ============================== Statuses ==============================
def test_admin_statuses(s, admin_token):
    r = s.get(f"{API}/admin/statuses", headers=h(admin_token))
    assert r.status_code == 200
    assert r.json()["statuses"] == EXPECTED_STATUSES


# ============================== Products CRUD ==============================
def test_admin_product_crud_and_persistence(s, admin_token):
    payload = {
        "name": f"TEST_Produit_{uuid.uuid4().hex[:6]}",
        "category": "Fruits",
        "origin": "France",
        "unit": "Cagette 5kg",
        "price": 9.99,
        "image_url": "https://example.com/x.jpg",
        "description": "TEST product",
    }
    # Create
    r = s.post(f"{API}/admin/products", json=payload, headers=h(admin_token))
    assert r.status_code == 201, r.text
    created = r.json()
    pid = created["id"]
    assert created["name"] == payload["name"]
    assert created["price"] == 9.99

    # Verify via public /products
    listed = s.get(f"{API}/products").json()
    assert any(p["id"] == pid for p in listed)

    # Update
    payload["price"] = 12.50
    payload["name"] = payload["name"] + "_upd"
    r = s.put(f"{API}/admin/products/{pid}", json=payload, headers=h(admin_token))
    assert r.status_code == 200, r.text
    assert r.json()["price"] == 12.50
    assert r.json()["name"].endswith("_upd")

    # Update non-existent -> 404
    r = s.put(f"{API}/admin/products/does-not-exist", json=payload, headers=h(admin_token))
    assert r.status_code == 404

    # Delete
    r = s.delete(f"{API}/admin/products/{pid}", headers=h(admin_token))
    assert r.status_code == 204

    # Delete again -> 404
    r = s.delete(f"{API}/admin/products/{pid}", headers=h(admin_token))
    assert r.status_code == 404

    # Confirm gone
    listed = s.get(f"{API}/products").json()
    assert not any(p["id"] == pid for p in listed)


def test_admin_create_product_forbidden_for_user(s, user_token):
    payload = {
        "name": "Bad", "category": "X", "origin": "Y",
        "unit": "kg", "price": 1.0, "image_url": "https://x/y.jpg", "description": "",
    }
    r = s.post(f"{API}/admin/products", json=payload, headers=h(user_token))
    assert r.status_code == 403


def test_admin_create_product_invalid_price_422(s, admin_token):
    payload = {
        "name": "X", "category": "X", "origin": "Y",
        "unit": "kg", "price": 0, "image_url": "https://x/y.jpg", "description": "",
    }
    r = s.post(f"{API}/admin/products", json=payload, headers=h(admin_token))
    assert r.status_code == 422


# ============================== Orders (admin) ==============================
@pytest.fixture(scope="module")
def sample_order_id(s, user_token):
    products = s.get(f"{API}/products").json()
    p = products[0]
    items = [{"product_id": p["id"], "name": p["name"], "unit": p["unit"],
              "price": p["price"], "quantity": 2}]
    r = s.post(f"{API}/orders", json={"items": items, "notes": "TEST admin"},
               headers=h(user_token))
    assert r.status_code == 201, r.text
    return r.json()["id"]


def test_admin_list_orders_returns_all(s, admin_token, sample_order_id):
    r = s.get(f"{API}/admin/orders", headers=h(admin_token))
    assert r.status_code == 200
    orders = r.json()
    assert isinstance(orders, list)
    assert any(o["id"] == sample_order_id for o in orders)


def test_admin_update_order_status_valid(s, admin_token, sample_order_id):
    r = s.patch(f"{API}/admin/orders/{sample_order_id}",
                json={"status": "Validée"}, headers=h(admin_token))
    assert r.status_code == 200
    assert r.json()["status"] == "Validée"

    # Verify persistence
    r = s.get(f"{API}/admin/orders", headers=h(admin_token))
    order = next(o for o in r.json() if o["id"] == sample_order_id)
    assert order["status"] == "Validée"


def test_admin_update_order_status_invalid_422(s, admin_token, sample_order_id):
    r = s.patch(f"{API}/admin/orders/{sample_order_id}",
                json={"status": "Pas Bon"}, headers=h(admin_token))
    assert r.status_code == 422


def test_admin_update_order_not_found(s, admin_token):
    r = s.patch(f"{API}/admin/orders/does-not-exist",
                json={"status": "Validée"}, headers=h(admin_token))
    assert r.status_code == 404


# ============================== Invoice / Export ==============================
def test_admin_invoice(s, admin_token, sample_order_id):
    r = s.get(f"{API}/admin/orders/{sample_order_id}/invoice", headers=h(admin_token))
    assert r.status_code == 200
    data = r.json()
    assert "filename" in data and data["filename"].endswith(".csv")
    assert "order" in data and data["order"]["id"] == sample_order_id
    assert "Facture,Leray-Pointel" in data["content"]
    assert "Total HT" in data["content"]


def test_admin_invoice_not_found(s, admin_token):
    r = s.get(f"{API}/admin/orders/does-not-exist/invoice", headers=h(admin_token))
    assert r.status_code == 404


def test_admin_orders_export(s, admin_token):
    r = s.get(f"{API}/admin/orders/export", headers=h(admin_token))
    assert r.status_code == 200
    data = r.json()
    assert data["filename"] == "commandes-export.csv"
    assert isinstance(data["count"], int)
    assert "Numéro,Date,Client" in data["content"]
