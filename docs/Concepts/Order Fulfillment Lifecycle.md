# Order Fulfillment Lifecycle

The **Order Fulfillment Lifecycle** tracks an order from successful payment capture to physical delivery and completion.

Related: [[Index]], [[Order State Machine]], [[ADR-014 Post-Payment Order Fulfillment Pipeline]], [[Phase 12 Order Lifecycle Transitions]]

---

## 🔄 Fulfillment State Transitions

```
[ NEGOTIATION / OFFER ]
          │
          ▼
 [ PAYMENT_PENDING ] ───► (Cancelled) ───► [ CANCELLED ] (Stock Released)
          │
          │ (Payment Captured via Webhook / Verification)
          ▼
      [ PAID ]
          │
          │ POST /orders/:id/start-fulfillment
          ▼
[ FULFILLMENT_PENDING ] (Packing at Warehouse)
          │
          │ POST /orders/:id/fulfill (Carrier + Tracking No.)
          ▼
    [ COMPLETED ] (Delivered / Finalized)
```

---

## 📦 Milestone Timeline (`GET /api/orders/:id/track`)

| Milestone | Key Event | Status Trigger |
| :--- | :--- | :--- |
| **1. Offer Accepted** | Quotation finalized with agreed pricing | Offer Accepted |
| **2. Order Placed** | Order created & warehouse stock reserved | Order Created |
| **3. Payment Captured** | Razorpay payment captured | `status: 'PAID'` |
| **4. Fulfillment Processing** | Warehouse packaging started | `status: 'FULFILLMENT_PENDING'` |
| **5. Order Completed** | Dispatched via courier | `status: 'COMPLETED'` |
