# Buyer Checkout and Payment Flow

The **Buyer Checkout and Payment Flow** connects conversational AI negotiation directly to real-world monetary settlement and physical fulfillment.

Related: [[Index]], [[Razorpay Payment Flow]], [[Order Fulfillment Lifecycle]], [[Order State Machine]], [[Payment State Machine]], [[ADR-018 Public Buyer Checkout and Real-Time Tracking]], [[Phase 16 Buyer Checkout UI]]

---

## 🧭 Checkout State Transitions

```
[/negotiate/[slug]] ──► Accept Quote ──► [/checkout/[offerId]]
                                               │
                                 ┌─────────────┴─────────────┐
                                 ▼                           ▼
                        Standard Razorpay            Simulated Modal
                                 │                           │
                                 └─────────────┬─────────────┘
                                               ▼
                                   POST /api/payments/verify
                                               │
                                               ▼
                                   [/orders/[orderId]/track]
```

---

## ⚡ 5-Step Fulfillment Stepper

| Step | Milestone | Backend Order State | Inventory State |
| :--- | :--- | :--- | :--- |
| **1** | `OFFER_ACCEPTED` | `OFFER: ACCEPTED` | Unreserved |
| **2** | `ORDER_CREATED` | `ORDER: PAYMENT_PENDING` | `reservedUnits` Incremented |
| **3** | `PAYMENT_CAPTURED`| `ORDER: PAID` | `reservedUnits` Decremented (Deducted) |
| **4** | `FULFILLMENT_PROCESSING` | `ORDER: FULFILLMENT_PROCESSING`| In Warehouse Packaging |
| **5** | `ORDER_DELIVERED_COMPLETED`| `ORDER: COMPLETED` | Shipped with Courier Tracking |
