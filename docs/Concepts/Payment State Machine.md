# Payment State Machine

The **Payment State Machine** tracks raw financial transactions executed through payment gateways (such as **Razorpay Test Mode**).

Related: [[Index]], [[Order State Machine]], [[ADR-003 Decoupled Order State and Payment State]], [[Security Model]]

---

## 💳 State Transitions

```
[ PENDING ] ────────► [ PROCESSING ] ────────► [ CAPTURED ]
     │                       │
     ▼                       ▼
 [ FAILED ] <────────────────┘
     │
     ▼ (Retry creates new payment attempt)
 [ REFUNDED ]
```

---

## 🔒 Razorpay Verification Rules
1. **Order Creation:** Backend requests Razorpay order with `{ amount, currency, receipt: orderId }`.
2. **Signature Verification:** On payment completion, Razorpay client returns `razorpay_payment_id`, `razorpay_order_id`, and `razorpay_signature`.
3. **Cryptographic Validation:**
   $$\text{Expected Signature} = \text{HMAC-SHA256}(\text{razorpay\_order\_id} + "|" + \text{razorpay\_payment\_id}, \text{RAZORPAY\_KEY\_SECRET})$$
4. **Idempotent Webhooks:** Incoming webhooks are logged into `webhook_events` before execution to prevent double-processing.
