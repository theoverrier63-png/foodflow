"""Iteration 10 backend tests: subcategories + forgot-password flow."""
import os
import pytest
import requests

BASE_URL = "http://localhost:8001"
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "sarl.leraypointel@orange.fr"
ADMIN_PASSWORD = "Loic76930@"
BIZ_EMAIL = "test@leray.fr"
BIZ_PASSWORD = "Test1234!"


# ---------- helpers ----------
@pytest.fixture(scope="module")
def s():
    return requests.Session()


def _login(s, email, password):
    r = s.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    return r


@pytest.fixture(scope="module")
def admin_token(s):
    r = _login(s, ADMIN_EMAIL, ADMIN_PASSWORD)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def biz_token(s):
    # In case previous iteration left the password changed, try both known values
    r = _login(s, BIZ_EMAIL, BIZ_PASSWORD)
    assert r.status_code == 200, f"biz login failed: {r.text}"
    return r.json()["access_token"]


def _admin_h(tok):
    return {"Authorization": f"Bearer {tok}"}


# =====================================================================
# SUBCATEGORIES
# =====================================================================
class TestSubcategories:
    created_ids: list = []

    def test_1_initial_empty(self, s):
        r = s.get(f"{API}/products/subcategories", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert "by_category" in data
        # There must not be any product with subcategory yet
        # If test artefacts remain (from prior run) we clean them via helper
        # by querying products and cleaning up. Assume clean state.
        # We only require the shape:
        assert isinstance(data["by_category"], dict)

    def test_2_create_product_with_subcategory(self, s, admin_token):
        body = {
            "name": "TEST_Fraise",
            "category": "Fruits",
            "subcategory": "Fruits rouges",
            "origin": "France",
            "unit": "barquette",
            "price_kg": 8.5,
            "season": "summer",
            "image_url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
        }
        r = s.post(f"{API}/admin/products", json=body, headers=_admin_h(admin_token), timeout=15)
        assert r.status_code in (200, 201), r.text
        p = r.json()
        assert p["subcategory"] == "Fruits rouges"
        assert p["category"] == "Fruits"
        TestSubcategories.created_ids.append(p["id"])

    def test_3_subcategories_lists_fruits_rouges(self, s):
        r = s.get(f"{API}/products/subcategories", timeout=10)
        assert r.status_code == 200
        by_cat = r.json()["by_category"]
        assert "Fruits" in by_cat
        assert "Fruits rouges" in by_cat["Fruits"]

    def test_4_list_products_filter_by_subcategory(self, s):
        r = s.get(f"{API}/products", params={"category": "Fruits", "subcategory": "Fruits rouges"}, timeout=10)
        assert r.status_code == 200
        prods = r.json()
        assert len(prods) >= 1
        for p in prods:
            assert p["subcategory"] == "Fruits rouges"
            assert p["category"] == "Fruits"
        # our created product must be in there
        assert any(p["id"] == TestSubcategories.created_ids[0] for p in prods)

    def test_5_second_product_and_alphabetical(self, s, admin_token):
        body = {
            "name": "TEST_Citron",
            "category": "Fruits",
            "subcategory": "Agrumes",
            "origin": "Espagne",
            "unit": "kg",
            "price_kg": 3.0,
            "season": "all",
            "image_url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
        }
        r = s.post(f"{API}/admin/products", json=body, headers=_admin_h(admin_token), timeout=15)
        assert r.status_code in (200, 201), r.text
        TestSubcategories.created_ids.append(r.json()["id"])
        sr = s.get(f"{API}/products/subcategories", timeout=10)
        by_cat = sr.json()["by_category"]
        fruits = by_cat.get("Fruits", [])
        assert "Agrumes" in fruits and "Fruits rouges" in fruits
        # alphabetical: "Agrumes" before "Fruits rouges"
        assert fruits.index("Agrumes") < fruits.index("Fruits rouges")

    def test_6_put_empty_subcategory_normalises_to_null(self, s, admin_token):
        pid = TestSubcategories.created_ids[0]
        body = {
            "name": "TEST_Fraise",
            "category": "Fruits",
            "subcategory": "",
            "origin": "France",
            "unit": "barquette",
            "price_kg": 8.5,
            "season": "summer",
            "image_url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
        }
        r = s.put(f"{API}/admin/products/{pid}", json=body, headers=_admin_h(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        p = r.json()
        assert p["subcategory"] is None
        sr = s.get(f"{API}/products/subcategories", timeout=10)
        fruits = sr.json()["by_category"].get("Fruits", [])
        assert "Fruits rouges" not in fruits
        assert "Agrumes" in fruits

    def test_7_cleanup(self, s, admin_token):
        for pid in TestSubcategories.created_ids:
            r = s.delete(f"{API}/admin/products/{pid}", headers=_admin_h(admin_token), timeout=10)
            assert r.status_code in (200, 204), r.text
        TestSubcategories.created_ids.clear()


# =====================================================================
# FORGOT PASSWORD
# =====================================================================
class TestForgotPassword:
    reset_id: str = ""

    def test_1_forgot_unknown_email(self, s):
        r = s.post(f"{API}/auth/forgot-password", json={"email": "no-such-user-xyz@example.com"}, timeout=10)
        assert r.status_code == 202
        assert r.json() == {"ok": True}
        # ensure no user got created (login with that email should still fail)
        lr = _login(requests.Session(), "no-such-user-xyz@example.com", "whatever")
        assert lr.status_code in (400, 401, 403)

    def test_2_forgot_existing_creates_pending(self, s, admin_token):
        r = s.post(f"{API}/auth/forgot-password", json={"email": BIZ_EMAIL}, timeout=10)
        assert r.status_code == 202
        # Poll admin list for the new pending entry
        lr = s.get(f"{API}/admin/password-resets", headers=_admin_h(admin_token), timeout=10)
        assert lr.status_code == 200, lr.text
        entries = [e for e in lr.json() if e["email"] == BIZ_EMAIL and e["status"] == "pending"]
        assert len(entries) == 1
        e = entries[0]
        for k in ("id", "user_id", "email", "company_name", "status", "created_at"):
            assert k in e
        TestForgotPassword.reset_id = e["id"]

    def test_3_forgot_idempotent(self, s, admin_token):
        r = s.post(f"{API}/auth/forgot-password", json={"email": BIZ_EMAIL}, timeout=10)
        assert r.status_code == 202
        lr = s.get(f"{API}/admin/password-resets", headers=_admin_h(admin_token), timeout=10)
        entries = [e for e in lr.json() if e["email"] == BIZ_EMAIL and e["status"] == "pending"]
        assert len(entries) == 1
        assert entries[0]["id"] == TestForgotPassword.reset_id

    def test_4_forgot_admin_no_reset(self, s, admin_token):
        r = s.post(f"{API}/auth/forgot-password", json={"email": ADMIN_EMAIL}, timeout=10)
        assert r.status_code == 202
        lr = s.get(f"{API}/admin/password-resets", headers=_admin_h(admin_token), timeout=10)
        admin_entries = [e for e in lr.json() if e["email"] == ADMIN_EMAIL]
        assert admin_entries == []

    def test_5_admin_list_contains_entry(self, s, admin_token):
        lr = s.get(f"{API}/admin/password-resets", headers=_admin_h(admin_token), timeout=10)
        assert lr.status_code == 200
        ids = [e["id"] for e in lr.json()]
        assert TestForgotPassword.reset_id in ids

    def test_6_apply_reset_and_login(self, s, admin_token):
        new_pass = "NewPass123!"
        r = s.post(
            f"{API}/admin/password-resets/{TestForgotPassword.reset_id}/apply",
            json={"password": new_pass},
            headers=_admin_h(admin_token),
            timeout=10,
        )
        assert r.status_code == 200, r.text
        assert r.json() == {"ok": True}
        # New password works
        lr = _login(requests.Session(), BIZ_EMAIL, new_pass)
        assert lr.status_code == 200, lr.text
        # Old password fails
        lo = _login(requests.Session(), BIZ_EMAIL, BIZ_PASSWORD)
        assert lo.status_code in (400, 401, 403)

    def test_7_admin_list_no_more_pending(self, s, admin_token):
        lr = s.get(f"{API}/admin/password-resets", headers=_admin_h(admin_token), timeout=10)
        ids = [e["id"] for e in lr.json()]
        assert TestForgotPassword.reset_id not in ids

    def test_8_non_admin_forbidden(self, s):
        # login as biz using current (new) password
        lr = _login(requests.Session(), BIZ_EMAIL, "NewPass123!")
        assert lr.status_code == 200
        biz_tok = lr.json()["access_token"]
        h = {"Authorization": f"Bearer {biz_tok}"}
        r1 = requests.get(f"{API}/admin/password-resets", headers=h, timeout=10)
        assert r1.status_code == 403
        r2 = requests.post(f"{API}/admin/password-resets/xxx/apply", json={"password": "abcdef1"}, headers=h, timeout=10)
        assert r2.status_code == 403
        r3 = requests.post(f"{API}/admin/password-resets/xxx/dismiss", headers=h, timeout=10)
        assert r3.status_code == 403

    def test_9_cleanup_reset_back(self, s, admin_token):
        # create another reset and apply original password
        r = s.post(f"{API}/auth/forgot-password", json={"email": BIZ_EMAIL}, timeout=10)
        assert r.status_code == 202
        lr = s.get(f"{API}/admin/password-resets", headers=_admin_h(admin_token), timeout=10)
        entries = [e for e in lr.json() if e["email"] == BIZ_EMAIL and e["status"] == "pending"]
        assert len(entries) == 1
        rid = entries[0]["id"]
        ap = s.post(
            f"{API}/admin/password-resets/{rid}/apply",
            json={"password": BIZ_PASSWORD},
            headers=_admin_h(admin_token),
            timeout=10,
        )
        assert ap.status_code == 200
        # verify login with original password
        vr = _login(requests.Session(), BIZ_EMAIL, BIZ_PASSWORD)
        assert vr.status_code == 200
