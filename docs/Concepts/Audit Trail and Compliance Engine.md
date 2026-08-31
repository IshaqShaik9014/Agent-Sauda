# Audit Trail and Compliance Engine

The **Audit Trail and Compliance Engine** records, indexes, and exports an immutable history of all commercial, policy, agent, and financial operations within Agent Sauda.

Related: [[Index]], [[Separation of Concerns]], [[Security Model]], [[ADR-015 Immutable Audit Trail and Forensic Compliance Engine]], [[Phase 13 Audit Trail and Compliance Engine]]

---

## 🔄 Multi-Entity Forensic Reconstruction Pipeline

```
[ CONVERSATION ] ──► AI proposes discount
        │
        ▼
[ POLICY ENGINE ] ──► Rule evaluation (ALLOW / COUNTER / APPROVAL)
        │
        ▼
[ HITL APPROVAL ] ──► Store manager approves quote
        │
        ▼
[ FORMAL OFFER ] ──► Offer materialized & accepted
        │
        ▼
[ ORDER CREATION ] ──► Stock reserved in warehouse
        │
        ▼
[ RAZORPAY PAYMENT ] ──► Payment captured & stock deducted
        │
        ▼
[ WAREHOUSE FULFILLMENT ] ──► Dispatched via courier (COMPLETED)
```

---

## 📊 Actor Provenance Matrix

| Actor Type | Meaning | Example `actorId` |
| :--- | :--- | :--- |
| **`AI_AGENT`** | Automated LLM negotiation assistant | `agent-sauda-core` |
| **`SYSTEM`** | Deterministic business rules & background workers | `policy-engine`, `order-reservation` |
| **`USER`** | Authenticated store staff / merchant owner | `user_uuid` |
| **`WEBHOOK`** | External gateway notification | `razorpay-webhook` |
