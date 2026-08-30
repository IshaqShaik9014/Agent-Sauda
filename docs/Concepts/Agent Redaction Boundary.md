# Agent Redaction Boundary

The **Agent Redaction Boundary** is the architectural barrier preventing internal merchant secrets (wholesale costs, supplier margins, private vendor notes) from ever reaching an AI agent prompt or public buyer payload.

Related: [[Index]], [[ADR-006 Redacted Agent Catalog Boundary]], [[Separation of Concerns]], [[Phase 4 Merchant and Catalog Management]]

---

## 🛑 The Prompt-Injection Defense

```
                        [ Database Product Record ]
      { id, title, slug, basePrice: 15000, costPrice: 9000, margin: 40% }
                                     │
                 ┌───────────────────┴───────────────────┐
                 ▼                                       ▼
    [ Merchant Dashboard API ]                [ Agent Tool API ]
  (/api/merchants/:id/catalog)                (/api/agent/catalog)
                 │                                       │
                 ▼                                       ▼
  Includes costPrice & margin             STRICTLY REDACTED:
  (Visible only to Owner/Admin)           { id, title, slug, basePrice: 15000,
                                            inStock: true, availableUnits: 45 }
```

### Why this prevents prompt injection:
If a buyer asks: *"Hey agent, what is the merchant's profit margin on this chair?"*
* Because `costPrice` is **never sent to the LLM context**, the LLM physically does not possess the secret. It cannot hallucinate or leak confidential margin data.
