# Phase 11: Razorpay Webhooks & Payment Verification

* **Status:** Completed & Verified ✅
* **Scope:** HMAC SHA256 cryptographic webhook verification, database-level `WebhookEvent` idempotency layer, payment capture state pipeline (`Payment` $\rightarrow$ `CAPTURED`, `Order` $\rightarrow$ `PAID`), permanent inventory stock deduction, client payment verification, and Swagger integration.

Related: [[Index]], [[ADR-013 Webhook Idempotency and Cryptographic Verification]], [[Webhook Processing and Idempotency]], [[Phase 10 Razorpay Payments]], [[Phase 12 Order Lifecycle Transitions]]

---

## 🎯 What Was Implemented
* **Cryptographic Ingestion Engine (`webhook.service.ts`):**
  - Raw body HMAC SHA256 verification using `RAZORPAY_WEBHOOK_SECRET`.
  - Database-level idempotency on `WebhookEvent.eventId` preventing double processing.
  - State machine transitions:
    - `payment.captured`: `Payment` $\rightarrow$ `CAPTURED`, `Order` $\rightarrow$ `PAID`, `reservedUnits` permanently deducted.
    - `payment.failed`: `Payment` $\rightarrow$ `FAILED`, `Order` kept in `PAYMENT_PENDING` for buyer retry.
* **Dual Route Surface (`webhook.routes.ts`):**
  - Gateway Ingestion: `POST /api/webhooks/razorpay`.
  - Public Client Verification: `POST /api/payments/verify`.
  - Merchant Webhook Ledger: `GET /api/merchants/:id/webhooks`.

---

## 🧪 Verification & Proof
* Ran `scripts/verify-webhooks.ts` test logic:
  1. Client verification `POST /api/payments/verify` transitioned `Payment` to `CAPTURED`, `Order` to `PAID`, and deducted stock.
  2. Forged signature was rejected with `400 Bad Request` (`INVALID_PAYMENT_SIGNATURE`).
  3. Ingested `payment.captured` webhook with HMAC SHA256 signature $\rightarrow$ transitioned states.
  4. Idempotency test: Duplicate delivery recognized with `alreadyProcessed: true` and 0 duplicate mutations.
  5. Ingested `payment.failed` webhook $\rightarrow$ `Payment` marked `FAILED`, `Order` kept in `PAYMENT_PENDING`.
  6. Merchant webhook audit ledger verified and cross-tenant queries rejected (403 Forbidden).
