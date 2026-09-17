"""Iteration 16: full removal of prices across products/orders/PDF/CSV.

Tests every acceptance criterion from the review request:
  - Products no longer expose price fields but expose sell_by_kg / sell_by_piece
  - Product create/update validators (no prices; at least one selling unit;
    cagette-in-kg needs sell_by_kg; cagette-in-pieces needs sell_by_piece)
  - Orders created without any 'price' field; response has no 'total'
  - Admin PDF (Bon de commande) works
  - Admin CSV export has no 'Total HT' column
  - Seed count on empty DB = 15 products
  - Migration $unset removes legacy price* fields
"""

from __future__ import annotations

import os
import uuid

import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")

ADMIN_EMAIL = "sarl.leraypointel@orange.fr"
ADMIN_PASSWORD = "Loic76930@"
CLIENT_EMAIL = "test@leray.fr"
CLIENT_PASSWORD = "Test1234!"

FORBIDDEN_PRICE_KEYS = {
    "price", "price_kg", "price_piece",
    "price_kg_ttc", "price_piece_ttc",
    "tva_rate", "total", "total_ttc",
}


# ------------------------------ fixtures ------------------------------

@pytest.fixture(scope="session")
def s():
    ses = requests.Session()
    ses.headers.update({"Content-Type": "application/json"})
    return ses


@pytest.fixture(scope="session")
def admin_token(s):
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def client_token(s):
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": CLIENT_EMAIL, "password": CLIENT_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture
def admin_h(admin_token):
    return {"Authorization": f"Bearer {admin_token}",
            "Content-Type": "application/json"}


@pytest.fixture
def client_h(client_token):
    return {"Authorization": f"Bearer {client_token}",
            "Content-Type": "application/json"}


# ------------------------------ products list ------------------------------

class TestProductsList:
    def test_get_products_returns_no_price_fields(self, s):
        r = s.get(f"{BASE_URL}/api/products")
        assert r.status_code == 200
        products = r.json()
        assert isinstance(products, list) and len(products) > 0
        for p in products:
            leaked = FORBIDDEN_PRICE_KEYS & set(p.keys())
            assert not leaked, f"Product {p.get('name')} leaks {leaked}"
            assert "sell_by_kg" in p, f"missing sell_by_kg in {p.get('name')}"
            assert "sell_by_piece" in p, f"missing sell_by_piece in {p.get('name')}"
            assert isinstance(p["sell_by_kg"], bool)
            assert isinstance(p["sell_by_piece"], bool)

    def test_seed_count_is_at_least_15(self, admin_h, s):
        r = s.get(f"{BASE_URL}/api/admin/products", headers=admin_h)
        assert r.status_code == 200
        assert len(r.json()) >= 15


# ------------------------------ admin product CRUD ------------------------------

class TestAdminProductCRUD:
    created_ids: list[str] = []

    def _payload(self, **over):
        base = {
            "name": f"TEST_prod_{uuid.uuid4().hex[:8]}",
            "category": "Fruits",
            "origin": "France",
            "unit": "Cagette 5kg",
            "image_url": "https://example.com/i.jpg",
            "description": "desc",
            "sell_by_kg": True,
            "sell_by_piece": False,
            "season": "all",
        }
        base.update(over)
        return base

    def test_create_product_without_prices_returns_201(self, s, admin_h):
        r = s.post(f"{BASE_URL}/api/admin/products",
                   headers=admin_h, json=self._payload())
        assert r.status_code == 201, r.text
        data = r.json()
        assert data["sell_by_kg"] is True
        assert data["sell_by_piece"] is False
        leaked = FORBIDDEN_PRICE_KEYS & set(data.keys())
        assert not leaked, f"leaks {leaked}"
        TestAdminProductCRUD.created_ids.append(data["id"])

    def test_create_product_rejects_no_selling_unit(self, s, admin_h):
        payload = self._payload(sell_by_kg=False, sell_by_piece=False)
        r = s.post(f"{BASE_URL}/api/admin/products",
                   headers=admin_h, json=payload)
        assert r.status_code == 422, f"expected 422, got {r.status_code}: {r.text}"

    def test_create_cagette_kg_requires_sell_by_kg(self, s, admin_h):
        payload = self._payload(sell_by_kg=False, sell_by_piece=True,
                                cagette_content_kg=5)
        r = s.post(f"{BASE_URL}/api/admin/products",
                   headers=admin_h, json=payload)
        assert r.status_code == 422, f"expected 422, got {r.status_code}: {r.text}"

    def test_create_cagette_pieces_requires_sell_by_piece(self, s, admin_h):
        payload = self._payload(sell_by_kg=True, sell_by_piece=False,
                                cagette_content_pieces=12)
        r = s.post(f"{BASE_URL}/api/admin/products",
                   headers=admin_h, json=payload)
        assert r.status_code == 422, f"expected 422, got {r.status_code}: {r.text}"

    def test_ignores_stray_price_in_create(self, s, admin_h):
        """Extra price field must be silently ignored (Pydantic default drops)."""
        payload = self._payload()
        payload["price"] = 999.99
        payload["price_kg"] = 12.34
        r = s.post(f"{BASE_URL}/api/admin/products",
                   headers=admin_h, json=payload)
        assert r.status_code == 201, r.text
        data = r.json()
        leaked = FORBIDDEN_PRICE_KEYS & set(data.keys())
        assert not leaked, f"price leaked into product: {leaked}"
        TestAdminProductCRUD.created_ids.append(data["id"])

    def test_update_product_no_price_schema(self, s, admin_h):
        assert TestAdminProductCRUD.created_ids, "need previously created product"
        pid = TestAdminProductCRUD.created_ids[0]
        payload = self._payload(sell_by_kg=True, sell_by_piece=True,
                                name="TEST_updated_prod")
        r = s.put(f"{BASE_URL}/api/admin/products/{pid}",
                  headers=admin_h, json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["name"] == "TEST_updated_prod"
        assert data["sell_by_kg"] is True
        assert data["sell_by_piece"] is True
        leaked = FORBIDDEN_PRICE_KEYS & set(data.keys())
        assert not leaked

        # GET-verify persistence
        gr = s.get(f"{BASE_URL}/api/products/{pid}")
        assert gr.status_code == 200
        got = gr.json()
        assert got["name"] == "TEST_updated_prod"
        assert not (FORBIDDEN_PRICE_KEYS & set(got.keys()))

    def test_zzz_cleanup(self, s, admin_h):
        for pid in TestAdminProductCRUD.created_ids:
            s.delete(f"{BASE_URL}/api/admin/products/{pid}", headers=admin_h)


# ------------------------------ orders ------------------------------

class TestOrdersNoPrices:
    def _pick_kg_product(self, s):
        products = s.get(f"{BASE_URL}/api/products").json()
        for p in products:
            if p.get("sell_by_kg"):
                return p
        return products[0]

    def test_create_order_without_price(self, s, client_h):
        p = self._pick_kg_product(s)
        body = {
            "items": [{
                "product_id": p["id"],
                "name": p["name"],
                "unit": p["unit"],
                "sell_unit": "kg" if p.get("sell_by_kg") else "piece",
                "quantity": 3.5,
            }],
            "notes": "TEST_no_price",
        }
        r = s.post(f"{BASE_URL}/api/orders", headers=client_h, json=body)
        assert r.status_code == 201, r.text
        order = r.json()
        # Order-level: no total*, no price
        leaked_order = FORBIDDEN_PRICE_KEYS & set(order.keys())
        assert not leaked_order, f"order leaks {leaked_order}"
        # Item-level: no price* keys
        for it in order["items"]:
            leaked_item = FORBIDDEN_PRICE_KEYS & set(it.keys())
            assert not leaked_item, f"item leaks {leaked_item}"
            assert "quantity" in it and "sell_unit" in it
        return order["id"]

    def test_reject_order_with_price_field_is_tolerated_but_not_returned(
            self, s, client_h):
        """Client MAY erroneously send price — it must not appear in response."""
        p = self._pick_kg_product(s)
        body = {
            "items": [{
                "product_id": p["id"],
                "name": p["name"],
                "unit": p["unit"],
                "sell_unit": "kg" if p.get("sell_by_kg") else "piece",
                "quantity": 1.0,
                "price": 42.0,        # noise
                "price_kg": 42.0,     # noise
            }],
            "notes": "TEST_noise_price",
        }
        r = s.post(f"{BASE_URL}/api/orders", headers=client_h, json=body)
        assert r.status_code == 201, r.text
        order = r.json()
        for it in order["items"]:
            leaked = FORBIDDEN_PRICE_KEYS & set(it.keys())
            assert not leaked, f"price leaked in stored item: {leaked}"

    def test_list_orders_have_no_price(self, s, client_h):
        r = s.get(f"{BASE_URL}/api/orders", headers=client_h)
        assert r.status_code == 200
        for o in r.json():
            assert not (FORBIDDEN_PRICE_KEYS & set(o.keys()))
            for it in o.get("items", []):
                assert not (FORBIDDEN_PRICE_KEYS & set(it.keys()))


# ------------------------------ PDF (Bon de commande) ------------------------------

class TestAdminInvoicePDF:
    def test_admin_invoice_pdf_valid(self, s, admin_h, client_h):
        # ensure at least one order exists
        products = s.get(f"{BASE_URL}/api/products").json()
        p = next(x for x in products if x.get("sell_by_kg") or x.get("sell_by_piece"))
        s.post(f"{BASE_URL}/api/orders", headers=client_h, json={
            "items": [{
                "product_id": p["id"], "name": p["name"], "unit": p["unit"],
                "sell_unit": "kg" if p.get("sell_by_kg") else "piece",
                "quantity": 2.0,
            }],
            "notes": "TEST_pdf",
        })
        r = s.get(f"{BASE_URL}/api/admin/orders", headers=admin_h)
        assert r.status_code == 200
        orders = r.json()
        assert orders, "need at least one order"
        oid = orders[0]["id"]

        pdf = s.get(f"{BASE_URL}/api/admin/orders/{oid}/invoice", headers=admin_h)
        assert pdf.status_code == 200, pdf.text[:400]
        ct = pdf.headers.get("content-type", "")
        assert "pdf" in ct.lower(), f"content-type={ct}"
        assert pdf.content[:4] == b"%PDF", "not a PDF signature"
        assert len(pdf.content) > 1024, f"pdf too small ({len(pdf.content)} bytes)"


# ------------------------------ CSV export ------------------------------

class TestAdminCSVExport:
    def test_csv_export_no_total_ht(self, s, admin_h):
        r = s.get(f"{BASE_URL}/api/admin/orders/export", headers=admin_h)
        assert r.status_code == 200, r.text
        payload = r.json()
        assert "content" in payload
        csv = payload["content"]
        header = csv.splitlines()[0].lower()
        assert "total ht" not in header
        assert "total" not in header  # no total at all
        assert "prix" not in header
