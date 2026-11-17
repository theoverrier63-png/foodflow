"""Iteration 8 — 'Unité Cagette' backend tests.

Coverage:
- POST /api/admin/products with cagette content (pieces/kg) validation
- PUT /api/admin/products/{id} switching cagette mode
- GET /api/products returns new fields
- POST /api/orders with sell_unit="cagette"
- GET /api/admin/orders/{id}/invoice returns application/pdf
- Migration: pre-existing seed products have cagette_content_* = null
- Cleanup of test products
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_BACKEND_URL", "https://web-only-app-3--48bbr5e0.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "sarl.leraypointel@orange.fr"
ADMIN_PASSWORD = "Loic76930@"
USER_EMAIL = "test@leray.fr"
USER_PASSWORD = "Test1234!"

TINY_PNG = "https://picsum.photos/seed/cagette/200"


def h(tok):
    return {"Authorization": f"Bearer {tok}"}


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
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def created_ids():
    """Collect ids to cleanup at teardown."""
    return []


@pytest.fixture(scope="module", autouse=True)
def _cleanup(s, admin_token, created_ids):
    yield
    for pid in created_ids:
        try:
            s.delete(f"{API}/admin/products/{pid}", headers=h(admin_token))
        except Exception:
            pass


def _mk_body(**overrides):
    body = {
        "name": f"TEST_Cagette_{uuid.uuid4().hex[:8]}",
        "category": "Légumes",
        "origin": "France",
        "unit": "Cagette 24 pce",
        "season": "all",
        "image_url": TINY_PNG,
        "description": "Test cagette product",
    }
    body.update(overrides)
    return body


# ============================== 1. Create with cagette_content_pieces ==============================
def test_01_create_cagette_pieces_ok(s, admin_token, created_ids):
    body = _mk_body(price_piece=1.20, cagette_content_pieces=24)
    r = s.post(f"{API}/admin/products", json=body, headers=h(admin_token))
    assert r.status_code == 201, r.text
    p = r.json()
    assert p["cagette_content_pieces"] == 24
    assert p["cagette_content_kg"] is None
    assert p["price_piece"] == 1.20
    assert p["price_kg"] is None
    assert p["sell_unit"] == "piece"
    created_ids.append(p["id"])
    # store id for test 06
    pytest._cagette_pieces_id = p["id"]


# ============================== 2. cagette_content_pieces without price_piece → 422 ==============================
def test_02_create_cagette_pieces_missing_price_piece(s, admin_token):
    body = _mk_body(price_kg=2.0, cagette_content_pieces=24)  # only price_kg
    r = s.post(f"{API}/admin/products", json=body, headers=h(admin_token))
    assert r.status_code == 422, r.text
    detail = r.json().get("detail", "")
    assert "Prix à la pièce requis pour vendre en cagette" in str(detail)


# ============================== 3. Create with cagette_content_kg ==============================
def test_03_create_cagette_kg_ok(s, admin_token, created_ids):
    body = _mk_body(price_kg=2.5, cagette_content_kg=5)
    r = s.post(f"{API}/admin/products", json=body, headers=h(admin_token))
    assert r.status_code == 201, r.text
    p = r.json()
    assert p["cagette_content_kg"] == 5.0
    assert p["cagette_content_pieces"] is None
    assert p["price_kg"] == 2.5
    created_ids.append(p["id"])


# ============================== 4. cagette_content_kg without price_kg → 422 ==============================
def test_04_create_cagette_kg_missing_price_kg(s, admin_token):
    body = _mk_body(price_piece=1.0, cagette_content_kg=5)  # only price_piece
    r = s.post(f"{API}/admin/products", json=body, headers=h(admin_token))
    assert r.status_code == 422, r.text
    detail = r.json().get("detail", "")
    assert "Prix au kilo requis pour vendre en cagette" in str(detail)


# ============================== 5. Both content fields set → 422 ==============================
def test_05_create_cagette_both_set(s, admin_token):
    body = _mk_body(
        price_piece=1.2, price_kg=2.0,
        cagette_content_pieces=24, cagette_content_kg=5,
    )
    r = s.post(f"{API}/admin/products", json=body, headers=h(admin_token))
    assert r.status_code == 422, r.text
    detail = r.json().get("detail", "")
    assert "pas les deux" in str(detail)


# ============================== 6. Update: switch pieces → kg ==============================
def test_06_update_switch_pieces_to_kg(s, admin_token):
    pid = getattr(pytest, "_cagette_pieces_id", None)
    assert pid, "test_01 must run first"
    body = _mk_body(price_kg=2.5, cagette_content_kg=5)
    # Keep the same name so update is idempotent
    body["name"] = "TEST_Cagette_switched"
    r = s.put(f"{API}/admin/products/{pid}", json=body, headers=h(admin_token))
    assert r.status_code == 200, r.text
    p = r.json()
    assert p["cagette_content_pieces"] is None
    assert p["cagette_content_kg"] == 5.0
    assert p["price_kg"] == 2.5
    assert p["price_piece"] is None

    # Also GET to verify persistence
    g = s.get(f"{API}/products/{pid}")
    assert g.status_code == 200
    pg = g.json()
    assert pg["cagette_content_pieces"] is None
    assert pg["cagette_content_kg"] == 5.0


# ============================== 7. GET /api/products returns new fields + migration ==============================
def test_07_get_products_has_new_fields_and_migration(s):
    r = s.get(f"{API}/products")
    assert r.status_code == 200
    products = r.json()
    assert isinstance(products, list) and len(products) > 0

    # Every product must expose both fields (migration)
    for p in products:
        assert "cagette_content_pieces" in p, f"missing cagette_content_pieces on {p.get('name')}"
        assert "cagette_content_kg" in p, f"missing cagette_content_kg on {p.get('name')}"

    # Pick a seed product (one NOT prefixed TEST_) and assert both are None
    seed = next((p for p in products if not p["name"].startswith("TEST_")), None)
    assert seed is not None, "no seed product found"
    assert seed["cagette_content_pieces"] is None
    assert seed["cagette_content_kg"] is None


# ============================== 8. Order with sell_unit=cagette + PDF invoice ==============================
def test_08_order_cagette_and_pdf(s, admin_token, user_token, created_ids):
    # Create a fresh cagette-capable product owned by admin
    body = _mk_body(price_piece=1.20, cagette_content_pieces=24, name=f"TEST_Cagette_Order_{uuid.uuid4().hex[:6]}")
    r = s.post(f"{API}/admin/products", json=body, headers=h(admin_token))
    assert r.status_code == 201, r.text
    prod = r.json()
    created_ids.append(prod["id"])

    cagette_price = round(prod["price_piece"] * prod["cagette_content_pieces"], 2)  # 28.80
    assert cagette_price == 28.80

    order_payload = {
        "items": [
            {
                "product_id": prod["id"],
                "name": prod["name"],
                "unit": prod["unit"],
                "sell_unit": "cagette",
                "price": cagette_price,
                "quantity": 2,
            }
        ],
        "notes": "TEST_iter8_cagette",
    }
    r2 = s.post(f"{API}/orders", json=order_payload, headers=h(user_token))
    assert r2.status_code in (200, 201), r2.text
    order = r2.json()
    assert order["items"][0]["sell_unit"] == "cagette"
    assert order["items"][0]["price"] == cagette_price
    assert order["items"][0]["quantity"] == 2
    order_id = order["id"]

    # PDF invoice (admin-only)
    r3 = s.get(f"{API}/admin/orders/{order_id}/invoice", headers=h(admin_token))
    assert r3.status_code == 200, r3.text
    assert r3.headers.get("content-type", "").startswith("application/pdf")
    assert r3.content[:4] == b"%PDF"

    # Cleanup: delete the order via mongo? no DELETE endpoint. Not critical — test data marker "TEST_" in name.
