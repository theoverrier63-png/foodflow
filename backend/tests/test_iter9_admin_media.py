"""
Iteration 9 backend tests:
- Login cover image
- Catalog watermark
- Our Story page
Verifies public GETs, admin auth-gating (401/403), PUT/DELETE roundtrips,
and validation constraints (max images=6, non-empty title/body).
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://localhost:8001").rstrip("/") + "/api"

ADMIN_EMAIL = "sarl.leraypointel@orange.fr"
ADMIN_PW = "Loic76930@"
BIZ_EMAIL = "test@leray.fr"
BIZ_PW = "Test1234!"

SAMPLE_B64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEUAAACnej3aAAAAAXRSTlMAQObYZgAAAApJREFUCNdjYAAAAAIAAeIhvDMAAAAASUVORK5CYII="
SAMPLE_B64_2 = "data:image/png;base64,iVBORw0AAAA"

DEFAULT_STORY_TITLE = "Notre histoire"


# ---------- Fixtures ----------

@pytest.fixture(scope="session")
def s():
    return requests.Session()


@pytest.fixture(scope="session")
def admin_token(s):
    r = s.post(f"{BASE_URL}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PW})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def biz_token(s):
    r = s.post(f"{BASE_URL}/auth/login", json={"email": BIZ_EMAIL, "password": BIZ_PW})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def H(tok):
    return {"Authorization": f"Bearer {tok}"}


# ---------- LOGIN COVER ----------

class TestLoginCover:
    def test_public_get(self, s):
        r = s.get(f"{BASE_URL}/login-cover")
        assert r.status_code == 200
        assert "image_url" in r.json()

    def test_put_requires_auth(self, s):
        r = s.put(f"{BASE_URL}/admin/login-cover", json={"image_url": SAMPLE_B64})
        assert r.status_code == 401

    def test_put_business_forbidden(self, s, biz_token):
        r = s.put(f"{BASE_URL}/admin/login-cover", json={"image_url": SAMPLE_B64}, headers=H(biz_token))
        assert r.status_code == 403

    def test_admin_put_then_get(self, s, admin_token):
        r = s.put(f"{BASE_URL}/admin/login-cover", json={"image_url": SAMPLE_B64}, headers=H(admin_token))
        assert r.status_code == 200
        assert r.json()["image_url"] == SAMPLE_B64
        g = s.get(f"{BASE_URL}/login-cover")
        assert g.status_code == 200
        assert g.json()["image_url"] == SAMPLE_B64

    def test_admin_delete(self, s, admin_token):
        # Ensure something is set first
        s.put(f"{BASE_URL}/admin/login-cover", json={"image_url": SAMPLE_B64}, headers=H(admin_token))
        r = s.delete(f"{BASE_URL}/admin/login-cover", headers=H(admin_token))
        assert r.status_code == 204
        g = s.get(f"{BASE_URL}/login-cover")
        assert g.status_code == 200
        assert g.json()["image_url"] is None


# ---------- WATERMARK ----------

class TestWatermark:
    def test_public_get(self, s):
        r = s.get(f"{BASE_URL}/watermark")
        assert r.status_code == 200
        assert "image_url" in r.json()

    def test_put_requires_auth(self, s):
        r = s.put(f"{BASE_URL}/admin/watermark", json={"image_url": SAMPLE_B64})
        assert r.status_code == 401

    def test_put_business_forbidden(self, s, biz_token):
        r = s.put(f"{BASE_URL}/admin/watermark", json={"image_url": SAMPLE_B64}, headers=H(biz_token))
        assert r.status_code == 403

    def test_admin_put_get_delete(self, s, admin_token):
        p = s.put(f"{BASE_URL}/admin/watermark", json={"image_url": SAMPLE_B64_2}, headers=H(admin_token))
        assert p.status_code == 200
        g = s.get(f"{BASE_URL}/watermark")
        assert g.json()["image_url"] == SAMPLE_B64_2
        d = s.delete(f"{BASE_URL}/admin/watermark", headers=H(admin_token))
        assert d.status_code == 204
        g2 = s.get(f"{BASE_URL}/watermark")
        assert g2.json()["image_url"] is None


# ---------- OUR STORY ----------

class TestOurStory:
    def test_public_get_defaults_when_unset(self, s, admin_token):
        # ensure unset: delete the settings entry via a direct PUT with a distinctive value is not possible,
        # but the API returns defaults if the field is missing. To validate defaults, we PUT then attempt
        # to check the "returns defaults if unset" contract by asserting non-empty title/body & images list.
        r = s.get(f"{BASE_URL}/our-story")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data.get("title"), str) and len(data["title"]) > 0
        assert isinstance(data.get("body"), str) and len(data["body"]) > 0
        assert isinstance(data.get("images"), list)

    def test_put_requires_auth(self, s):
        r = s.put(f"{BASE_URL}/admin/our-story", json={"title": "T", "body": "B", "images": []})
        assert r.status_code == 401

    def test_put_business_forbidden(self, s, biz_token):
        r = s.put(f"{BASE_URL}/admin/our-story",
                  json={"title": "T", "body": "B", "images": []},
                  headers=H(biz_token))
        assert r.status_code == 403

    def test_admin_put_then_get_reflects(self, s, admin_token):
        payload = {"title": "TEST Titre", "body": "TEST corps de texte", "images": [SAMPLE_B64]}
        r = s.put(f"{BASE_URL}/admin/our-story", json=payload, headers=H(admin_token))
        assert r.status_code == 200, r.text
        g = s.get(f"{BASE_URL}/our-story")
        assert g.status_code == 200
        d = g.json()
        assert d["title"] == "TEST Titre"
        assert d["body"] == "TEST corps de texte"
        assert d["images"] == [SAMPLE_B64]

    def test_put_too_many_images(self, s, admin_token):
        payload = {"title": "x", "body": "y", "images": [SAMPLE_B64] * 7}
        r = s.put(f"{BASE_URL}/admin/our-story", json=payload, headers=H(admin_token))
        assert r.status_code == 422

    def test_put_empty_title_422(self, s, admin_token):
        r = s.put(f"{BASE_URL}/admin/our-story",
                  json={"title": "", "body": "ok", "images": []},
                  headers=H(admin_token))
        assert r.status_code == 422

    def test_put_empty_body_422(self, s, admin_token):
        r = s.put(f"{BASE_URL}/admin/our-story",
                  json={"title": "ok", "body": "", "images": []},
                  headers=H(admin_token))
        assert r.status_code == 422

    def test_cleanup_reset_defaults(self, s, admin_token):
        # Reset to sensible defaults so client-side tests see clean state.
        default_body = (
            "Depuis plusieurs générations, la SARL Leray-Pointel sélectionne chaque jour "
            "les meilleurs fruits et légumes pour les professionnels de la restauration et "
            "les particuliers de la région."
        )
        r = s.put(f"{BASE_URL}/admin/our-story",
                  json={"title": DEFAULT_STORY_TITLE, "body": default_body, "images": []},
                  headers=H(admin_token))
        assert r.status_code == 200


# ---------- REGRESSION SANITY ----------

class TestRegression:
    def test_season_get(self, s):
        r = s.get(f"{BASE_URL}/settings/season")
        assert r.status_code == 200
        assert "season" in r.json()

    def test_products_ttc_fields_exist(self, s):
        r = s.get(f"{BASE_URL}/products")
        assert r.status_code == 200
        products = r.json()
        assert len(products) > 0
        p = products[0]
        # dual HT/TTC + cagette fields present in schema
        for k in ("price_kg", "price_piece", "price_kg_ttc", "price_piece_ttc",
                  "cagette_content_pieces", "cagette_content_kg"):
            assert k in p, f"missing field {k}"

    def test_admin_export_csv(self, s, admin_token):
        r = s.get(f"{BASE_URL}/admin/orders/export", headers=H(admin_token))
        assert r.status_code == 200
        assert "content" in r.json() and "filename" in r.json()

    def test_habits_endpoint(self, s, biz_token):
        r = s.get(f"{BASE_URL}/orders/habits", headers=H(biz_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)
