# Merchant Analytics and KPI Engine

The **Merchant Analytics and KPI Engine** aggregates multi-dimensional commercial metrics, AI sales agent win rates, and manager approval velocity into actionable executive dashboards.

Related: [[Index]], [[Deterministic Policy Engine]], [[ADR-016 Merchant Commercial Analytics and Negotiation Intelligence]], [[Phase 14 Merchant Analytics Engine]]

---

## 📊 Analytics Dimensions Matrix

```
                      [ EXECUTIVE DASHBOARD ]
                                 │
     ┌───────────────────┬───────┴───────────┬──────────────────┐
     ▼                   ▼                   ▼                  ▼
[ COMMERCIAL KPIS ]  [ AI FUNNEL ]       [ HITL VELOCITY ]  [ TOP PRODUCTS ]
• Gross Revenue      • Total Quotes      • Approval Rate %  • Bestsellers
• Realized Profit    • Accepted Quotes   • Avg Turnaround   • Units Sold
• Realized Margin %  • Negotiation Win % • Timed-out Count • Product Revenue
• Avg Order Value    • Avg Discount %
```

---

## 🧮 KPI Formulas Reference

| Metric | Mathematical Formula | Purpose |
| :--- | :--- | :--- |
| **Gross Revenue** | $\sum \text{Order.totalAmount}$ (`PAID` / `COMPLETED`) | Total top-line sales volume |
| **Realized Profit** | $\text{Gross Revenue} - \sum (\text{Cost} \times \text{Qty})$ | Real cash profit generated |
| **Realized Margin %**| $\frac{\text{Realized Profit}}{\text{Gross Revenue}} \times 100$ | Pricing health indicator |
| **AI Win Rate %** | $\frac{\text{Accepted Offers}}{\text{Total Proposed Offers}} \times 100$ | Conversion efficiency of AI agent |
| **Average Discount %**| $\frac{\sum \text{Offer.discountPercent}}{\text{Total Offers}}$ | Aggressiveness of negotiated discounts |
