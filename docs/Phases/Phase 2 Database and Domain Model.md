# Phase 2: Database and Domain Model

* **Status:** Completed & Verified ✅
* **Scope:** 18 relational models in Prisma, Neon PostgreSQL cloud database, `PrismaPg` adapter, and demo seed script.

Related: [[Index]], [[ADR-003 Decoupled Order State and Payment State]], [[ADR-004 Database Level Tenant Isolation]], [[Phase 3 Authentication and Authorization]]

---

## 🎯 What Was Implemented
* Designed 18 relational tables in `packages/database/prisma/schema.prisma`:
  - `User`, `Merchant`, `MerchantMember`
  - `Product`, `ProductVariant`, `Inventory`
  - `Policy`, `PolicyVersion`
  - `Conversation`, `Message`, `Offer`, `OfferItem`
  - `Approval`, `Order`, `OrderItem`, `Payment`
  - `WebhookEvent`, `AuditEvent`
* Connected to **Neon PostgreSQL** via `PrismaPg` adapter (with SSL and connection pooling).
* Built seed script `packages/database/src/seed.ts` populating Demo Merchant *"Apex Modern Furniture Co."*, 4 catalog items, default policy (8% max discount, 18% min margin, ₹100,000 autonomous limit), and initial audit event.

---

## 🧪 Verification & Proof
* Ran `npx tsx scripts/verify-db.ts` $\rightarrow$ 5 automated tests passed:
  1. Found Demo Merchant.
  2. Verified policy mathematical parameters.
  3. Verified 4 catalog products with warehouse inventory.
  4. Verified strict tenant isolation (zero cross-tenant data leaks).
  5. Verified audit trail logging.
* Git commit: `101829d` (pushed to GitHub).
