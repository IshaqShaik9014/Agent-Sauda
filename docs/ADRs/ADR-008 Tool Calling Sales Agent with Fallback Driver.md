# ADR-008: Tool-Calling Sales Agent with Fallback Driver

* **Status:** Accepted
* **Date:** 2026-08-30
* **Context:** Designing the AI negotiation agent architecture and multi-model driver layer.

Related: [[Index]], [[Separation of Concerns]], [[Deterministic Policy Engine]], [[AI Tool Calling Loop]], [[Phase 6 AI Sales Agent]]

---

## 🎯 Context & Problem Statement
The sales agent interacts with human buyers in natural language, but must never have the authority to invent prices, approve discounts, or promise stock out of thin air. Furthermore, local testing, CI test suites, and hackathons should not be blocked or made flaky by external LLM API rate limits, costs, or network failures.

---

## ⚖️ Decision
1. **Tool-Gated Agent Architecture:**
   - The AI agent cannot execute commercial actions directly.
   - It is provided with 3 deterministic tools: `search_catalog`, `check_inventory`, and `propose_offer`.
   - Any pricing proposal must be submitted to `propose_offer` (which invokes [[Deterministic Policy Engine]]), and the agent must explain the resulting decision (`ALLOW`, `COUNTER`, `APPROVAL_REQUIRED`, `REJECT`).
2. **Provider-Agnostic Driver Interface with Built-in Deterministic Fallback:**
   - `IAgentDriver` interface decouples the core chat service from specific LLM providers.
   - Supports Google Gemini and OpenAI when API keys are configured.
   - Includes a deterministic, pattern-aware fallback driver (`DeterministicAgentDriver`) that executes real tool calling loops for unit/integration tests and zero-cost local execution.

---

## 💡 Consequences & Trade-offs
* **Pros:**
  - Automated test suites run in seconds with 100% determinism.
  - Zero risk of LLM prompt injection bypassing financial rules.
  - Pluggable support for any modern LLM provider.
