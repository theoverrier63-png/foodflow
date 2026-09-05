"""Iteration 5 backend tests: personal register, business pending flow, admin pending, banner."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://foodflow-145.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "sarl.leraypointel@orange.fr"
ADMIN_PASSWORD = "Loic76930@"
CLIENT_EMAIL = "test@leray.fr"
CLIENT_PASSWORD = "Test1234!"


@pytest.fixture(scope="module")
def s():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def admin_token(s):
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def client_token(s):
    r = s.post(f"{API}/auth/login", json={"email": CLIENT_EMAIL, "password": CLIENT_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


# ============================== 1) Personal register ==============================

def test_register_personal_creates_approved_account(s):
    unique = uuid.uuid4().hex[:10]
    payload = {
        "full_name": f"TEST Personal {unique}",
        "email": f"test_pers_{unique}@leray.fr",
        "phone": "+33600000000",
        "delivery_address": "10 rue Personnelle, 75010 Paris",
        "password": "Passw0rd!",
    }
    r = s.post(f"{API}/auth/register-personal", json=payload)
    assert r.status_code == 201, r.text
    data = r.json()
    assert "access_token" in data
    u = data["user"]
    assert u["email"] == payload["email"]
    assert u["account_type"] == "personal"
    assert u["status"] == "approved"
    assert u["siret"] == ""

    # can immediately place an order
    products = s.get(f"{API}/products").json()
    p = products[0]
    items = [{"product_id": p["id"], "name": p["name"], "unit": p["unit"],
              "sell_unit": p.get("sell_unit", "kg"), "price": p["price"], "quantity": 1}]
    r2 = s.post(f"{API}/orders", json={"items": items, "notes": "TEST personal"},
                headers={"Authorization": f"Bearer {data['access_token']}"})
    assert r2.status_code == 201, r2.text


def test_register_personal_missing_fields_422(s):
    r = s.post(f"{API}/auth/register-personal", json={"email": "bad@x.fr"})
    assert r.status_code == 422


def test_register_personal_invalid_email_422(s):
    r = s.post(f"{API}/auth/register-personal", json={
        "full_name": "X", "email": "not-an-email", "phone": "+33600000000",
        "delivery_address": "10 rue", "password": "Passw0rd!",
    })
    assert r.status_code == 422


def test_register_personal_duplicate_email_409(s):
    unique = uuid.uuid4().hex[:8]
    email = f"test_pd_{unique}@leray.fr"
    payload = {"full_name": "Dup", "email": email, "phone": "+33600000000",
               "delivery_address": "10 rue", "password": "Passw0rd!"}
    r1 = s.post(f"{API}/auth/register-personal", json=payload)
    assert r1.status_code == 201
    r2 = s.post(f"{API}/auth/register-personal", json=payload)
    assert r2.status_code == 409


# ============================== 2) Business register → pending ==============================

@pytest.fixture(scope="module")
def pending_business(s):
    unique = uuid.uuid4().hex[:10]
    siret = "".join([str((int(unique[i % len(unique)], 16) + i) % 10) for i in range(14)])
    payload = {
        "company_name": f"TEST Pending {unique}",
        "siret": siret,
        "email": f"test_pend_{unique}@leray.fr",
        "phone": "+33600000000",
        "delivery_address": "5 rue Pending, 75000 Paris",
        "password": "Passw0rd!",
    }
    r = s.post(f"{API}/auth/register", json=payload)
    assert r.status_code == 201, r.text
    d = r.json()
    return {"token": d["access_token"], "user": d["user"], "email": payload["email"]}


def test_business_register_is_pending(pending_business):
    u = pending_business["user"]
    assert u["account_type"] == "business"
    assert u["status"] == "pending"


def test_pending_business_cannot_order(s, pending_business):
    products = s.get(f"{API}/products").json()
    p = products[0]
    items = [{"product_id": p["id"], "name": p["name"], "unit": p["unit"],
              "sell_unit": p.get("sell_unit", "kg"), "price": p["price"], "quantity": 1}]
    r = s.post(f"{API}/orders", json={"items": items, "notes": "TEST pending"},
               headers={"Authorization": f"Bearer {pending_business['token']}"})
    assert r.status_code == 403, r.text
    body = r.json()
    detail = body.get("detail", "")
    assert "attente" in detail.lower() or "validation" in detail.lower(), body


# ============================== 3) Admin pending endpoints ==============================

def test_admin_pending_lists_business_pending(s, admin_token, pending_business):
    r = s.get(f"{API}/admin/pending", headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, list)
    emails = [u["email"] for u in data]
    assert pending_business["email"] in emails
    for u in data:
        assert u["account_type"] == "business"
        assert u["status"] == "pending"


def test_admin_pending_forbidden_for_non_admin(s, client_token):
    r = s.get(f"{API}/admin/pending", headers={"Authorization": f"Bearer {client_token}"})
    assert r.status_code == 403


def test_admin_approve_then_order_ok(s, admin_token, pending_business):
    uid = pending_business["user"]["id"]
    r = s.post(f"{API}/admin/pending/{uid}/approve",
               headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "approved"

    products = s.get(f"{API}/products").json()
    p = products[0]
    items = [{"product_id": p["id"], "name": p["name"], "unit": p["unit"],
              "sell_unit": p.get("sell_unit", "kg"), "price": p["price"], "quantity": 1}]
    r2 = s.post(f"{API}/orders", json={"items": items, "notes": "TEST approved"},
                headers={"Authorization": f"Bearer {pending_business['token']}"})
    assert r2.status_code == 201, r2.text


def test_admin_reject_flow(s, admin_token):
    unique = uuid.uuid4().hex[:10]
    siret = "".join([str((int(unique[i % len(unique)], 16) + i) % 10) for i in range(14)])
    r = s.post(f"{API}/auth/register", json={
        "company_name": f"TEST Reject {unique}",
        "siret": siret,
        "email": f"test_rej_{unique}@leray.fr",
        "phone": "+33600000000",
        "delivery_address": "5 rue Rej", "password": "Passw0rd!",
    })
    assert r.status_code == 201
    uid = r.json()["user"]["id"]
    r2 = s.post(f"{API}/admin/pending/{uid}/reject",
                headers={"Authorization": f"Bearer {admin_token}"})
    assert r2.status_code == 200
    assert r2.json()["status"] == "rejected"


def test_admin_approve_unknown_returns_404(s, admin_token):
    r = s.post(f"{API}/admin/pending/nonexistent-id/approve",
               headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 404


# ============================== 4) Banner endpoints ==============================

def test_banner_get_default(s, admin_token):
    # Clean first
    s.delete(f"{API}/admin/banner", headers={"Authorization": f"Bearer {admin_token}"})
    r = s.get(f"{API}/banner")
    assert r.status_code == 200
    assert r.json() == {"image_url": None}


def test_banner_put_and_delete(s, admin_token):
    data_url = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgAAIAAAUAAeImBZsAAAAASUVORK5CYII="
    r = s.put(f"{API}/admin/banner", json={"image_url": data_url},
              headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200, r.text
    assert r.json()["image_url"] == data_url

    r2 = s.get(f"{API}/banner")
    assert r2.status_code == 200
    assert r2.json()["image_url"] == data_url

    r3 = s.delete(f"{API}/admin/banner", headers={"Authorization": f"Bearer {admin_token}"})
    assert r3.status_code == 204
    r4 = s.get(f"{API}/banner")
    assert r4.json()["image_url"] is None


def test_banner_put_forbidden_for_non_admin(s, client_token):
    r = s.put(f"{API}/admin/banner", json={"image_url": "data:image/png;base64,AAA"},
              headers={"Authorization": f"Bearer {client_token}"})
    assert r.status_code == 403
