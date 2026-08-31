# ADR-010: Human-in-the-Loop Approval Boundaries and State Locking

* **Status:** Accepted
* **Date:** 2026-08-31
* **Context:** Guarding high-value transactions that exceed autonomous AI negotiation limits.

Related: [[Index]], [[HITL Approval Queue]], [[Deterministic Policy Engine]], [[Offer Lifecycle State Machine]], [[Phase 8 Human in the Loop Approvals]]

---

## 🎯 Context & Problem Statement
When high-value or unusual commercial terms are negotiated (such as batch enterprise orders exceeding `autonomousOrderLimit` of ₹100,000), allowing automatic checkout without merchant manager authorization introduces major commercial risk. At the same time, staff members should not be able to authorize discounts reserved for owners and administrators.

---

## ⚖️ Decision
1. **Offer State Locking in `DRAFT`:**
   - Any deal triggering `APPROVAL_REQUIRED` locks the `Offer` in `DRAFT` status.
   - Public checkout endpoints strictly reject acceptance of `DRAFT` offers with `400 Bad Request` (`INVALID_OFFER_STATE`).
2. **Strict RBAC Enforcement:**
   - Reviewing approvals is guarded by `requireRole(['OWNER', 'ADMIN'])`.
   - `STAFF` members can view queue items, but cannot approve or reject.
3. **Approval Action Semantics:**
   - `approve`: Transitions `Approval` to `APPROVED`, unlocks `Offer` to `ACTIVE`, and grants a fresh 24h buyer checkout window.
   - `reject`: Transitions both `Approval` and `Offer` to `REJECTED`.
   - `timeout`: Stale unreviewed requests past expiration lazily transition to `REJECTED` / `TIMED_OUT`.

---

## 💡 Consequences & Trade-offs
* **Pros:**
  - Guaranteed human supervision on high-value money movements.
  - Zero risk of unauthorized staff or AI bypasses.
  - Immutable audit trail of approver identity, timestamps, and resolution notes.
