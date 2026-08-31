# ADR-012: Decoupled Payment State Machine and Mockable Driver

* **Status:** Accepted
* **Date:** 2026-08-31
* **Context:** Decoupling commercial order fulfillment states from raw payment gateway transaction attempts.

Related: [[Index]], [[Razorpay Payment Flow]], [[Order State Machine]], [[Payment State Machine]], [[Phase 10 Razorpay Payments]]

---

## 🎯 Context & Problem Statement
Payment gateways (like Razorpay) experience transient network failures, card declines, and UPI timeouts. If an `Order` model directly contains payment gateway transaction fields (`razorpayPaymentId`, `razorpaySignature`), failed payment attempts or multiple retries would overwrite previous transaction records or prematurely corrupt the order's fulfillment state.

---

## ⚖️ Decision
1. **Strict State Decoupling (`Order` vs `Payment`):**
   - `Order` represents the high-level commercial contract (`PAYMENT_PENDING` $\rightarrow$ `PAID` $\rightarrow$ `FULFILLMENT_PENDING` $\rightarrow$ `COMPLETED`).
   - `Payment` represents a specific transaction attempt (`PENDING`, `PROCESSING`, `CAPTURED`, `FAILED`).
   - Multiple `Payment` records can link to a single `Order` (e.g. Attempt 1 Failed $\rightarrow$ Attempt 2 Succeeded).
2. **Subunit Precision (Paise Conversion):**
   - Gateway amounts are strictly converted to integer subunits ($₹95,000 \rightarrow 9,500,000\text{ paise}$) before dispatch to eliminate floating-point rounding errors.
3. **Provider-Agnostic Payment Driver (`IPaymentDriver`):**
   - `MockPaymentDriver`: Generates valid Razorpay cryptographic order IDs (`order_mock_...`) and computes HMAC SHA256 signatures for automated testing with zero dependencies.
   - `RazorpayPaymentDriver`: Calls live Razorpay REST API endpoints when real credentials are configured.

---

## 💡 Consequences & Trade-offs
* **Pros:**
  - Complete, auditable ledger of every payment retry attempt.
  - Zero disruption to order data during card declines or network hiccups.
  - 100% testable locally and in CI/CD without external API keys or charges.
