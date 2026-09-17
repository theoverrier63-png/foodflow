# Leray-Pointel B2B — PRD

## Vision
Mobile B2B ordering app for **Leray-Pointel**, a single French wholesale supplier of fresh fruits & vegetables. Business customers register with their company info, browse the catalog by category, order in bulk, and track order history. Payment is handled off-app (invoicing).

## Users
- French professional buyers (restaurants, retailers, caterers) representing a company with a valid SIRET.

## Core Features (MVP)
1. **Company registration & login** — email/password auth with JWT (bcrypt hashed), fields: company_name, SIRET (14 digits, unique), email (unique), phone, delivery_address, password.
2. **Product catalog** — categorized list (Fruits, Légumes, Herbes), each row shows name, origin, unit (crate/sack/case), price HT, and a one-tap "Add to cart" button. Search + horizontal category chips.
3. **Cart** — quantity stepper, running total HT, "Paiement hors application (facturation)" notice, sticky "Valider la commande" CTA.
4. **Order submission** — persists order under user with status = "En attente".
5. **Order history** — chronological list of past orders with status chip (En attente / Validée / Livrée), items, total.
6. **Profile** — company info summary, sign-out.

## Design
- Personality: iOS-Native Clean (REKKI-inspired B2B).
- Palette: Deep Forest Green (#194B32) brand on light neutral surfaces.
- Icons: Feather.
- Font: system.

## Payment
No in-app payment. Orders are submitted as invoice requests. Payment happens outside the app.

## Non-functional
- Backend: FastAPI + MongoDB (motor). All routes prefixed `/api`.
- Frontend: Expo Router (tabs: Catalogue, Panier, Commandes, Compte).
- Auth token stored in `expo-secure-store` (native) / `localStorage` (web).

## Not in MVP
- Payment integration
- Multi-language (French only)
- Push notifications
- Product detail screen (add-to-cart is one-tap on the list row per B2B efficiency principle)

## Admin Panel (v2)
Auto-seeded admin (`admin@leray-pointel.fr` / `admin1234`) logs in and is routed to `/(admin)` where they can:
- View KPIs (total orders, pending, HT revenue)
- **Commandes** — filter, change status via bottom sheet (En attente / Validée / En préparation / Livrée / Annulée), download per-order invoice CSV
- **Catalogue** — CRUD products (add/edit/delete with confirmation)
- **Export** — download a CSV of all orders

CSV downloads: web = blob + anchor; native = share sheet. Backend adds `role` field on users, `require_admin` dependency, `/api/admin/*` routes.

## HT/TTC Pricing + Seasons (v3)
- Products now carry **HT prices** (`price_kg`, `price_piece`) shown to Pros/Business + **TTC prices** (`price_kg_ttc`, `price_piece_ttc`) shown to Personal customers.
- Manual entry of both HT and TTC by the admin (no VAT calculation). If TTC is empty, it falls back silently to HT.
- Each product has a **season** field: `summer`, `winter`, or `all`.
- Global setting `current_season` (default `all`) — admin toggles it manually via the "Saison en cours" screen. Products marked with the off-season are hidden from the client catalog automatically.
- New endpoints: `GET /api/settings/season` (public), `PUT /api/admin/settings/season` (admin only).

## Order Habits, Cagette Unit, Custom Screens (v4)
- **Habitudes de commande** — approved Pros see a "Vos habitudes de commande" horizontal row on top of the catalog, listing the products they order most (`GET /api/orders/habits`). Hidden on search, other categories, personal / pending users.
- **Cagette unit** — third sales option per product. Admin defines the content (either N pieces or X kg). New fields `cagette_content_pieces`, `cagette_content_kg` on products.
- **Login cover image** — admin uploads the hero photo of the login screen (`GET /api/login-cover` public, `PUT/DELETE /api/admin/login-cover`).
- **Catalog watermark** — subtle logo (opacity 0.06) centered behind the catalog list. Fully touch-transparent. Endpoints: `GET /api/watermark` public + admin PUT/DELETE.
- **Notre histoire** — editable "about" page (title + body + up to 4 photos) reachable from the catalog header. Endpoints: `GET /api/our-story` public + `PUT /api/admin/our-story`.

## Price-less Catalog (v5 — current)
- **All price fields removed** from the entire app: no price on products, no line totals in cart, no totals in order history / order detail, no revenue KPI in admin dashboard.
- **Product model** now uses two booleans `sell_by_kg` and `sell_by_piece` to declare which units the client can select. Cagette availability derives from `cagette_content_*`.
- **Admin product form** replaces the price inputs with two toggle switches ("Vendu au kilo" / "Vendu à la pièce") + the existing cagette section.
- **Client**: catalog + product-detail preserve the unit selector (kg / pièce / cagette). Product cards show "Vendu au kilo / à la pièce / à la cagette" instead of a price.
- **Cart**: shows only articles + quantities + unit. Summary line = number of articles. No total.
- **Historique**: no line prices, no order totals.
- **PDF**: renamed "Bon de commande" (columns Produit / Format / Quantité, no prices, no totals).
- **CSV export**: "Total HT" column removed.
- **Migration**: idempotent startup migration `$unset` legacy `price*`, `total*` fields on products and orders + backfills `sell_by_kg` / `sell_by_piece` from previous `sell_unit`.


