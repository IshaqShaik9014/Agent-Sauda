# ADR-006: Redacted Agent Catalog Boundary

* **Status:** Accepted
* **Date:** 2026-08-30
* **Context:** Preventing internal cost price and profit margin leakage through AI agent tool calls.

Related: [[Index]], [[Agent Redaction Boundary]], [[Phase 4 Merchant and Catalog Management]], [[ADR-002 AI Is Not The Authority]]

---

## 🎯 Context & Problem Statement
When an AI agent searches a merchant's catalog to answer buyer inquiries, providing raw database records exposes `costPrice` and supplier margins to the LLM. Adversarial buyers could manipulate the LLM into disclosing merchant wholesale costs.

---

## ⚖️ Decision
Separate the catalog APIs into two distinct boundaries:
1. **Merchant Dashboard API (`/api/merchants/:id/catalog/products`)**:
   - Authenticated with JWT. Returns `costPrice`, gross profit margins, and warehouse inventory locations.
2. **Agent & Public Tool API (`/api/agent/catalog`)**:
   - Token-efficient and public. Strictly **redacts `costPrice` and margin formulas**. Returns only `{ id, title, slug, description, category, basePrice, currency, inStock, availableUnits }`.

---

## 💡 Consequences & Trade-offs
* **Pros:**
  - Complete prompt-leakage immunity: The AI cannot leak what it never receives.
  - Token efficiency: Reduces prompt tokens by ~40% per product lookup.
