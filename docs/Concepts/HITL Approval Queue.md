# Human-in-the-Loop (HITL) Approval Queue

The **HITL Approval Queue** represents the merchant manager workflow for reviewing and authorizing quotations that exceed autonomous commercial guardrails.

Related: [[Index]], [[Offer Lifecycle State Machine]], [[Deterministic Policy Engine]], [[ADR-010 Human in the Loop Approval Boundaries]], [[Phase 8 Human in the Loop Approvals]]

---

## 🔄 HITL Workflow

```
   BUYER DEAL PROPOSAL (e.g. ₹152,000 > ₹100,000 limit)
                          │
                          ▼
            [[Deterministic Policy Engine]]
            (Decision: "APPROVAL_REQUIRED")
                          │
                          ▼
             [ Offer Created in DRAFT ]
                          │
                          ▼
       [ Approval Created in PENDING Status ]
                          │
                          ▼
             ┌────────────┴────────────┐
             ▼                         ▼
   [ OWNER / ADMIN APPROVES ]    [ OWNER / ADMIN REJECTS ]
             │                         │
             ▼                         ▼
   [ Approval: APPROVED ]      [ Approval: REJECTED ]
   [ Offer: ACTIVE ]           [ Offer: REJECTED ]
             │
             ▼
    (Buyer Can Checkout)
```

---

## 🔐 RBAC Permissions Matrix

| Role | View Queue | Submit Request | Approve Deal | Reject Deal |
| :--- | :--- | :--- | :--- | :--- |
| **`OWNER`** | ✅ | ✅ | ✅ | ✅ |
| **`ADMIN`** | ✅ | ✅ | ✅ | ✅ |
| **`STAFF`** | ✅ | ✅ | ❌ (403 Forbidden) | ❌ (403 Forbidden) |
| **`BUYER`** | ❌ | ❌ | ❌ | ❌ |
