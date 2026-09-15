"""Iteration 14: Activer / Retirer de la vente (is_active toggle)."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://foodflow-145.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "sarl.leraypointel@orange.fr"
ADMIN_PASSWORD = "Loic76930@"
BUSINESS_EMAIL = "test@leray.fr"
BUSINESS_PASSWORD = "Test1234!"


# ---------- Session / auth fixtures ----------
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def business_token():
    r = requests.post(f"{API}/auth/login", json={"email": BUSINESS_EMAIL, "password": BUSINESS_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"Business login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


def hdr(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ---------- 1) Admin list endpoint ----------
class TestAdminList:
    def test_admin_products_returns_all_with_is_active(self, admin_token):
        r = requests.get(f"{API}/admin/products", headers=hdr(admin_token), timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) > 0
        for p in data:
            assert "is_active" in p, f"Missing is_active on product {p.get('id')}"
            assert isinstance(p["is_active"], bool)
        # sorted alphabetically
        names = [p["name"] for p in data]
        assert names == sorted(names, key=lambda s: s), "Not sorted alphabetically"

    def test_admin_products_denies_business(self, business_token):
        r = requests.get(f"{API}/admin/products", headers=hdr(business_token), timeout=15)
        assert r.status_code == 403

    def test_admin_products_denies_anonymous(self):
        r = requests.get(f"{API}/admin/products", timeout=15)
        assert r.status_code in (401, 403)


# ---------- 2-4, 7) Toggle flow ----------
class TestToggleFlow:
    def test_toggle_and_public_filter(self, admin_token):
        # Get admin products (all)
        r = requests.get(f"{API}/admin/products", headers=hdr(admin_token), timeout=15)
        assert r.status_code == 200
        products = r.json()
        # pick a product currently active
        target = next((p for p in products if p.get("is_active", True)), None)
        assert target, "No active product available"
        pid = target["id"]

        try:
            # PATCH off
            r = requests.patch(f"{API}/admin/products/{pid}/active", headers=hdr(admin_token), json={"is_active": False}, timeout=15)
            assert r.status_code == 200, r.text
            body = r.json()
            assert body["is_active"] is False
            assert body["id"] == pid
            assert "_id" not in body  # ensure Mongo _id stripped

            # public /products must NOT include it
            pub = requests.get(f"{API}/products", timeout=15).json()
            assert all(p["id"] != pid for p in pub), "Deactivated product leaked into /products"

            # admin still sees it
            adm = requests.get(f"{API}/admin/products", headers=hdr(admin_token), timeout=15).json()
            found = next((p for p in adm if p["id"] == pid), None)
            assert found is not None and found["is_active"] is False

            # PATCH back on
            r = requests.patch(f"{API}/admin/products/{pid}/active", headers=hdr(admin_token), json={"is_active": True}, timeout=15)
            assert r.status_code == 200
            assert r.json()["is_active"] is True

            # public sees it again
            pub2 = requests.get(f"{API}/products", timeout=15).json()
            assert any(p["id"] == pid for p in pub2), "Reactivated product missing from /products"
        finally:
            # cleanup: ensure back to active
            requests.patch(f"{API}/admin/products/{pid}/active", headers=hdr(admin_token), json={"is_active": True}, timeout=15)


# ---------- 5) Subcategories filter ----------
class TestSubcategoriesFilter:
    def test_subcategory_hidden_when_only_product_inactive(self, admin_token):
        # Create a product with a unique subcategory
        unique_sub = f"TEST_SUB_{uuid.uuid4().hex[:8]}"
        payload = {
            "name": f"TEST_ActiveToggle_{uuid.uuid4().hex[:6]}",
            "category": "Légumes",
            "subcategory": unique_sub,
            "origin": "France",
            "unit": "1 kg",
            "price_kg": 3.5,
            "season": "all",
            "image_url": "https://example.com/img.png",
            "description": "TEST product for is_active subcategory filter",
        }
        r = requests.post(f"{API}/admin/products", headers=hdr(admin_token), json=payload, timeout=15)
        assert r.status_code == 201, r.text
        prod = r.json()
        pid = prod["id"]
        assert prod["is_active"] is True  # test 9

        try:
            # subcategory visible now
            sub_pub = requests.get(f"{API}/products/subcategories", timeout=15).json()
            all_subs = {s for lst in sub_pub.get("by_category", {}).values() for s in lst}
            assert unique_sub in all_subs, "Subcategory should be present when product active"

            # Deactivate
            r = requests.patch(f"{API}/admin/products/{pid}/active", headers=hdr(admin_token), json={"is_active": False}, timeout=15)
            assert r.status_code == 200

            # subcategory should vanish (only inactive product owned it)
            sub_pub2 = requests.get(f"{API}/products/subcategories", timeout=15).json()
            all_subs2 = {s for lst in sub_pub2.get("by_category", {}).values() for s in lst}
            assert unique_sub not in all_subs2, "Deactivated product's unique subcategory leaked"
        finally:
            requests.delete(f"{API}/admin/products/{pid}", headers=hdr(admin_token), timeout=15)


# ---------- 6) Order habits filter ----------
class TestOrderHabits:
    def test_habits_hides_inactive(self, admin_token, business_token):
        # Create a temp product, order it as business, then deactivate.
        payload = {
            "name": f"TEST_HabitToggle_{uuid.uuid4().hex[:6]}",
            "category": "Légumes",
            "origin": "France",
            "unit": "1 kg",
            "price_kg": 2.0,
            "season": "all",
            "image_url": "https://example.com/i.png",
            "description": "TEST habit product",
        }
        r = requests.post(f"{API}/admin/products", headers=hdr(admin_token), json=payload, timeout=15)
        assert r.status_code == 201
        prod = r.json()
        pid = prod["id"]

        try:
            # Business places an order containing it
            cart_item = {
                "product_id": pid,
                "name": prod["name"],
                "unit": prod["unit"],
                "sell_unit": prod["sell_unit"],
                "price": prod["price"],
                "quantity": 1,
            }
            r_ord = requests.post(f"{API}/orders", headers=hdr(business_token), json={"items": [cart_item], "notes": "TEST"}, timeout=15)
            assert r_ord.status_code in (200, 201), r_ord.text

            # habits should include it
            h = requests.get(f"{API}/orders/habits?limit=50", headers=hdr(business_token), timeout=15).json()
            assert any(p["id"] == pid for p in h), "New product missing from habits"

            # Deactivate
            requests.patch(f"{API}/admin/products/{pid}/active", headers=hdr(admin_token), json={"is_active": False}, timeout=15)

            # habits should now exclude it
            h2 = requests.get(f"{API}/orders/habits?limit=50", headers=hdr(business_token), timeout=15).json()
            assert all(p["id"] != pid for p in h2), "Deactivated product leaked into /orders/habits"
        finally:
            requests.delete(f"{API}/admin/products/{pid}", headers=hdr(admin_token), timeout=15)


# ---------- 8) PUT preserves is_active ----------
class TestPutPreserves:
    def test_put_preserves_is_active(self, admin_token):
        # create a fresh product
        payload = {
            "name": f"TEST_Preserve_{uuid.uuid4().hex[:6]}",
            "category": "Légumes",
            "origin": "France",
            "unit": "1 kg",
            "price_kg": 2.5,
            "season": "all",
            "image_url": "https://example.com/i.png",
            "description": "TEST preserve",
        }
        r = requests.post(f"{API}/admin/products", headers=hdr(admin_token), json=payload, timeout=15)
        assert r.status_code == 201
        pid = r.json()["id"]

        try:
            # Deactivate
            r = requests.patch(f"{API}/admin/products/{pid}/active", headers=hdr(admin_token), json={"is_active": False}, timeout=15)
            assert r.status_code == 200 and r.json()["is_active"] is False

            # PUT with same ProductIn fields (no is_active). Should preserve inactive.
            update = {**payload, "description": "TEST preserve UPDATED"}
            r = requests.put(f"{API}/admin/products/{pid}", headers=hdr(admin_token), json=update, timeout=15)
            assert r.status_code == 200, r.text
            body = r.json()
            assert body["is_active"] is False, "PUT overwrote is_active flag"
            assert body["description"] == "TEST preserve UPDATED"

            # flip back to true via PATCH
            r = requests.patch(f"{API}/admin/products/{pid}/active", headers=hdr(admin_token), json={"is_active": True}, timeout=15)
            assert r.status_code == 200 and r.json()["is_active"] is True
        finally:
            requests.delete(f"{API}/admin/products/{pid}", headers=hdr(admin_token), timeout=15)


# ---------- 10) 404 on unknown ----------
class TestNotFound:
    def test_toggle_unknown_returns_404(self, admin_token):
        r = requests.patch(f"{API}/admin/products/does-not-exist/active", headers=hdr(admin_token), json={"is_active": True}, timeout=15)
        assert r.status_code == 404

    def test_toggle_denies_business(self, business_token, admin_token):
        # Pick some real id
        adm = requests.get(f"{API}/admin/products", headers=hdr(admin_token), timeout=15).json()
        pid = adm[0]["id"]
        r = requests.patch(f"{API}/admin/products/{pid}/active", headers=hdr(business_token), json={"is_active": False}, timeout=15)
        assert r.status_code == 403


# ---------- 11) Final cleanup — ensure every product is active ----------
class TestCleanup:
    def test_zzz_final_reactivate_all(self, admin_token):
        adm = requests.get(f"{API}/admin/products", headers=hdr(admin_token), timeout=15).json()
        for p in adm:
            if not p.get("is_active", True):
                requests.patch(f"{API}/admin/products/{p['id']}/active", headers=hdr(admin_token), json={"is_active": True}, timeout=15)
        # verify
        adm2 = requests.get(f"{API}/admin/products", headers=hdr(admin_token), timeout=15).json()
        assert all(p.get("is_active", True) for p in adm2)
