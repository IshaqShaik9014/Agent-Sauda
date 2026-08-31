# ADR-011: Atomic Inventory Reservation on Order Creation

* **Status:** Accepted
* **Date:** 2026-08-31
* **Context:** Preventing double-selling and overselling during buyer payment processing.

Related: [[Index]], [[Inventory Reservation Engine]], [[Order State Machine]], [[Offer Lifecycle State Machine]], [[Phase 9 Order Creation and Validation]]

---

## 🎯 Context & Problem Statement
When a buyer accepts a discounted quotation and proceeds to checkout, there is a time gap between order placement and Razorpay payment confirmation. If the system does not reserve stock immediately, multiple concurrent buyers could attempt to purchase the same inventory, leading to unfulfillable orders and refund liabilities.

---

## ⚖️ Decision
1. **Two-Phase Inventory Counter (`availableUnits` vs `reservedUnits`):**
   - Products maintain distinct `availableUnits` (free to sell) and `reservedUnits` (locked in pending orders).
2. **ACID Transaction on Order Creation:**
   - Order creation from an accepted offer occurs inside a database transaction (`prisma.$transaction`):
     - Check: `availableUnits >= item.quantity` for each line item.
     - Action: `availableUnits -= quantity`, `reservedUnits += quantity`.
     - Create `Order` in `PAYMENT_PENDING` status.
     - Create `OrderItem` records with unit price, agreed price, cost price, and subtotal.
3. **Automatic Inventory Release on Cancellation:**
   - If an order is cancelled or times out prior to payment, an ACID transaction reverses the allocation:
     - `availableUnits += quantity`, `reservedUnits -= quantity`.
     - Update `Order.status = 'CANCELLED'`.
4. **Single-Use Invariant:**
   - Once an offer is converted into an order, subsequent conversion attempts on the same offer are rejected with `400 Bad Request` (`OFFER_ALREADY_CONVERTED`).

---

## 💡 Consequences & Trade-offs
* **Pros:**
  - Zero risk of overselling or double-booking inventory.
  - Clean separation between payment intent and stock allocation.
  - Complete audit trail of every stock decrement and release.
