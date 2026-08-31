# Razorpay Payment Flow

The **Razorpay Payment Flow** illustrates the client-server-gateway interaction that initiates and completes secure commercial transactions in Indian Rupees (INR).

Related: [[Index]], [[Order State Machine]], [[Payment State Machine]], [[ADR-012 Decoupled Payment State Machine and Mockable Driver]], [[Phase 10 Razorpay Payments]]

---

## 🔄 Sequence Diagram

```
[ BUYER / CLIENT ]           [ AGENT SAUDA BACKEND ]            [ RAZORPAY GATEWAY ]
        │                              │                                  │
        │─── POST /orders/:id/pay ────►│                                  │
        │                              │─── razorpay.orders.create ──────►│
        │                              │    (Amount: 9500000 Paise)       │
        │                              │                                  │
        │                              │◄── { id: "order_xyz" } ──────────│
        │                              │                                  │
        │                              │─── Save Payment (PENDING) ───┐   │
        │                              │                              │   │
        │                              │◄─────────────────────────────┘   │
        │◄── 201 Created ──────────────┤                                  │
        │    { razorpayOrderId,        │                                  │
        │      amountInPaise, keyId }  │                                  │
        │                              │                                  │
        │─── Razorpay Checkout Modal ──┼─────────────────────────────────►│
        │    (Card / UPI / Netbanking) │                                  │
        │                              │                                  │
        │◄── Payment Successful ───────┼──────────────────────────────────│
        │    (razorpayPaymentId, sig)  │                                  │
        │                              │                                  │
        │─── POST /api/payments/verify►│                                  │
        │    (Phase 11 Webhooks)       │─── Webhook payment.captured ────►│
```

---

## 📊 Currency & Amount Precision

| Layer | Representation | Example |
| :--- | :--- | :--- |
| **Catalog & Policy Engine** | Indian Rupees (Float) | ₹95,000.00 |
| **Order Record** | Indian Rupees (Float) | ₹95,000.00 |
| **Payment Gateway Payload** | Integer Subunits (Paise) | `9500000` |
| **Database `payments` Table** | Indian Rupees (Float) | ₹95,000.00 |
