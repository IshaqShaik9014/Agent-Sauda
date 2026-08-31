# Inventory Reservation Engine

The **Inventory Reservation Engine** manages warehouse stock allocation across the negotiation, order, payment, and fulfillment lifecycles.

Related: [[Index]], [[Order State Machine]], [[ADR-011 Atomic Inventory Reservation on Order Creation]], [[Phase 9 Order Creation and Validation]]

---

## 🔄 Stock Lifecycle Architecture

```
                  WAREHOUSE INVENTORY POOL
                             │
       ┌─────────────────────┴─────────────────────┐
       ▼                                           ▼
[ AVAILABLE UNITS ]                         [ RESERVED UNITS ]
(Units available for sale)                  (Units locked in PAYMENT_PENDING)
       │                                           ▲
       │          POST /orders/create-from-offer   │
       ├───────────────────────────────────────────┤
       │          (availableUnits -= quantity)     │
       │          (reservedUnits += quantity)      │
       │                                           │
       │          POST /orders/:id/cancel          │
       ├───────────────────────────────────────────┤
       │          (availableUnits += quantity)     │
       │          (reservedUnits -= quantity)      │
       │                                           │
       │          PAYMENT CAPTURED (Phase 11)      ▼
       └───────────────────────────────────► [ FULFILLED / DEDUCTED ]
```

---

## 📊 State Definitions

| Transition | Inventory Effect | Order Status |
| :--- | :--- | :--- |
| **Order Created from Offer** | `availableUnits -= Qty`, `reservedUnits += Qty` | `PAYMENT_PENDING` |
| **Order Cancelled / Expired** | `availableUnits += Qty`, `reservedUnits -= Qty` | `CANCELLED` |
| **Payment Captured** | `reservedUnits -= Qty` (Permanent deduction) | `PAID` $\rightarrow$ `FULFILLMENT_PENDING` |
