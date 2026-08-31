# ADR-013: Webhook Idempotency and Cryptographic Signature Verification

* **Status:** Accepted
* **Date:** 2026-08-31
* **Context:** Securing asynchronous payment notifications against spoofing, network replays, and duplicate fulfillment.

Related: [[Index]], [[Webhook Processing and Idempotency]], [[Payment State Machine]], [[Order State Machine]], [[Phase 11 Razorpay Webhooks]]

---

## 🎯 Context & Problem Statement
Payment gateways notify merchants of payment status via asynchronous webhooks (`POST /api/webhooks/razorpay`). Without strict controls:
1. Malicious actors could forge HTTP requests to mark unpaid orders as `PAID`.
2. Network dropped ACKs cause gateways to retry webhooks, which could trigger duplicate inventory deductions or multiple fulfillments.

---

## ⚖️ Decision
1. **Raw Body HMAC SHA256 Signature Verification:**
   - Every webhook must include an `x-razorpay-signature` header.
   - The server computes `createHmac('sha256', secret).update(rawBody).digest('hex')` and validates equality before parsing.
   - Any signature mismatch is rejected with `400 Bad Request` (`INVALID_WEBHOOK_SIGNATURE`).
2. **Database-Level Idempotency (`WebhookEvent` Table):**
   - Every incoming event is keyed by its unique `eventId`.
   - If an event is already present in the database, the server returns `200 OK` with `{ alreadyProcessed: true }` without executing side effects.
3. **Atomic State Transition & Permanent Stock Deduction:**
   - On `payment.captured`:
     - Inside `prisma.$transaction`:
       - `Payment.status = 'CAPTURED'`
       - `Order.status = 'PAID'`
       - `Inventory.reservedUnits -= quantity` (Permanent deduction)
4. **Failure Resiliency:**
   - On `payment.failed`, `Payment.status` transitions to `FAILED`, but `Order.status` remains `PAYMENT_PENDING` with reserved stock so the buyer can retry.

---

## 💡 Consequences & Trade-offs
* **Pros:**
  - Complete protection against forgery and replay attacks.
  - Guaranteed single execution of order fulfillment even under heavy webhook retries.
  - Full auditability of all received raw webhook payloads.
