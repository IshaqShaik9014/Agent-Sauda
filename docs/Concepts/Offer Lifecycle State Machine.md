# Offer Lifecycle State Machine

The **Offer Lifecycle State Machine** governs the journey of a commercial quote from negotiation inception to checkout or expiration.

Related: [[Index]], [[Order State Machine]], [[ADR-009 Time-Bound Formal Offers with Expiration]], [[Phase 7 Offer Management]]

---

## 🔄 State Transition Diagram

```
                        [ NEGOTIATION IN CONVERSATION ]
                                       │
                                       ▼
                       POST /api/merchants/:id/offers
                                       │
                                       ▼
                                 ┌──────────┐
                                 │  ACTIVE  │ (Valid for 24 Hours)
                                 └────┬─────┘
                                      │
            ┌─────────────────────────┼─────────────────────────┐
            ▼                         ▼                         ▼
  [ POST /accept ]            [ now > expiresAt ]        [ POST /reject ]
            │                         │                         │
            ▼                         ▼                         ▼
     ┌─────────────┐            ┌───────────┐            ┌────────────┐
     │  ACCEPTED   │            │  EXPIRED  │            │  REJECTED  │
     └──────┬──────┘            └───────────┘            └────────────┘
            │
            ▼
    [ PHASE 9: ORDER ]
  (CONVERTED_TO_ORDER)
```

---

## 📊 State Definitions

| State | Description | Allowed Next Transitions |
| :--- | :--- | :--- |
| **`ACTIVE`** | The offer is live, valid, and available for buyer checkout. | `ACCEPTED`, `EXPIRED`, `REJECTED`, `SUPERSEDED` |
| **`ACCEPTED`** | The buyer has reviewed terms and confirmed checkout intent. | `CONVERTED_TO_ORDER` (Phase 9) |
| **`EXPIRED`** | The offer exceeded its `expiresAt` window before checkout. | Terminal state. Acceptance is rejected. |
| **`REJECTED`** | The buyer or merchant cancelled the quotation. | Terminal state. |
| **`SUPERSEDED`** | A new counter-offer was created for the same conversation thread. | Terminal state. |
