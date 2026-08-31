# Phase 10: Razorpay Payments Integration

* **Status:** Completed & Verified ✅
* **Scope:** Provider-agnostic payment architecture (`IPaymentDriver`), Mock & Live Razorpay drivers, Paise subunit conversion ($₹95,000 \rightarrow 9,500,000\text{ paise}$), decoupled `Payment` state tracking, payment initiation endpoints, and Swagger UI integration.

Related: [[Index]], [[ADR-012 Decoupled Payment State Machine and Mockable Driver]], [[Razorpay Payment Flow]], [[Phase 9 Order Creation and Validation]], [[Phase 11 Razorpay Webhooks]]

---

## 🎯 What Was Implemented
* **Provider-Agnostic Payment Engine (`payment.driver.ts` & `payment.service.ts`):**
  - Converts decimal currency into integer Paise subunits ($100\times$).
  - `MockPaymentDriver`: Generates cryptographically realistic `order_mock_...` IDs and HMAC SHA256 signatures for zero-dependency testing.
  - `RazorpayPaymentDriver`: Interfaces directly with live Razorpay REST APIs when real keys are provided.
  - Materializes decoupled `Payment` records in `PENDING` status with attempt counter tracking.
* **Dual Route Surface (`payment.routes.ts`):**
  - Public Buyer Checkout: `POST /api/orders/:orderId/pay`, `GET /api/payments/:paymentId`.
  - Merchant Ledger: `GET /api/merchants/:id/payments`, `GET /api/merchants/:id/payments/:id`.

---

## 🧪 Verification & Proof
* Ran `scripts/verify-payments.ts` test logic:
  1. Initiated payment for ₹95,000 order $\rightarrow$ Generated Razorpay order with `9500000` Paise.
  2. Verified decoupled state: `Order.status` remained `PAYMENT_PENDING` while transaction in-flight.
  3. Blocked payment initiation on cancelled order (`ORDER_CANCELLED`).
  4. Multiple payment attempts tracked cleanly (Attempt #2 created distinct audit record).
  5. Verified public payment lookup and filtered merchant queries.
  6. Cross-tenant payment access rejected with `403 Forbidden`.
