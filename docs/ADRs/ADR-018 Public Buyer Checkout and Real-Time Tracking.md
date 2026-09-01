# ADR-018: Public Buyer Checkout and Real-Time Tracking

* **Status:** Accepted
* **Date:** 2026-09-02
* **Context:** Providing buyers with a frictionless checkout review screen, Razorpay modal integration with mock fallbacks, and real-time 5-milestone order delivery tracking.

Related: [[Index]], [[Buyer Checkout and Payment Flow]], [[Razorpay Payment Flow]], [[Order Fulfillment Lifecycle]], [[Phase 16 Buyer Checkout UI]]

---

## 🎯 Context & Problem Statement
Once a buyer negotiates an offer and accepts the formal quotation in Phase 15, they need:
1. A clear quotation review screen (`/checkout/[offerId]`) displaying negotiated savings and itemized lines.
2. Collection of buyer delivery destination, contact details, and special shipping instructions.
3. Razorpay payment modal execution with integer paise accuracy, supporting both live checkout and simulated test modes with zero friction.
4. Real-time post-payment delivery tracking (`/orders/[orderId]/track`) mapping the order from quotation to warehouse delivery.

---

## ⚖️ Decision
1. **Two-Column Checkout Screen (`/checkout/[offerId]`):**
   - Left column: Customer contact, shipping address, and delivery notes.
   - Right column: Real-time calculation of catalog base price vs negotiated price, green savings pill, and two-phase stock guarantee callout.
2. **Dual-Mode Razorpay Execution (`lib/razorpay.ts` & `PaymentModal.tsx`):**
   - In production or with live test keys: Automatically injects `checkout.razorpay.com/v1/checkout.js` and launches Razorpay Standard Checkout.
   - In development/mock mode: Renders the custom `PaymentModal` simulator with instant HMAC cryptographic verification.
3. **5-Milestone Tracking Stepper (`TrackingTimeline.tsx`):**
   - Visual milestone progression tracking:
     1. `OFFER_ACCEPTED` (Formal quote agreed)
     2. `ORDER_CREATED` (Order placed & inventory reserved)
     3. `PAYMENT_CAPTURED` (Payment captured & inventory deducted)
     4. `FULFILLMENT_PROCESSING` (Warehouse packaging & dispatch)
     5. `ORDER_DELIVERED_COMPLETED` (Carrier name & courier tracking number)

---

## 💡 Consequences & Trade-offs
* **Pros:**
  - Consumer-grade checkout and tracking experience.
  - Zero development friction (payment simulation works out of the box with 0 external credentials).
  - Complete visibility into warehouse fulfillment progression for shoppers.
