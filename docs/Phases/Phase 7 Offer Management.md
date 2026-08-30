# Phase 7: Offer Management & State Machine

* **Status:** Completed & Verified ✅
* **Scope:** Materializing formal commercial `Offer` and `OfferItem` records in PostgreSQL, 24-hour expiration window with lazy evaluation, buyer checkout endpoints (`/api/offers/:offerId`), status transitions (`ACTIVE` $\rightarrow$ `ACCEPTED` / `REJECTED` / `EXPIRED`), and merchant dashboard API.

Related: [[Index]], [[ADR-009 Time-Bound Formal Offers with Expiration]], [[Offer Lifecycle State Machine]], [[Phase 6 AI Sales Agent]], [[Phase 8 Human in the Loop Approvals]]

---

## 🎯 What Was Implemented
* **Offer Domain & Calculation Pipeline (`offer.service.ts`):**
  - Materializes immutable `Offer` with relational `OfferItem` records.
  - Automatically calculates subtotal, discount amount, discount percentage, margin percentage, and total amount.
  - Generates secure checkout link (`/checkout/:offerId`) and unique offer number (e.g. `OFF-MTG49...`).
* **Lazy Expiration Engine:**
  - Evaluates `expiresAt` upon retrieval; transitions stale `ACTIVE` offers to `EXPIRED` with an `OFFER_EXPIRED` audit event.
* **Dual API Surface (`offer.routes.ts`):**
  - Merchant Dashboard: `POST /api/merchants/:id/offers`, `GET /api/merchants/:id/offers`, `GET /api/merchants/:id/offers/:offerId`.
  - Public Buyer Checkout: `GET /api/offers/:offerId`, `POST /api/offers/:offerId/accept`, `POST /api/offers/:offerId/reject`.

---

## 🧪 Verification & Proof
* Ran `npx tsx scripts/verify-offers.ts` $\rightarrow$ 7 automated tests passed:
  1. Created 24-hour formal offer for 2 units at 5% discount (Total: ₹95,000).
  2. Public buyer checkout retrieved accurate line items without requiring authentication.
  3. Buyer accepted offer $\rightarrow$ Status transitioned to `ACCEPTED`.
  4. Expired offer lazily transitioned to `EXPIRED` and acceptance was blocked with 400 Bad Request.
  5. Buyer rejected offer $\rightarrow$ Status transitioned to `REJECTED`.
  6. Merchant dashboard listed all offers and successfully filtered by `status=ACCEPTED`.
  7. Cross-tenant authorization guard rejected unauthorized merchant access with 403 Forbidden.
