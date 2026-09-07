"""Iteration 11 — Automated email-based password reset tests.

Covers:
 - POST /api/auth/forgot-password (202 always, non-enumerating, admin skip, invalidation of prior tokens)
 - POST /api/auth/reset-password (200 success, 400 for invalid/used/expired tokens with French messages)
 - Removal of admin-mediated /api/admin/password-resets endpoints
 - Cleanup / restore of test user password
"""
from __future__ import annotations

import os
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


# --------------------------- FORGOT PASSWORD ---------------------------

class TestForgotPassword:
    def test_unknown_email_returns_202_and_creates_no_token(self, api_client, db):
        before = db.password_reset_tokens.count_documents({"email": "nobody@example.com"})
        r = api_client.post(f"{API}/auth/forgot-password", json={"email": "nobody@example.com"})
        assert r.status_code == 202, r.text
        assert r.json() == {"ok": True}
        after = db.password_reset_tokens.count_documents({"email": "nobody@example.com"})
        assert after == before, "No token document should be created for an unknown email"

    def test_existing_user_creates_unused_token_with_2h_ttl(self, api_client, db):
        # Clean previous tokens for this email to have a clean state
        db.password_reset_tokens.delete_many({"email": TEST_EMAIL})
        r = api_client.post(f"{API}/auth/forgot-password", json={"email": TEST_EMAIL})
        assert r.status_code == 202, r.text
        assert r.json() == {"ok": True}

        docs = list(db.password_reset_tokens.find({"email": TEST_EMAIL}))
        assert len(docs) == 1
        d = docs[0]
        assert d["used"] is False
        assert "token" in d and len(d["token"]) >= 16
        # TTL roughly 2h
        exp = datetime.fromisoformat(d["expires_at"])
        now = datetime.now(timezone.utc)
        delta = exp - now
        assert timedelta(hours=1, minutes=45) < delta < timedelta(hours=2, minutes=15), delta

    def test_second_call_invalidates_first_token(self, api_client, db):
        r = api_client.post(f"{API}/auth/forgot-password", json={"email": TEST_EMAIL})
        assert r.status_code == 202
        unused = list(db.password_reset_tokens.find({"email": TEST_EMAIL, "used": False}))
        assert len(unused) == 1, f"Expected exactly 1 unused token, got {len(unused)}"
        used = list(db.password_reset_tokens.find({"email": TEST_EMAIL, "used": True}))
        assert len(used) >= 1

    def test_admin_forgot_creates_no_token(self, api_client, db):
        before = db.password_reset_tokens.count_documents({"email": ADMIN_EMAIL})
        r = api_client.post(f"{API}/auth/forgot-password", json={"email": ADMIN_EMAIL})
        assert r.status_code == 202
        after = db.password_reset_tokens.count_documents({"email": ADMIN_EMAIL})
        assert after == before, "Admin must not be resettable via public forgot flow"


# --------------------------- RESET PASSWORD ---------------------------

class TestResetPassword:
    def test_bogus_token_returns_400_french(self, api_client):
        r = api_client.post(f"{API}/auth/reset-password", json={"token": "abogusonebogus1234567", "password": "NewPass1!"})
        assert r.status_code == 400
        assert "invalide" in r.json()["detail"].lower() or "utilisé" in r.json()["detail"].lower()

    def test_reset_success_then_login_new_then_old_fails(self, api_client, db):
        # Ensure a fresh unused token exists
        db.password_reset_tokens.delete_many({"email": TEST_EMAIL})
        api_client.post(f"{API}/auth/forgot-password", json={"email": TEST_EMAIL})
        doc = db.password_reset_tokens.find_one({"email": TEST_EMAIL, "used": False})
        assert doc is not None
        token = doc["token"]

        new_pw = "NewPass1!"
        r = api_client.post(f"{API}/auth/reset-password", json={"token": token, "password": new_pw})
        assert r.status_code == 200, r.text
        assert r.json() == {"ok": True}

        # New password logs in
        r = api_client.post(f"{API}/auth/login", json={"email": TEST_EMAIL, "password": new_pw})
        assert r.status_code == 200, r.text
        # Old password fails
        r = api_client.post(f"{API}/auth/login", json={"email": TEST_EMAIL, "password": ORIGINAL_PASSWORD})
        assert r.status_code == 401

    def test_reuse_of_used_token_returns_400(self, api_client, db):
        doc = db.password_reset_tokens.find_one({"email": TEST_EMAIL, "used": True})
        assert doc is not None
        r = api_client.post(f"{API}/auth/reset-password", json={"token": doc["token"], "password": "AnotherPass1!"})
        assert r.status_code == 400
        detail = r.json()["detail"].lower()
        assert "invalide" in detail or "utilisé" in detail

    def test_expired_token_returns_400_french(self, api_client, db):
        # Generate a fresh token
        db.password_reset_tokens.delete_many({"email": TEST_EMAIL, "used": False})
        api_client.post(f"{API}/auth/forgot-password", json={"email": TEST_EMAIL})
        doc = db.password_reset_tokens.find_one({"email": TEST_EMAIL, "used": False})
        assert doc is not None

        # Force expiration in the past
        past = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
        db.password_reset_tokens.update_one({"token": doc["token"]}, {"$set": {"expires_at": past}})

        r = api_client.post(f"{API}/auth/reset-password", json={"token": doc["token"], "password": "AnotherPass1!"})
        assert r.status_code == 400
        assert "expir" in r.json()["detail"].lower()


# --------------------------- ADMIN ENDPOINTS REMOVED ---------------------------

class TestAdminResetsRemoved:
    def test_get_admin_password_resets_removed(self, api_client):
        # Need admin token or not — since route is REMOVED, we expect 404 without auth (path not found)
        # If it required auth first, we'd get 401. So try with admin token to be sure.
        login = api_client.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "Loic76930@"}).json()
        token = login.get("token") or login.get("access_token")
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        r = api_client.get(f"{API}/admin/password-resets", headers=headers)
        assert r.status_code == 404, f"Expected 404, got {r.status_code} {r.text}"

    def test_post_apply_removed(self, api_client):
        login = api_client.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "Loic76930@"}).json()
        token = login.get("token") or login.get("access_token")
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        r = api_client.post(f"{API}/admin/password-resets/anything/apply", headers=headers, json={"password": "x"})
        assert r.status_code in (404, 405), f"Expected 404/405, got {r.status_code}"


# --------------------------- CLEANUP: restore Test1234! ---------------------------

class TestCleanup:
    def test_restore_test_user_password(self, api_client, db):
        db.password_reset_tokens.delete_many({"email": TEST_EMAIL, "used": False})
        r = api_client.post(f"{API}/auth/forgot-password", json={"email": TEST_EMAIL})
        assert r.status_code == 202
        doc = db.password_reset_tokens.find_one({"email": TEST_EMAIL, "used": False})
        assert doc is not None
        r = api_client.post(f"{API}/auth/reset-password", json={"token": doc["token"], "password": ORIGINAL_PASSWORD})
        assert r.status_code == 200
        # Verify login
        r = api_client.post(f"{API}/auth/login", json={"email": TEST_EMAIL, "password": ORIGINAL_PASSWORD})
        assert r.status_code == 200
