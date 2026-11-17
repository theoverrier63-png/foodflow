"""Iteration 12 backend tests — Orders filter, orders-latest polling, business users management."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://web-only-app-3--48bbr5e0.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "sarl.leraypointel@orange.fr"
ADMIN_PASSWORD = "Loic76930@"
TEST_BIZ_EMAIL = "test@leray.fr"
TEST_BIZ_PASSWORD = "Test1234!"


# ---------- fixtures ----------

@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def biz_token():
    r = requests.post(f"{API}/auth/login", json={"email": TEST_BIZ_EMAIL, "password": TEST_BIZ_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def biz_headers(biz_token):
    return {"Authorization": f"Bearer {biz_token}"}


def _rand_siret():
    import random
    return "".join(str(random.randint(0, 9)) for _ in range(14))


# ---------- Orders filter (Pro/Particulier) ----------

class TestOrdersFilter:
    def test_admin_orders_all_have_account_type(self, admin_headers):
        r = requests.get(f"{API}/admin/orders", headers=admin_headers)
        assert r.status_code == 200
        docs = r.json()
        assert isinstance(docs, list)
        for o in docs:
            assert "account_type" in o
            assert o["account_type"] in ("business", "personal"), f"bad account_type={o.get('account_type')}"

    def test_admin_orders_filter_business(self, admin_headers):
        r = requests.get(f"{API}/admin/orders", params={"account_type": "business"}, headers=admin_headers)
        assert r.status_code == 200
        for o in r.json():
            assert o["account_type"] == "business"

    def test_admin_orders_filter_personal(self, admin_headers):
        r = requests.get(f"{API}/admin/orders", params={"account_type": "personal"}, headers=admin_headers)
        assert r.status_code == 200
        for o in r.json():
            assert o["account_type"] == "personal"

    def test_admin_orders_filter_nonsense_returns_all(self, admin_headers):
        r_all = requests.get(f"{API}/admin/orders", headers=admin_headers)
        r_bad = requests.get(f"{API}/admin/orders", params={"account_type": "nonsense"}, headers=admin_headers)
        assert r_bad.status_code == 200
        assert len(r_bad.json()) == len(r_all.json())

    def test_personal_user_creates_personal_order(self, admin_headers):
        # register personal user
        email = f"personal-{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{API}/auth/register-personal", json={
            "full_name": "TEST Personne",
            "email": email,
            "phone": "+33600000000",
            "delivery_address": "1 rue Test, 75001 Paris",
            "password": "Passw0rd!",
        })
        assert r.status_code == 201, r.text
        p_token = r.json()["access_token"]
        p_user_id = r.json()["user"]["id"]
        assert r.json()["user"]["account_type"] == "personal"

        # pick a product to order
        pr = requests.get(f"{API}/products")
        assert pr.status_code == 200
        products = pr.json()
        assert len(products) > 0
        product = products[0]

        item = {
            "product_id": product["id"],
            "name": product["name"],
            "unit": product["unit"],
            "sell_unit": product.get("sell_unit", "piece"),
            "price": product["price"],
            "quantity": 1,
        }
        ro = requests.post(
            f"{API}/orders",
            headers={"Authorization": f"Bearer {p_token}"},
            json={"items": [item], "notes": "TEST personal order"},
        )
        assert ro.status_code == 201, ro.text
        order = ro.json()
        assert order["account_type"] == "personal"

        # confirm shows up in personal filter
        rf = requests.get(f"{API}/admin/orders", params={"account_type": "personal"}, headers=admin_headers)
        assert rf.status_code == 200
        ids = [o["id"] for o in rf.json()]
        assert order["id"] in ids

        # confirm not present in business filter
        rb = requests.get(f"{API}/admin/orders", params={"account_type": "business"}, headers=admin_headers)
        assert order["id"] not in [o["id"] for o in rb.json()]

        # cleanup: delete personal user (also anonymizes order)
        rd = requests.delete(f"{API}/admin/users/{p_user_id}", headers=admin_headers)
        assert rd.status_code == 204


# ---------- Orders-latest / polling ----------

class TestOrdersLatest:
    def test_admin_orders_latest_shape(self, admin_headers):
        r = requests.get(f"{API}/admin/orders-latest", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert "latest_created_at" in data
        assert "total" in data
        assert isinstance(data["total"], int)

    def test_admin_orders_latest_matches_orders(self, admin_headers):
        r = requests.get(f"{API}/admin/orders-latest", headers=admin_headers)
        latest_ts = r.json()["latest_created_at"]
        total = r.json()["total"]

        r_all = requests.get(f"{API}/admin/orders", headers=admin_headers)
        docs = r_all.json()
        assert len(docs) == total or total >= len(docs)  # /admin/orders limits to 1000
        if docs:
            newest = max(o["created_at"] for o in docs)
            assert latest_ts == newest

    def test_non_admin_orders_latest_forbidden(self, biz_headers):
        r = requests.get(f"{API}/admin/orders-latest", headers=biz_headers)
        assert r.status_code == 403

    def test_no_auth_orders_latest(self):
        r = requests.get(f"{API}/admin/orders-latest")
        assert r.status_code in (401, 403)


# ---------- Business users management ----------

class TestBusinessUsersAdmin:
    def test_admin_users_list_shape(self, admin_headers):
        r = requests.get(f"{API}/admin/users", headers=admin_headers)
        assert r.status_code == 200, r.text
        docs = r.json()
        assert isinstance(docs, list)
        assert len(docs) >= 1
        for u in docs:
            assert u["account_type"] == "business"
            assert u.get("role") != "admin"
            for k in ("id", "company_name", "siret", "email", "phone", "delivery_address", "status", "created_at"):
                assert k in u, f"missing {k} in {u}"

    def test_admin_users_excludes_personal(self, admin_headers):
        # create a personal, verify it's not in the list
        email = f"personal2-{uuid.uuid4().hex[:8]}@example.com"
        rp = requests.post(f"{API}/auth/register-personal", json={
            "full_name": "TEST Personne2",
            "email": email,
            "phone": "+33600000000",
            "delivery_address": "2 rue Test, 75002 Paris",
            "password": "Passw0rd!",
        })
        assert rp.status_code == 201
        personal_id = rp.json()["user"]["id"]

        r = requests.get(f"{API}/admin/users", headers=admin_headers)
        ids = [u["id"] for u in r.json()]
        assert personal_id not in ids

        # cleanup
        requests.delete(f"{API}/admin/users/{personal_id}", headers=admin_headers)

    def test_non_admin_users_forbidden(self, biz_headers):
        r = requests.get(f"{API}/admin/users", headers=biz_headers)
        assert r.status_code == 403

    def test_revoke_and_restore_business_user(self, admin_headers):
        # register a new pending business user
        email = f"bizrevoke-{uuid.uuid4().hex[:8]}@example.com"
        pw = "Passw0rd!"
        rr = requests.post(f"{API}/auth/register", json={
            "company_name": "TEST Revoke",
            "siret": _rand_siret(),
            "email": email,
            "phone": "+33600000001",
            "delivery_address": "3 rue Test, 75003 Paris",
            "password": pw,
        })
        assert rr.status_code == 201, rr.text
        user_id = rr.json()["user"]["id"]

        # approve
        ap = requests.post(f"{API}/admin/pending/{user_id}/approve", headers=admin_headers)
        assert ap.status_code == 200, ap.text

        # verify login works
        lg = requests.post(f"{API}/auth/login", json={"email": email, "password": pw})
        assert lg.status_code == 200

        # revoke
        rv = requests.post(f"{API}/admin/users/{user_id}/revoke", headers=admin_headers)
        assert rv.status_code == 200
        assert rv.json()["status"] == "rejected"

        # NOTE: login endpoint does NOT check status per code (line 562-567). Placing an order should fail.
        lg2 = requests.post(f"{API}/auth/login", json={"email": email, "password": pw})
        # attempt to place an order should fail w/ 403 "En attente" message
        if lg2.status_code == 200:
            rev_token = lg2.json()["access_token"]
            pr = requests.get(f"{API}/products").json()
            product = pr[0]
            item = {
                "product_id": product["id"], "name": product["name"], "unit": product["unit"],
                "sell_unit": product.get("sell_unit", "piece"), "price": product["price"], "quantity": 1,
            }
            ro = requests.post(f"{API}/orders", headers={"Authorization": f"Bearer {rev_token}"},
                               json={"items": [item], "notes": ""})
            assert ro.status_code == 403
            assert "en attente" in ro.json().get("detail", "").lower()

        # restore
        rs = requests.post(f"{API}/admin/users/{user_id}/restore", headers=admin_headers)
        assert rs.status_code == 200
        assert rs.json()["status"] == "approved"

        # login works again
        lg3 = requests.post(f"{API}/auth/login", json={"email": email, "password": pw})
        assert lg3.status_code == 200

        # cleanup
        requests.delete(f"{API}/admin/users/{user_id}", headers=admin_headers)

    def test_revoke_admin_returns_404(self, admin_headers):
        # find admin id
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        admin_id = r.json()["user"]["id"]
        rv = requests.post(f"{API}/admin/users/{admin_id}/revoke", headers=admin_headers)
        assert rv.status_code == 404

    def test_delete_business_user_anonymizes_orders(self, admin_headers):
        # register + approve
        email = f"bizdel-{uuid.uuid4().hex[:8]}@example.com"
        pw = "Passw0rd!"
        rr = requests.post(f"{API}/auth/register", json={
            "company_name": "TEST À Supprimer",
            "siret": _rand_siret(),
            "email": email,
            "phone": "+33600000002",
            "delivery_address": "9 rue Test, 75009 Paris",
            "password": pw,
        })
        assert rr.status_code == 201, rr.text
        user_id = rr.json()["user"]["id"]

        ap = requests.post(f"{API}/admin/pending/{user_id}/approve", headers=admin_headers)
        assert ap.status_code == 200

        # place an order
        lg = requests.post(f"{API}/auth/login", json={"email": email, "password": pw})
        u_token = lg.json()["access_token"]
        pr = requests.get(f"{API}/products").json()
        product = pr[0]
        item = {
            "product_id": product["id"], "name": product["name"], "unit": product["unit"],
            "sell_unit": product.get("sell_unit", "piece"), "price": product["price"], "quantity": 2,
        }
        ro = requests.post(f"{API}/orders", headers={"Authorization": f"Bearer {u_token}"},
                           json={"items": [item], "notes": "TEST to be anonymized"})
        assert ro.status_code == 201
        order_id = ro.json()["id"]

        # delete
        rd = requests.delete(f"{API}/admin/users/{user_id}", headers=admin_headers)
        assert rd.status_code == 204

        # verify user gone from list
        rl = requests.get(f"{API}/admin/users", headers=admin_headers)
        assert user_id not in [u["id"] for u in rl.json()]

        # verify order still present w/ anonymized fields
        ol = requests.get(f"{API}/admin/orders", headers=admin_headers)
        matched = [o for o in ol.json() if o["id"] == order_id]
        assert len(matched) == 1
        assert matched[0]["company_name"] == "Compte supprimé"
        assert matched[0]["delivery_address"] == "—"

    def test_delete_admin_returns_404(self, admin_headers):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        admin_id = r.json()["user"]["id"]
        rd = requests.delete(f"{API}/admin/users/{admin_id}", headers=admin_headers)
        assert rd.status_code == 404
