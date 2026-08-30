# Phase 4: Merchant and Catalog Management

* **Status:** Completed & Verified ✅
* **Scope:** Merchant Catalog CRUD, warehouse inventory adjustments, price change audit events, and public agent tool endpoint.

Related: [[Index]], [[ADR-006 Redacted Agent Catalog Boundary]], [[Agent Redaction Boundary]], [[Phase 5 Deterministic Policy Engine]]

---

## 🎯 What Was Implemented
* **Merchant Dashboard Catalog API:**
  - `POST /api/merchants/:merchantId/catalog/products`: Creates product with `basePrice`, `costPrice`, and initial inventory.
  - `GET /api/merchants/:merchantId/catalog/products`: Lists products with real-time gross profit margin calculations and stock counts.
  - `GET /api/merchants/:merchantId/catalog/products/:productId`: Retrieves product detail.
  - `PATCH /api/merchants/:merchantId/catalog/products/:productId`: Updates price/metadata and logs `PRICE_UPDATED` audit events.
  - `PATCH /api/merchants/:merchantId/catalog/inventory/:productId`: Adjusts stock and logs `INVENTORY_UPDATED` audit events.
* **Agent-Readable Public Catalog (`GET /api/agent/catalog`):**
  - Token-efficient endpoint for AI tool calling.
  - Returns public product facts (`id`, `title`, `slug`, `category`, `basePrice`, `inStock`, `availableUnits`).
  - **Strictly redacts `costPrice` and profit margins** to prevent LLM prompt leakage.

---

## 🧪 Verification & Proof
* Ran `npx tsx scripts/verify-catalog.ts` $\rightarrow$ 7 automated tests passed:
  1. Product + inventory creation (201).
  2. Duplicate slug rejection in same merchant (409).
  3. Dashboard listing with margin calculations (200).
  4. Price update and `PRICE_UPDATED` audit log (200).
  5. Inventory stock adjustment and `INVENTORY_UPDATED` audit log (200).
  6. Cross-tenant modification rejection (403 Forbidden).
  7. Agent catalog security boundary (100% redacted cost prices).
* Git commit: `4adc748` (pushed to GitHub).
