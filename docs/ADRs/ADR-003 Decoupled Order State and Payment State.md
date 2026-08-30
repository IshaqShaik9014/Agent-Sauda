# ADR-003: Decoupled Order State and Payment State

* **Status:** Accepted
* **Date:** 2026-08-30
* **Context:** Designing the state transitions for orders and payment processing.

Related: [[Index]], [[Order State Machine]], [[Payment State Machine]], [[Phase 2 Database and Domain Model]]

---

## 🎯 Context & Problem Statement
Using simple flags like `isPaid: boolean` fails in real-world payment flows due to race conditions, network drops, user payment retries, webhook delivery delays, and out-of-order execution.

---

## ⚖️ Decision
Decouple **`OrderStatus`** from **`PaymentStatus`** into two distinct state machines:

1. **`OrderStatus`**:
   - `NEGOTIATING` $\rightarrow$ `OFFER_CREATED` $\rightarrow$ `APPROVAL_PENDING` $\rightarrow$ `APPROVED` $\rightarrow$ `PAYMENT_PENDING` $\rightarrow$ `PAID` $\rightarrow$ `COMPLETED`
   - *Failure branches:* `PAYMENT_FAILED`, `PRICE_CHANGED`, `INVENTORY_CHANGED`, `APPROVAL_REJECTED`, `CANCELLED`.

2. **`PaymentStatus`**:
   - `PENDING` $\rightarrow$ `PROCESSING` $\rightarrow$ `CAPTURED` $\rightarrow$ `FAILED` $\rightarrow$ `REFUNDED`

---

## 💡 Consequences & Trade-offs
* **Pros:**
  - Robust recovery if a user retries payment on Razorpay (multiple `Payment` records per `Order`).
  - Webhooks transition `Payment` to `CAPTURED` which then triggers the `Order` transition to `PAID` deterministically.
  - Zero double-charging vulnerabilities.
