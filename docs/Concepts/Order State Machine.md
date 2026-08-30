# Order State Machine

The **Order State Machine** tracks the commercial lifecycle of a negotiation and transaction from initiation to fulfillment.

Related: [[Index]], [[ADR-003 Decoupled Order State and Payment State]], [[Payment State Machine]], [[Phase 2 Database and Domain Model]]

---

## 🔄 State Lifecycle Diagram

```mermaid
stateDiagram-v2
    [*] --> NEGOTIATING: Buyer Starts Chat
    NEGOTIATING --> OFFER_CREATED: Policy ALLOWs Offer
    NEGOTIATING --> APPROVAL_PENDING: Order > Autonomous Limit
    APPROVAL_PENDING --> APPROVED: Merchant Approves in Dashboard
    APPROVAL_PENDING --> APPROVAL_REJECTED: Merchant Declines
    
    OFFER_CREATED --> PAYMENT_PENDING: Checkout Initiated
    APPROVED --> PAYMENT_PENDING: Checkout Initiated
    
    PAYMENT_PENDING --> PAYMENT_PROCESSING: Razorpay Modal Opened
    PAYMENT_PROCESSING --> PAID: Webhook Verifies Payment Captured
    PAYMENT_PROCESSING --> PAYMENT_FAILED: Payment Attempt Fails
    PAYMENT_FAILED --> PAYMENT_PENDING: Buyer Retries
    
    PAID --> FULFILLMENT_PENDING: Stock Reserved
    FULFILLMENT_PENDING --> COMPLETED: Shipped & Delivered
    
    OFFER_CREATED --> PRICE_CHANGED: Price Updated Prior to Payment
    OFFER_CREATED --> INVENTORY_CHANGED: Stock Depleted Prior to Payment
    PAYMENT_PENDING --> CANCELLED: Buyer Aborts
```

---

## 🛡️ Failure & Recovery States
* **`PRICE_CHANGED`**: If the merchant updates product prices before payment is captured, the system pauses execution and forces the buyer to confirm the new price.
* **`INVENTORY_CHANGED`**: If another order buys the remaining inventory while a buyer is in checkout, prevents overselling.
* **`PAYMENT_FAILED`**: Captures Razorpay error codes without destroying the order draft, allowing instant retries.
