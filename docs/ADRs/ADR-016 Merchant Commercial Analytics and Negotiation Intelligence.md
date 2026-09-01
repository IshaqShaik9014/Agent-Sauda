# ADR-016: Merchant Commercial Analytics and Negotiation Intelligence

* **Status:** Accepted
* **Date:** 2026-09-01
* **Context:** Providing store owners with financial KPIs, autonomous AI negotiation conversion rates, and discount depth tracking.

Related: [[Index]], [[Merchant Analytics and KPI Engine]], [[Deterministic Policy Engine]], [[AI Tool Calling Loop]], [[Phase 14 Merchant Analytics Engine]]

---

## 🎯 Context & Problem Statement
When merchants deploy autonomous AI sales agents to negotiate discounts with buyers, store executives need immediate visibility into:
1. Are the agents making money or eroding gross margins?
2. What is the negotiation conversion win rate?
3. How much discount is the AI granting on average compared to baseline prices?
4. How fast are store managers resolving high-value Human-in-the-Loop (HITL) approval requests?

---

## ⚖️ Decision
1. **Realized Commercial KPI Formulas:**
   - $\text{Gross Revenue} = \sum \text{Order.totalAmount}$ for all `PAID` and `COMPLETED` orders.
   - $\text{Realized Gross Profit} = \text{Gross Revenue} - \sum (\text{OrderItem.costPrice} \times \text{OrderItem.quantity})$.
   - $\text{Realized Margin \%} = \frac{\text{Realized Gross Profit}}{\text{Gross Revenue}} \times 100$.
2. **AI Negotiation Intelligence:**
   - $\text{Win Rate \%} = \frac{\text{Accepted Offers}}{\text{Total Proposed Offers}} \times 100$.
   - $\text{Average Discount \%} = \text{Mean}(\text{Offer.discountPercent})$.
3. **HITL Turnaround Velocity:**
   - Tracks resolution turnaround times in minutes: $(\text{resolvedAt} - \text{requestedAt}) / (1000 \times 60)$.
4. **Tenant Scoping:**
   - All analytical queries are strictly scoped to `merchantId` with optional date range boundaries (`startDate`, `endDate`).

---

## 💡 Consequences & Trade-offs
* **Pros:**
  - Complete, transparent financial and AI performance oversight for merchant leadership.
  - Zero ambiguity in autonomous sales agent ROI.
  - High-performance parallelized analytical queries (`Promise.all`).
