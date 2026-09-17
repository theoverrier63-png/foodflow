"""Iteration 15: All product prices are now optional."""
import os
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
ADMIN_EMAIL = "sarl.leraypointel@orange.fr"
ADMIN_PASSWORD = "Loic76930@"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def created_product_id(admin_headers):
    # Track a product ID across tests
    return {"id": None}


class TestOptionalPrices:
    """Verify prices are optional across create/update flows."""

    def test_01_create_product_without_any_price(self, admin_headers, created_product_id):
        payload = {
            "name": "TEST No-Price",
            "category": "Fruits",
            "origin": "France",
            "unit": "Colis",
            "image_url": "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=600",
            "description": "",
            "season": "all",
        }
        r = requests.post(f"{BASE_URL}/api/admin/products",
                          json=payload, headers=admin_headers)
        assert r.status_code == 201, f"expected 201, got {r.status_code}: {r.text}"
        data = r.json()
        assert data["sell_unit"] == "piece", data
        assert data["price"] == 0.0, data
        assert data["price_kg"] is None, data
        assert data["price_piece"] is None, data
        assert data["price_kg_ttc"] is None, data
        assert data["price_piece_ttc"] is None, data
        assert data["is_active"] is True, data
        created_product_id["id"] = data["id"]

    def test_02_public_get_products_returns_no_price_product(self, created_product_id):
        pid = created_product_id["id"]
        assert pid, "no product id from previous test"
        r = requests.get(f"{BASE_URL}/api/products")
        assert r.status_code == 200
        products = r.json()
        found = [p for p in products if p["id"] == pid]
        assert len(found) == 1, f"TEST No-Price should be listed publicly (only inactive hidden). ids={[p['id'] for p in products][:5]}"
        assert found[0]["price"] == 0.0
        assert found[0]["price_kg"] is None
        assert found[0]["price_piece"] is None

    def test_03_update_set_only_price_piece(self, admin_headers, created_product_id):
        pid = created_product_id["id"]
        payload = {
            "name": "TEST No-Price",
            "category": "Fruits",
            "origin": "France",
            "unit": "Colis",
            "image_url": "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=600",
            "description": "",
            "season": "all",
            "price_piece": 1.50,
        }
        r = requests.put(f"{BASE_URL}/api/admin/products/{pid}",
                         json=payload, headers=admin_headers)
        assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert data["sell_unit"] == "piece", data
        assert data["price"] == 1.50, data
        assert data["price_piece"] == 1.50, data
        assert data["price_kg"] is None, data

    def test_04_update_back_to_no_prices(self, admin_headers, created_product_id):
        pid = created_product_id["id"]
        payload = {
            "name": "TEST No-Price",
            "category": "Fruits",
            "origin": "France",
            "unit": "Colis",
            "image_url": "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=600",
            "description": "",
            "season": "all",
        }
        r = requests.put(f"{BASE_URL}/api/admin/products/{pid}",
                         json=payload, headers=admin_headers)
        assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert data["price"] == 0.0, data
        assert data["price_kg"] is None, data
        assert data["price_piece"] is None, data
        assert data["price_kg_ttc"] is None, data
        assert data["price_piece_ttc"] is None, data

    def test_05_only_kg_price_produces_kg_sell_unit(self, admin_headers):
        payload = {
            "name": "TEST No-Price-KG",
            "category": "Fruits",
            "origin": "France",
            "unit": "Colis",
            "image_url": "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=600",
            "description": "",
            "season": "all",
            "price_kg": 3.20,
        }
        r = requests.post(f"{BASE_URL}/api/admin/products",
                          json=payload, headers=admin_headers)
        assert r.status_code == 201, r.text
        data = r.json()
        assert data["sell_unit"] == "kg"
        assert data["price"] == 3.20
        assert data["price_kg"] == 3.20
        assert data["price_piece"] is None
        # cleanup this extra product
        requests.delete(f"{BASE_URL}/api/admin/products/{data['id']}", headers=admin_headers)

    def test_06_cagette_pieces_still_requires_price_piece(self, admin_headers):
        payload = {
            "name": "TEST Cagette No Piece Price",
            "category": "Fruits",
            "origin": "France",
            "unit": "Colis",
            "image_url": "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=600",
            "description": "",
            "season": "all",
            "cagette_content_pieces": 24,
        }
        r = requests.post(f"{BASE_URL}/api/admin/products",
                          json=payload, headers=admin_headers)
        assert r.status_code == 422, f"expected 422, got {r.status_code}: {r.text}"
        # detail can be a string or list
        detail = r.json().get("detail", "")
        detail_str = str(detail)
        assert "Prix à la pièce requis" in detail_str, detail_str

    def test_07_cagette_kg_still_requires_price_kg(self, admin_headers):
        payload = {
            "name": "TEST Cagette No KG Price",
            "category": "Fruits",
            "origin": "France",
            "unit": "Colis",
            "image_url": "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=600",
            "description": "",
            "season": "all",
            "cagette_content_kg": 5,
        }
        r = requests.post(f"{BASE_URL}/api/admin/products",
                          json=payload, headers=admin_headers)
        assert r.status_code == 422, r.text
        assert "Prix au kilo requis" in str(r.json().get("detail", ""))

    def test_08_cagette_both_pieces_and_kg_rejected(self, admin_headers):
        payload = {
            "name": "TEST Cagette Both",
            "category": "Fruits",
            "origin": "France",
            "unit": "Colis",
            "image_url": "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=600",
            "description": "",
            "season": "all",
            "price_kg": 2.0,
            "price_piece": 1.0,
            "cagette_content_pieces": 10,
            "cagette_content_kg": 5,
        }
        r = requests.post(f"{BASE_URL}/api/admin/products",
                          json=payload, headers=admin_headers)
        assert r.status_code == 422, r.text
        assert "pièces OU en kg" in str(r.json().get("detail", ""))

    def test_09_cleanup_delete_test_product(self, admin_headers, created_product_id):
        pid = created_product_id["id"]
        if not pid:
            pytest.skip("no product to delete")
        r = requests.delete(f"{BASE_URL}/api/admin/products/{pid}", headers=admin_headers)
        assert r.status_code in (200, 204), r.text
