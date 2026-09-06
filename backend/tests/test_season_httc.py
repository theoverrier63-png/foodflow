"""Iteration 6: HT/TTC + Season (global) feature backend tests."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "sarl.leraypointel@orange.fr"
ADMIN_PASSWORD = "Loic76930@"
COMPANY_EMAIL = "test@leray.fr"
COMPANY_PASSWORD = "Test1234!"


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


# Ensure we always leave season at "all"
@pytest.fixture(scope="module", autouse=True)
def _reset_season_after(s, admin_token):
    yield
    s.put(f"{API}/admin/settings/season", json={"season": "all"}, headers=h(admin_token))


# ---------- Settings endpoints ----------

def test_01_public_get_season_default(s, admin_token):
    # Ensure current is "all"
    s.put(f"{API}/admin/settings/season", json={"season": "all"}, headers=h(admin_token))
    r = s.get(f"{API}/settings/season")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body == {"season": "all"} or body.get("season") == "all"


def test_02_admin_set_season_winter(s, admin_token):
    r = s.put(f"{API}/admin/settings/season", json={"season": "winter"}, headers=h(admin_token))
    assert r.status_code == 200, r.text
    assert r.json().get("season") == "winter"
    # Confirm via public GET
    g = s.get(f"{API}/settings/season")
    assert g.json().get("season") == "winter"


def test_03_admin_set_season_invalid_returns_422(s, admin_token):
    r = s.put(f"{API}/admin/settings/season", json={"season": "invalid"}, headers=h(admin_token))
    assert r.status_code == 422, r.text


def test_04_non_admin_put_season_returns_403(s, company_token):
    r = s.put(f"{API}/admin/settings/season", json={"season": "summer"}, headers=h(company_token))
    assert r.status_code == 403, r.text


def test_05_no_token_put_season_returns_401(s):
    r = s.put(f"{API}/admin/settings/season", json={"season": "summer"})
    assert r.status_code in (401, 403), r.text


# ---------- Product create/update with season + TTC ----------

@pytest.fixture(scope="module")
def melon(s, admin_token):
    # Ensure season is "all" so GET /products includes it during any inspection
    s.put(f"{API}/admin/settings/season", json={"season": "all"}, headers=h(admin_token))
    payload = {
        "name": f"TEST Melon {uuid.uuid4().hex[:6]}",
        "category": "Fruits",
        "origin": "France",
        "unit": "Cagette",
        "price_kg": 3.0,
        "price_kg_ttc": 3.30,
        "season": "summer",
        "image_url": "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=600",
        "description": "melon d'été",
    }
    r = s.post(f"{API}/admin/products", json=payload, headers=h(admin_token))
    assert r.status_code == 201, r.text
    data = r.json()
    yield data
    # Cleanup
    s.delete(f"{API}/admin/products/{data['id']}", headers=h(admin_token))


def test_06_create_summer_melon_returns_ttc_and_season(melon):
    assert melon["price_kg"] == 3.0
    assert melon["price_kg_ttc"] == 3.30
    assert melon["season"] == "summer"
    # price_piece_ttc must be null (not provided)
    assert melon.get("price_piece_ttc") in (None, 0, 0.0)


def test_07_winter_hides_summer_products(s, admin_token, melon):
    r = s.put(f"{API}/admin/settings/season", json={"season": "winter"}, headers=h(admin_token))
    assert r.status_code == 200
    lst = s.get(f"{API}/products").json()
    ids = [p["id"] for p in lst]
    assert melon["id"] not in ids, "Summer melon must be hidden when current season = winter"
    # season=all products still appear
    all_seasons = [p.get("season", "all") for p in lst]
    assert all(sv in ("all", "winter") for sv in all_seasons), f"Unexpected seasons: {set(all_seasons)}"
    # And there is at least one "all"
    assert "all" in all_seasons


def test_08_summer_shows_summer_products(s, admin_token, melon):
    r = s.put(f"{API}/admin/settings/season", json={"season": "summer"}, headers=h(admin_token))
    assert r.status_code == 200
    lst = s.get(f"{API}/products").json()
    ids = [p["id"] for p in lst]
    assert melon["id"] in ids, "Summer melon must appear when season = summer"


def test_09_all_shows_everything(s, admin_token, melon):
    r = s.put(f"{API}/admin/settings/season", json={"season": "all"}, headers=h(admin_token))
    assert r.status_code == 200
    lst = s.get(f"{API}/products").json()
    ids = [p["id"] for p in lst]
    assert melon["id"] in ids
    seasons = {p.get("season", "all") for p in lst}
    # Should include multiple seasons potentially
    assert "all" in seasons


def test_10_update_melon_ttc(s, admin_token, melon):
    update = {
        "name": melon["name"],
        "category": "Fruits",
        "origin": "France",
        "unit": "Cagette",
        "price_kg": 3.0,
        "price_kg_ttc": 3.50,
        "season": "summer",
        "image_url": melon["image_url"],
        "description": "melon d'été maj",
    }
    r = s.put(f"{API}/admin/products/{melon['id']}", json=update, headers=h(admin_token))
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["price_kg_ttc"] == 3.50
    assert data["price_kg"] == 3.0
    assert data["season"] == "summer"
    # Verify persisted via GET
    g = s.get(f"{API}/products/{melon['id']}")
    assert g.status_code == 200
    assert g.json()["price_kg_ttc"] == 3.50


def test_11_seed_products_have_season_all(s):
    # No season filter applied when current=all
    r = s.get(f"{API}/products")
    assert r.status_code == 200
    lst = r.json()
    # every product must expose a season field
    for p in lst:
        assert "season" in p, f"Product {p.get('name')} missing 'season' field"
    # majority (seed products) should have season='all'
    seeds = [p for p in lst if not p["name"].startswith("TEST")]
    assert len(seeds) > 0, "No seed products found"
    for p in seeds:
        assert p["season"] == "all", f"Seed product {p['name']} has season={p['season']} (expected 'all')"


def test_12_products_expose_ttc_fields(s):
    r = s.get(f"{API}/products")
    assert r.status_code == 200
    for p in r.json():
        assert "price_kg_ttc" in p
        assert "price_piece_ttc" in p
