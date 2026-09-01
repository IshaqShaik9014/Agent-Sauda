# Merchant Control Portal

The **Merchant Control Portal** (`/admin`) is the back-office command center where store owners, sales managers, and warehouse personnel manage, govern, and monitor autonomous AI negotiation and commerce operations.

Related: [[Index]], [[Merchant Analytics and KPI Engine]], [[Deterministic Policy Engine]], [[HITL Approval Queue]], [[Order Fulfillment Lifecycle]], [[ADR-019 Merchant Control Portal and Management Architecture]], [[Phase 17 Merchant Admin Dashboard]]

---

## 🏛️ Administrative Modules Map

```
[/admin] ──► [ AdminLayout ] (Session Verification & Active Store Context)
                 │
                 ├──► [/admin] (Commercial Overview & Revenue/Profit KPIs)
                 │
                 ├──► [/admin/catalog] (Catalog Pricing & Warehouse Stock)
                 │
                 ├──► [/admin/policy] (Deterministic Negotiation Guardrails)
                 │
                 ├──► [/admin/approvals] (HITL Human-in-the-Loop Approvals Queue)
                 │
                 ├──► [/admin/orders] (Warehouse Packaging & Courier Dispatch)
                 │
                 └──► [/admin/audit] (Forensic Compliance & Event Timeline)
```

---

## ⚡ Core Operational Capabilities
1. **Commercial KPI Oversight:** Real-time visibility into Gross Revenue, Net Profit, Average Margin %, and AI Win Rate.
2. **Policy Configuration:** Adjust discount caps and profit margin floors without engineering intervention.
3. **HITL Authorization:** 1-click human manager approval for high-value orders exceeding autonomous spending limits.
4. **Fulfillment Pipeline:** Packaging status updates and automated BlueDart / Delhivery courier tracking assignment.
5. **Regulatory Compliance:** Audit log inspection across Orders, Payments, Policy Snapshots, and Stock Adjustments.
