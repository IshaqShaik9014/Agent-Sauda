# Deterministic Policy Engine

The **Deterministic Policy Engine** is the algorithmic heart of Agent Sauda. It ensures that no matter what an LLM says or proposes, only mathematically compliant deals can ever become binding orders.

Related: [[Index]], [[Separation of Concerns]], [[ADR-002 AI Is Not The Authority]], [[Phase 5 Deterministic Policy Engine]]

---

## 📐 Mathematical Guardrails

A merchant defines 4 primary parameters in their [[Phase 2 Database and Domain Model|Policy]]:
1. **`maxDiscountPercent`** (e.g. `8.0%`): The maximum percentage discount permitted.
2. **`minimumMarginPercent`** (e.g. `18.0%`): The minimum gross profit margin floor ($\frac{\text{Price} - \text{Cost}}{\text{Price}} \times 100 \ge 18\%$).
3. **`autonomousOrderLimit`** (e.g. `₹100,000`): The highest order subtotal the AI can authorize without merchant human intervention.
4. **`maxQuantityPerOrder`** (e.g. `50` units): Bulk purchasing safety limit.

---

## 🚦 The 4 Deterministic Decisions

```
                           Proposed Offer
                                 │
                 ┌───────────────┴───────────────┐
                 ▼                               ▼
       Negative Profit Margin?          Exceeds Max Discount?
                 │                               │
                 ├──────► [ REJECT ]             ├──────► [ COUNTER ] (Auto-capped at max allowed)
                 │                               │
                 ▼                               ▼
      Within Discount & Margin?        Within Discount & Margin?
      Order <= Autonomous Limit?       Order > Autonomous Limit?
                 │                               │
                 └──────► [ ALLOW ]              └──────► [ APPROVAL_REQUIRED ] (Human In The Loop)
```

1. **`ALLOW`**: Deal is strictly within margin floor, discount cap, and spending threshold.
2. **`COUNTER`**: Buyer requested an excessive discount; engine automatically computes the best legal counter-offer price.
3. **`APPROVAL_REQUIRED`**: Deal is profitable and within discount limits, but order value is high (triggers merchant dashboard approval).
4. **`REJECT`**: Deal produces negative gross margins or violates hard batch restrictions.
