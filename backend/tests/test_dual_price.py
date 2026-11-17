"""Iteration 4: Dual-price (price_kg / price_piece) backend tests."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://web-only-app-3--48bbr5e0.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "sarl.leraypointel@orange.fr"
ADMIN_PASSWORD = "Loic76930@"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="module")
def admin_token(s):
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["user"]["role"] == "admin"
    return data["access_token"]


def h(tok):
    return {"Authorization": f"Bearer {tok}"}


BASE_PAYLOAD = {
    "name": "TEST_dual",
    "category": "Fruits",
    "origin": "France",
    "unit": "Cagette 5kg",
    "image_url": "https://example.com/x.jpg",
    "description": "TEST dual price",
}


def _payload(**overrides):
    p = dict(BASE_PAYLOAD)
    p["name"] = f"TEST_dual_{uuid.uuid4().hex[:6]}"
    p.update(overrides)
    return p


# --- CREATE ---
def test_create_with_both_prices_defaults_to_kg(s, admin_token):
    payload = _payload(price_kg=2.5, price_piece=0.4)
    r = s.post(f"{API}/admin/products", json=payload, headers=h(admin_token))
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["price_kg"] == 2.5
    assert data["price_piece"] == 0.4
    assert data["sell_unit"] == "kg"
    assert data["price"] == 2.5
    pid = data["id"]

    # Verify via GET /products
    listed = s.get(f"{API}/products").json()
    item = next(p for p in listed if p["id"] == pid)
    assert item["price_kg"] == 2.5
    assert item["price_piece"] == 0.4

    # Cleanup
    s.delete(f"{API}/admin/products/{pid}", headers=h(admin_token))


def test_create_without_any_price_returns_422(s, admin_token):
    payload = _payload()  # No prices
    r = s.post(f"{API}/admin/products", json=payload, headers=h(admin_token))
    assert r.status_code == 422, r.text
    txt = r.text.lower()
    assert "prix" in txt or "price" in txt or "au moins" in txt


def test_create_with_only_price_piece(s, admin_token):
    payload = _payload(price_piece=1.2)
    r = s.post(f"{API}/admin/products", json=payload, headers=h(admin_token))
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["sell_unit"] == "piece"
    assert data["price"] == 1.2
    assert data["price_kg"] is None
    assert data["price_piece"] == 1.2
    s.delete(f"{API}/admin/products/{data['id']}", headers=h(admin_token))


def test_create_with_only_price_kg(s, admin_token):
    payload = _payload(price_kg=3.7)
    r = s.post(f"{API}/admin/products", json=payload, headers=h(admin_token))
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["sell_unit"] == "kg"
    assert data["price"] == 3.7
    assert data["price_kg"] == 3.7
    assert data["price_piece"] is None
    s.delete(f"{API}/admin/products/{data['id']}", headers=h(admin_token))


# --- UPDATE ---
def test_put_updates_both_prices(s, admin_token):
    # Create with kg only
    r = s.post(f"{API}/admin/products", json=_payload(price_kg=2.0), headers=h(admin_token))
    assert r.status_code == 201
    pid = r.json()["id"]

    # Update with both prices
    r = s.put(f"{API}/admin/products/{pid}",
              json=_payload(price_kg=2.5, price_piece=0.4), headers=h(admin_token))
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["price_kg"] == 2.5
    assert data["price_piece"] == 0.4
    assert data["sell_unit"] == "kg"

    s.delete(f"{API}/admin/products/{pid}", headers=h(admin_token))


def test_put_without_price_returns_422(s, admin_token):
    r = s.post(f"{API}/admin/products", json=_payload(price_kg=1.5), headers=h(admin_token))
    pid = r.json()["id"]

    r = s.put(f"{API}/admin/products/{pid}", json=_payload(), headers=h(admin_token))
    assert r.status_code == 422, r.text

    s.delete(f"{API}/admin/products/{pid}", headers=h(admin_token))


# --- Existing Pommes Gala should have both prices ---
def test_pommes_gala_has_both_prices(s):
    r = s.get(f"{API}/products", params={"category": "Fruits"})
    assert r.status_code == 200
    gala = next((p for p in r.json() if p["name"] == "Pommes Gala"), None)
    assert gala is not None, "Pommes Gala not found in Fruits"
    assert gala["price_kg"] == 2.58
    assert gala["price_piece"] == 0.35


# --- Seeded products expose both fields (may be null) ---
def test_all_products_expose_price_fields(s):
    r = s.get(f"{API}/products")
    assert r.status_code == 200
    for p in r.json():
        assert "price_kg" in p
        assert "price_piece" in p
        # At least one must be non-null after migration
        assert p["price_kg"] is not None or p["price_piece"] is not None
