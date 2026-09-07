"""Iteration 13 — Security-audit verification tests.

Covers:
  FIX 1 — JWT session invalidation on password reset (token_version)
  FIX 2 — Registration enumeration removed (neutral 202 for both endpoints)
  FIX 3 — PDF invoice escapes user fields (no 500 on HTML-special chars)
  FIX 4 — .env permissions 600

Also runs regression checks for login flows, orders, admin endpoints.
Cleanup guarantees test@leray.fr ends the run with password Test1234!.
"""
from __future__ import annotations

import os
import stat
import time
from datetime import datetime, timedelta, timezone

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "leray_pointel")

TEST_EMAIL = "test@leray.fr"
ORIGINAL_PASSWORD = "Test1234!"
ADMIN_EMAIL = "sarl.leraypointel@orange.fr"
ADMIN_PASSWORD = "Loic76930@"


@pytest.fixture(scope="module")
def db():
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


@pytest.fixture(scope="module")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(api_client, email, password):
    r = api_client.post(f"{API}/auth/login", json={"email": email, "password": password})
    return r


def _reset_password_via_flow(api_client, db, email, new_password):
    """Force a password reset by consuming a fresh forgot-password token."""
    # Trigger forgot-password
    r = api_client.post(f"{API}/auth/forgot-password", json={"email": email})
    assert r.status_code == 202, f"forgot-password status {r.status_code}"
    # Get user id
    user = db.users.find_one({"email": email})
    assert user is not None, f"user {email} not found"
    # Fetch fresh unused token
    tokens = list(
        db.password_reset_tokens.find({"user_id": user["id"], "used": False}).sort("created_at", -1)
    )
    assert tokens, "no reset token found in DB"
    token = tokens[0]["token"]
    # Consume it
    r = api_client.post(
        f"{API}/auth/reset-password", json={"token": token, "password": new_password}
    )
    assert r.status_code == 200, f"reset-password failed: {r.status_code} {r.text}"


# ============================================================
# FIX 4 — .env file permissions
# ============================================================

class TestEnvPermissions:
    def test_backend_env_permissions_are_600(self):
        st = os.stat("/app/backend/.env")
        mode = stat.S_IMODE(st.st_mode)
        assert mode == 0o600, f"expected 600, got {oct(mode)}"


# ============================================================
# FIX 2 — Registration enumeration removed
# ============================================================

class TestRegistrationEnumeration:
    def test_business_register_duplicate_returns_neutral_202(self, api_client):
        payload = {
            "company_name": "Restaurant Test Duplicate",
            "siret": "12345678901234",  # matches test@leray.fr's SIRET
            "email": TEST_EMAIL,
            "phone": "+33600000000",
            "delivery_address": "1 rue de Paris, 75001 Paris",
            "password": "SomePassword123!",
        }
        r = api_client.post(f"{API}/auth/register", json=payload)
        assert r.status_code == 202, f"expected 202, got {r.status_code} body={r.text[:200]}"
        body = r.json()
        assert body.get("access_token") is None
        assert body.get("user") is None

    def test_personal_register_duplicate_returns_neutral_202(self, api_client, db):
        # Ensure a personal account exists to attempt duplicate against
        personal_email = "TEST_personal_iter13@example.com"
        existing = db.users.find_one({"email": personal_email})
        cleanup_id = None
        if not existing:
            r = api_client.post(
                f"{API}/auth/register-personal",
                json={
                    "full_name": "Test Personal Iter13",
                    "email": personal_email,
                    "phone": "+33611111111",
                    "delivery_address": "Test 75001 Paris",
                    "password": "InitPass123!",
                },
            )
            assert r.status_code == 201, f"initial personal register: {r.status_code} {r.text}"
            cleanup_id = r.json()["user"]["id"]

        # Duplicate attempt
        r = api_client.post(
            f"{API}/auth/register-personal",
            json={
                "full_name": "Different Name",
                "email": personal_email,
                "phone": "+33622222222",
                "delivery_address": "Elsewhere",
                "password": "OtherPass123!",
            },
        )
        assert r.status_code == 202, f"expected 202, got {r.status_code} body={r.text[:200]}"
        body = r.json()
        assert body.get("access_token") is None
        assert body.get("user") is None

        # Cleanup
        if cleanup_id:
            db.users.delete_one({"id": cleanup_id})
        else:
            db.users.delete_one({"email": personal_email})

    def test_new_business_registration_still_returns_201_with_token(self, api_client, db):
        unique_siret = "99887766554" + str(int(time.time()))[-3:]
        payload = {
            "company_name": "TEST New Biz Iter13",
            "siret": unique_siret,
            "email": f"TEST_newbiz_iter13_{int(time.time())}@example.com",
            "phone": "+33633333333",
            "delivery_address": "10 rue Neuve, 75000 Paris",
            "password": "NewBizPass1!",
        }
        r = api_client.post(f"{API}/auth/register", json=payload)
        assert r.status_code == 201, f"new register: {r.status_code} {r.text}"
        body = r.json()
        assert body.get("access_token"), "should get a real token"
        assert body.get("user", {}).get("id"), "should get real user"
        # cleanup
        db.users.delete_one({"id": body["user"]["id"]})


# ============================================================
# FIX 1 — JWT session invalidation on password reset
# ============================================================

class TestJWTSessionInvalidation:
    def test_full_reset_invalidates_old_token(self, api_client, db):
        # Step 1: login → token A
        r = _login(api_client, TEST_EMAIL, ORIGINAL_PASSWORD)
        assert r.status_code == 200, f"initial login failed: {r.status_code} {r.text}"
        token_a = r.json()["access_token"]

        # /auth/me with token A → 200
        me_a = api_client.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token_a}"})
        assert me_a.status_code == 200, f"me with token A: {me_a.status_code}"

        # Step 2-3: forgot-password + reset with new password
        new_password = "NewSecret1"
        _reset_password_via_flow(api_client, db, TEST_EMAIL, new_password)

        # Step 4: /auth/me with token A → 401 with French message
        me_a2 = api_client.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token_a}"})
        assert me_a2.status_code == 401, f"expected 401 after reset, got {me_a2.status_code}"
        body = me_a2.json()
        detail = body.get("detail", "")
        assert "Session révoquée" in detail or "révoquée" in detail, f"detail={detail}"

        # Step 5: login with new password → 200, new token B accepted
        r_b = _login(api_client, TEST_EMAIL, new_password)
        assert r_b.status_code == 200
        token_b = r_b.json()["access_token"]
        assert token_b != token_a
        me_b = api_client.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token_b}"})
        assert me_b.status_code == 200

        # Step 6: Cleanup → reset back to Test1234!
        _reset_password_via_flow(api_client, db, TEST_EMAIL, ORIGINAL_PASSWORD)
        r_final = _login(api_client, TEST_EMAIL, ORIGINAL_PASSWORD)
        assert r_final.status_code == 200, "cleanup: login with restored password failed"

    def test_token_version_backfilled(self, db):
        # All users must have token_version field after startup
        missing = list(db.users.find({"token_version": {"$exists": False}}))
        assert len(missing) == 0, f"users missing token_version: {[m.get('email') for m in missing]}"


# ============================================================
# FIX 3 — PDF invoice escapes user fields
# ============================================================

class TestPDFInvoiceEscape:
    def test_admin_invoice_pdf_with_html_special_chars(self, api_client, db):
        # Login as admin
        r = _login(api_client, ADMIN_EMAIL, ADMIN_PASSWORD)
        assert r.status_code == 200
        admin_token = r.json()["access_token"]

        # Login as test user
        r = _login(api_client, TEST_EMAIL, ORIGINAL_PASSWORD)
        assert r.status_code == 200
        user_token = r.json()["access_token"]
        user_id = r.json()["user"]["id"]

        # Pick a product
        products = api_client.get(f"{API}/products").json()
        assert products, "no products available"
        p = products[0]
        # Order payload: items require product_id, name, unit, quantity
        # Fetch product schema by looking at product itself
        item = {
            "product_id": p["id"],
            "name": p["name"],
            "unit": p["unit"],
            "sell_unit": p.get("sell_unit", "kg"),
            "price": p.get("price_kg") or p.get("price") or 1.0,
            "quantity": 1,
        }
        # Some order schemas may vary — post minimal shape and inspect error if needed
        r = api_client.post(
            f"{API}/orders",
            headers={"Authorization": f"Bearer {user_token}"},
            json={
                "items": [item],
                "notes": "safe notes",
            },
        )
        if r.status_code not in (200, 201):
            pytest.skip(f"could not create order for PDF test: {r.status_code} {r.text[:200]}")
        order_id = r.json().get("id")
        assert order_id

        # Inject HTML/XML-special chars into order fields
        db.orders.update_one(
            {"id": order_id},
            {
                "$set": {
                    "company_name": "<b>ACME &amp; Co</b>",
                    "notes": "<script>alert(1)</script>",
                    "status": "En <preparation>",
                    "delivery_address": "1 & 2 <rue> \"test\"",
                }
            },
        )

        # Call admin invoice endpoint
        r = api_client.get(
            f"{API}/admin/orders/{order_id}/invoice",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert r.status_code == 200, f"PDF status {r.status_code} body={r.text[:300]}"
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert r.content[:4] == b"%PDF", "PDF magic bytes not found"

        # Rollback / cleanup: delete this test order
        db.orders.delete_one({"id": order_id})


# ============================================================
# REGRESSION CHECKS
# ============================================================

class TestRegressions:
    def test_admin_login_still_works(self, api_client):
        r = _login(api_client, ADMIN_EMAIL, ADMIN_PASSWORD)
        assert r.status_code == 200
        body = r.json()
        assert body["user"]["role"] == "admin"

    def test_test_user_login_and_me(self, api_client):
        r = _login(api_client, TEST_EMAIL, ORIGINAL_PASSWORD)
        assert r.status_code == 200, f"cleanup verification: {r.status_code} {r.text}"
        token = r.json()["access_token"]
        me = api_client.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me.status_code == 200

    def test_orders_list(self, api_client):
        r = _login(api_client, TEST_EMAIL, ORIGINAL_PASSWORD)
        token = r.json()["access_token"]
        r = api_client.get(f"{API}/orders", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_order_habits(self, api_client):
        r = _login(api_client, TEST_EMAIL, ORIGINAL_PASSWORD)
        token = r.json()["access_token"]
        r = api_client.get(f"{API}/orders/habits", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200

    def test_admin_users_list(self, api_client):
        r = _login(api_client, ADMIN_EMAIL, ADMIN_PASSWORD)
        token = r.json()["access_token"]
        r = api_client.get(f"{API}/admin/users", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_rejected_user_cannot_login(self, api_client, db):
        # Create a rejected user, try to login, cleanup
        email = f"TEST_rejected_iter13_{int(time.time())}@example.com"
        siret = "77665544332" + str(int(time.time()))[-3:]
        r = api_client.post(
            f"{API}/auth/register",
            json={
                "company_name": "TEST Rejected",
                "siret": siret,
                "email": email,
                "phone": "+33600000001",
                "delivery_address": "somewhere",
                "password": "RejPass123!",
            },
        )
        assert r.status_code == 201
        uid = r.json()["user"]["id"]
        db.users.update_one({"id": uid}, {"$set": {"status": "rejected"}})
        # Try login
        r = api_client.post(f"{API}/auth/login", json={"email": email, "password": "RejPass123!"})
        assert r.status_code == 403
        # Cleanup
        db.users.delete_one({"id": uid})


# ============================================================
# FINAL CLEANUP — ensure test@leray.fr password is Test1234!
# ============================================================

def test_zz_final_cleanup_password(api_client, db):
    """Runs last (alphabetical) — ensure test@leray.fr password restored."""
    r = _login(api_client, TEST_EMAIL, ORIGINAL_PASSWORD)
    if r.status_code != 200:
        _reset_password_via_flow(api_client, db, TEST_EMAIL, ORIGINAL_PASSWORD)
        r = _login(api_client, TEST_EMAIL, ORIGINAL_PASSWORD)
    assert r.status_code == 200, "final cleanup: test@leray.fr password not Test1234!"
    # Cleanup all TEST_ users
    db.users.delete_many({"email": {"$regex": "^TEST_"}})
