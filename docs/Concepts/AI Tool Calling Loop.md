# AI Tool Calling Loop

The **AI Tool Calling Loop** defines how natural language conversations from buyers are translated into deterministic tool executions and structured responses.

Related: [[Index]], [[Separation of Concerns]], [[Deterministic Policy Engine]], [[ADR-008 Tool Calling Sales Agent with Fallback Driver]]

---

## 🔄 Conversational Tool Loop

```
   BUYER CHAT INPUT ("I want to buy 3 Hyperion chairs for ₹19,000 each")
                                  │
                                  ▼
                     [ Agent Service & History Loader ]
                                  │
                                  ▼
                       [ Sales Agent System Prompt ]
                                  │
                                  ▼
           TOOL CALL: check_inventory({ productId, quantity: 3 })
                                  │
                                  ▼
           TOOL CALL: propose_offer({ items: [{ productId, quantity: 3, price: 19000 }] })
                                  │
                                  ▼
                    [[Deterministic Policy Engine]]
                       (Returns decision: "ALLOW")
                                  │
                                  ▼
                      [ AI Formulates Response ]
    "Deal agreed! 🎉 I can offer you 3x Hyperion chairs at ₹19,000/unit (Total: ₹57,000)."
                                  │
                                  ▼
                  DATABASE PERSISTENCE & CHAT REPLY
```

---

## 🛠️ The 3 Deterministic Agent Tools

1. **`search_catalog`**:
   - Discovers active products by keyword, category, or title.
   - Guaranteed by [[Agent Redaction Boundary]] to never return `costPrice`.

2. **`check_inventory`**:
   - Queries real-time warehouse inventory to prevent overselling.

3. **`propose_offer`**:
   - Evaluates unit prices and order totals against the merchant's mathematical policy parameters.
   - Emits `ALLOW`, `COUNTER`, `APPROVAL_REQUIRED`, or `REJECT`.
