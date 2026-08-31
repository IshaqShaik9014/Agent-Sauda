# Phase 8: Human-in-the-Loop (HITL) Approvals

* **Status:** Completed & Verified ✅
* **Scope:** Merchant approval queue for high-value quotes, locking offers in `DRAFT` status until manager authorization, RBAC actions (`OWNER`/`ADMIN` only), unlocking to `ACTIVE` upon approval, timeout auto-cancellations, and Swagger endpoints.

Related: [[Index]], [[ADR-010 Human in the Loop Approval Boundaries]], [[HITL Approval Queue]], [[Phase 7 Offer Management]], [[Phase 9 Order Creation]]

---

## 🎯 What Was Implemented
* **Approval Service & State Machine (`approval.service.ts`):**
  - Materializes `Approval` records linked to `Offer` and `Merchant`.
  - Enforces `DRAFT` lock on unapproved offers—blocking premature checkout attempts.
  - Implements `approveRequest` (transitions to `APPROVED`, grants fresh 24h checkout window) and `rejectRequest`.
  - Evaluates lazy expiration timeouts.
* **RBAC Route Security (`approval.routes.ts`):**
  - `GET /api/merchants/:id/approvals`: View queue (Staff, Admin, Owner).
  - `POST /api/merchants/:id/approvals/:id/approve`: Restricted to `OWNER` and `ADMIN`.
  - `POST /api/merchants/:id/approvals/:id/reject`: Restricted to `OWNER` and `ADMIN`.

---

## 🧪 Verification & Proof
* Ran `scripts/verify-approvals.ts` test logic:
  1. ₹152,000 deal triggered `APPROVAL_REQUIRED` $\rightarrow$ Created `DRAFT` offer & `PENDING` approval.
  2. Buyer checkout correctly blocked on locked `DRAFT` offer.
  3. Merchant queue returned pending request with item breakdowns.
  4. Admin approval unlocked offer to `ACTIVE` $\rightarrow$ Buyer successfully checked out.
  5. Admin rejection transitioned both approval and offer to `REJECTED`.
  6. Expired unreviewed request lazily marked `REJECTED` / `TIMED_OUT`.
  7. Staff member approval attempt blocked with `403 Forbidden` (`INSUFFICIENT_ROLE`).
  8. Cross-tenant approval action rejected with `403 Forbidden`.
