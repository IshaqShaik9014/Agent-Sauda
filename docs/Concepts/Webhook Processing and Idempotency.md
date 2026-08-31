# Webhook Processing and Idempotency

The **Webhook Processing and Idempotency Engine** ingests, validates, and routes asynchronous events from external payment gateways into deterministic state changes.

Related: [[Index]], [[Order State Machine]], [[Payment State Machine]], [[ADR-013 Webhook Idempotency and Cryptographic Verification]], [[Phase 11 Razorpay Webhooks]]

---

## 🔄 Ingestion & Idempotency Pipeline

```
[ RAZORPAY GATEWAY ]
        │
        │ POST /api/webhooks/razorpay (Raw JSON + x-razorpay-signature)
        ▼
[ HMAC SHA256 VALIDATION ] ──► (Invalid) ──► 400 Bad Request
        │ (Valid)
        ▼
[ IDEMPOTENCY CHECK ] ───────► (Existing eventId) ──► 200 OK (alreadyProcessed: true)
        │ (New eventId)
        ▼
[ ACID TRANSACTION ]
        │
        ├─► Insert WebhookEvent (status: PENDING)
        │
        ├─► If "payment.captured":
        │     ├─ Payment.status = CAPTURED
        │     ├─ Order.status = PAID
        │     └─ reservedUnits -= quantity (Permanent Deduction)
        │
        ├─► If "payment.failed":
        │     └─ Payment.status = FAILED (Order remains PAYMENT_PENDING)
        │
        ├─► Update WebhookEvent (status: PROCESSED)
        │
        └─► Emit Audit Events (PAYMENT_CAPTURED, ORDER_UPDATED)
```

---

## 📊 Webhook Statuses

| Status | Meaning |
| :--- | :--- |
| **`PENDING`** | Webhook received and queued for processing. |
| **`PROCESSED`** | State transitions and inventory changes applied successfully. |
| **`IGNORED`** | Event is valid but not relevant to money state (e.g. `settlement.processed`). |
| **`FAILED`** | Processing encountered an unhandled error during transaction execution. |
