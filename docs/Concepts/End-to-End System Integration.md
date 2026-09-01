# End-to-End System Integration & Simulation

The **End-to-End System Integration Harness** verifies that all subsystems in Agent Sauda operate with mathematical consistency, strict security invariants, and synchronized state transitions.

Related: [[Index]], [[Separation of Concerns]], [[Security Model]], [[Deterministic Policy Engine]], [[Razorpay Payment Flow]], [[Order Fulfillment Lifecycle]], [[ADR-020 End-to-End Multi-Actor System Integration]], [[Phase 18 End-to-End System Integration]]

---

## 🔄 Multi-Actor Interaction Lifecycle

```
[Store Owner] ────► Configures Policy Limits (Max Discount: 20%, Min Margin: 15%)
                          │
[Buyer 1]     ────► Negotiates 10% Discount ──► Autonomous ALLOW ──► Pays ₹108,000
                          │
[Buyer 2]     ────► Prompt Injection Attack ──► Refusal / Deterministic Rejection
              ────► Wholesale (₹200,000)    ──► HITL Hold (DRAFT)
                          │
[Store Manager] ──► Authorizes Quote in Queue ──► Offer ACTIVE ──► Buyer 2 Pays ₹200,000
                          │
[Dispatcher]  ────► Packages Items & Assigns BlueDart / Delhivery Tracking
                          │
[Reconciliation] ─► Gross Revenue: ₹308,000 | Net Profit: ₹83,000 | 25 Audit Events
```

---

## 🛡️ Key System Invariants Validated
1. **Redaction Invariant:** Supplier `costPrice` is mathematically filtered and never exposed to buyers or LLM tool prompts.
2. **Deterministic Margin Floor:** Quotes that produce negative profit or violate margin floors are strictly rejected.
3. **Two-Phase Inventory Lock:** Stock is held in `reservedUnits` during checkout and permanently deducted only upon verified payment.
4. **Integer Paise Precision:** Financial transfers operate in paise (₹1 = 100 paise) avoiding IEEE 754 floating-point errors.
5. **Immutable Provenance:** Every money and state transition writes an append-only audit event.
