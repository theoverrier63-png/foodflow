"""Iteration 7: Order Habits feature backend tests.

Endpoint under test: GET /api/orders/habits?limit=8
- Auth required
- Ranks products by (order-count DESC, total-qty DESC)
- Honors current global season (filters out mismatched season products)
"""
import os
import uuid
import pytest
import requests
from pymongo import MongoClient

_MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
_DB_NAME = os.environ.get("DB_NAME", "leray_pointel")
_mongo = MongoClient(_MONGO_URL)[_DB_NAME]

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "sarl.leraypointel@orange.fr"
ADMIN_PASSWORD = "Loic76930@"
COMPANY_EMAIL = "test@leray.fr"
COMPANY_PASSWORD = "Test1234!"


# ---------- Fixtures ----------

@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


def h(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def admin_token(s):
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def company_token(s):
    r = s.post(f"{API}/auth/login", json={"email": COMPANY_EMAIL, "password": COMPANY_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def products_by_name(s):
    """Return dict name→product for real seed products."""
    r = s.get(f"{API}/products")
    assert r.status_code == 200
    return {p["name"]: p for p in r.json()}


@pytest.fixture(scope="module", autouse=True)
def _reset_state(s, admin_token, company_token):
    """Always leave season='all' AND wipe test-account orders after the suite."""
    yield
    # Reset season
    s.put(f"{API}/admin/settings/season", json={"season": "all"}, headers=h(admin_token))
    # Delete every TEST order for the test company (via Mongo, no DELETE endpoint exists)
    me = s.get(f"{API}/auth/me", headers=h(company_token)).json()
    _mongo.orders.delete_many({"user_id": me["id"], "notes": {"$regex": "^TEST_"}})


def _wipe_company_orders(s, admin_token, company_token):
    """Delete every TEST order for the test company so we start clean."""
    me = s.get(f"{API}/auth/me", headers=h(company_token)).json()
    _mongo.orders.delete_many({"user_id": me["id"]})


def _item_from(p, qty):
    return {
        "product_id": p["id"],
        "name": p["name"],
        "unit": p["unit"],
        "sell_unit": p.get("sell_unit", "piece"),
        "price": p.get("price_kg") or p.get("price_piece") or p.get("price") or 1.0,
        "quantity": qty,
    }


# ---------- Tests ----------

# Auth guard
def test_01_habits_requires_auth(s):
    r = s.get(f"{API}/orders/habits")
    assert r.status_code in (401, 403), r.text


def test_02_habits_empty_when_no_orders(s, admin_token, company_token):
    # Ensure the company account has zero orders before the assertion
    _wipe_company_orders(s, admin_token, company_token)
    r = s.get(f"{API}/orders/habits", headers=h(company_token))
    assert r.status_code == 200, r.text
    assert r.json() == []


def test_03_habits_ranks_by_orders_count_then_qty(s, admin_token, company_token, products_by_name):
    _wipe_company_orders(s, admin_token, company_token)
    carottes = products_by_name["Carottes"]
    bananes = products_by_name["Bananes"]
    tomates = products_by_name["Tomates grappe"]

    # Order 1: carrots x2 + bananas x1
    o1 = s.post(
        f"{API}/orders",
        json={"items": [_item_from(carottes, 2), _item_from(bananes, 1)], "notes": "TEST_habits_1"},
        headers=h(company_token),
    )
    assert o1.status_code == 201, o1.text

    # Order 2: carrots x1 + tomatoes x1
    o2 = s.post(
        f"{API}/orders",
        json={"items": [_item_from(carottes, 1), _item_from(tomates, 1)], "notes": "TEST_habits_2"},
        headers=h(company_token),
    )
    assert o2.status_code == 201, o2.text

    r = s.get(f"{API}/orders/habits", headers=h(company_token))
    assert r.status_code == 200, r.text
    habits = r.json()
    assert len(habits) >= 2, habits
    # Carrots (in both orders) must be first
    assert habits[0]["id"] == carottes["id"], f"expected carrots first, got {[p['name'] for p in habits]}"
    ids = [p["id"] for p in habits]
    assert bananes["id"] in ids
    assert tomates["id"] in ids


def test_04_habits_limit_param(s, company_token):
    r = s.get(f"{API}/orders/habits?limit=1", headers=h(company_token))
    assert r.status_code == 200
    assert len(r.json()) == 1


def test_05_season_filter_hides_offseason_product(s, admin_token, company_token):
    """Create a summer-only test product, order it, then switch season=winter → habits must exclude it."""
    # Ensure season=all first
    s.put(f"{API}/admin/settings/season", json={"season": "all"}, headers=h(admin_token))

    # Create summer product
    unique = uuid.uuid4().hex[:6]
    payload = {
        "name": f"TEST_Melon_{unique}",
        "category": "Fruits",
        "origin": "Provence",
        "unit": "kg",
        "price_kg": 3.0,
        "season": "summer",
        "image_url": "https://example.com/melon.jpg",
        "description": "TEST summer product",
    }
    rp = s.post(f"{API}/admin/products", json=payload, headers=h(admin_token))
    assert rp.status_code == 201, rp.text
    prod = rp.json()

    try:
        # Order it as company
        item = {
            "product_id": prod["id"],
            "name": prod["name"],
            "unit": prod["unit"],
            "sell_unit": prod.get("sell_unit", "kg"),
            "price": prod["price_kg"],
            "quantity": 3,
        }
        ro = s.post(
            f"{API}/orders",
            json={"items": [item], "notes": "TEST_habits_season"},
            headers=h(company_token),
        )
        assert ro.status_code == 201, ro.text

        # Season=all → present
        s.put(f"{API}/admin/settings/season", json={"season": "all"}, headers=h(admin_token))
        rh = s.get(f"{API}/orders/habits?limit=20", headers=h(company_token))
        assert rh.status_code == 200
        ids = [p["id"] for p in rh.json()]
        assert prod["id"] in ids

        # Season=winter → summer product filtered out
        s.put(f"{API}/admin/settings/season", json={"season": "winter"}, headers=h(admin_token))
        rh = s.get(f"{API}/orders/habits?limit=20", headers=h(company_token))
        assert rh.status_code == 200
        ids = [p["id"] for p in rh.json()]
        assert prod["id"] not in ids, "summer product must be hidden under winter season"

        # Season=summer → summer product reappears
        s.put(f"{API}/admin/settings/season", json={"season": "summer"}, headers=h(admin_token))
        rh = s.get(f"{API}/orders/habits?limit=20", headers=h(company_token))
        assert rh.status_code == 200
        ids = [p["id"] for p in rh.json()]
        assert prod["id"] in ids
    finally:
        # Cleanup: reset season + delete product
        s.put(f"{API}/admin/settings/season", json={"season": "all"}, headers=h(admin_token))
        s.delete(f"{API}/admin/products/{prod['id']}", headers=h(admin_token))


def test_06_habits_response_shape(s, company_token):
    r = s.get(f"{API}/orders/habits", headers=h(company_token))
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    if data:
        p = data[0]
        for k in ("id", "name", "category", "unit", "image_url"):
            assert k in p, f"missing '{k}' in habit product: {p}"
        # Must not leak Mongo _id
        assert "_id" not in p
