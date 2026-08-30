# Phase 6: AI Sales Agent

* **Status:** Completed & Verified ✅
* **Scope:** Autonomous sales agent with function tool calling (`search_catalog`, `check_inventory`, `propose_offer`), prompt engineering, conversation persistence in database (`Conversation` & `Message` models), and Swagger chat endpoint.

Related: [[Index]], [[ADR-008 Tool Calling Sales Agent with Fallback Driver]], [[AI Tool Calling Loop]], [[Phase 5 Deterministic Policy Engine]], [[Phase 7 Offer Management]]

---

## 🎯 What Was Implemented
* **Agent Tool System (`agent.tools.ts`):**
  - `search_catalog`: Safe product discovery without margin leakage.
  - `check_inventory`: Warehouse stock verification.
  - `propose_offer`: Integration with the Deterministic Policy Engine.
* **Prompt Engineering (`agent.prompts.ts`):**
  - System prompt enforcing commercial negotiation guardrails and prompt injection defenses.
* **Driver Architecture (`agent.driver.ts`):**
  - Decoupled interface supporting live Gemini/OpenAI models alongside an intelligent deterministic fallback driver for instant, zero-cost automated testing.
* **Chat Service & Persistence (`agent.service.ts` & `agent.routes.ts`):**
  - `POST /api/merchants/:merchantId/agent/chat`: Full multi-turn conversation support persisting buyer and agent turns in PostgreSQL.

---

## 🧪 Verification & Proof
* Ran `npx tsx scripts/verify-agent.ts` $\rightarrow$ 6 automated tests passed:
  1. Product Discovery turn via `search_catalog`.
  2. Compliant discount offer agreed via `propose_offer` (`ALLOW`).
  3. Excessive discount negotiation auto-countered at policy limit (`COUNTER`).
  4. High-value order routed to store manager (`APPROVAL_REQUIRED`).
  5. Stock limit check preventing overselling (`check_inventory`).
  6. Prompt injection attack rejected deterministically.
* Database audit confirmed 12 conversation messages persisted in PostgreSQL.
