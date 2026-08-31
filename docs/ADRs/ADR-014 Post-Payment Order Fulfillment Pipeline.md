# ADR-014: Post-Payment Order Fulfillment Pipeline

* **Status:** Accepted
* **Date:** 2026-08-31
* **Context:** Managing physical warehouse fulfillment, tracking shipments, and exposing delivery progress after successful payment capture.

Related: [[Index]], [[Order Fulfillment Lifecycle]], [[Order State Machine]], [[Payment State Machine]], [[Phase 12 Order Lifecycle Transitions]]

---

## 🎯 Context & Problem Statement
Once an order is paid, store operations must manage packaging and carrier dispatch. Unpaid orders must never be fulfilled, and buyers require a transparent, milestone-based delivery tracking timeline without exposing sensitive internal warehouse notes.

---

## ⚖️ Decision
1. **Explicit Post-Payment State Transitions:**
   - `PAID` $\rightarrow$ `FULFILLMENT_PENDING` (Store staff begins packaging).
   - `FULFILLMENT_PENDING` $\rightarrow$ `COMPLETED` (Store staff dispatches order with tracking number and carrier metadata).
2. **Terminal State Protection:**
   - Unpaid orders (`PAYMENT_PENDING`) cannot enter fulfillment (rejected with `400 Bad Request`).
   - Completed orders cannot be cancelled directly without a formalized refund process.
3. **Public Buyer Order Tracking Timeline (`GET /api/orders/:id/track`):**
   - Renders a 5-step milestone timeline (`OFFER_ACCEPTED`, `ORDER_CREATED`, `PAYMENT_CAPTURED`, `FULFILLMENT_PROCESSING`, `ORDER_DELIVERED_COMPLETED`).

---

## 💡 Consequences & Trade-offs
* **Pros:**
  - Strict guard against shipping unpaid or cancelled orders.
  - Complete, auditable fulfillment tracking for both merchants and buyers.
  - Full transparency for customers throughout delivery stages.
