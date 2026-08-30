# ADR-007: Pure Rule Pipeline Without LLM Discretion

* **Status:** Accepted
* **Date:** 2026-08-30
* **Context:** Implementing the mathematical decision engine for autonomous negotiations.

Related: [[Index]], [[Deterministic Policy Engine]], [[ADR-002 AI Is Not The Authority]], [[Phase 5 Deterministic Policy Engine]]

---

## 🎯 Context & Problem Statement
When an AI agent engages in live sales negotiations, it must evaluate incoming buyer offers in milliseconds. If policy evaluation depends on LLM prompts or heavy database queries in the evaluation loop, it introduces latency, cost, and non-deterministic behavior.

---

## ⚖️ Decision
Structure the **Policy Engine (`policy.engine.ts` & `policy.rules.ts`)** as a **pure mathematical evaluation pipeline**:
1. **Zero Database/Network Coupling in Evaluation Loop:**
   - The caller fetches authoritative product facts (`basePrice`, `costPrice`) from the database.
   - The engine receives plain data (`PolicyConfig`, `itemFacts`) and executes pure functions with zero I/O side effects.
2. **Deterministic Output Triad:**
   - Evaluates discount caps, margin floors, order thresholds, and max batch quantities.
   - Emits exactly one of 4 decisions: `ALLOW`, `COUNTER`, `APPROVAL_REQUIRED`, or `REJECT`.
   - Computes mathematical counter-offer prices automatically:
     $$P_{\text{counter}} = \max\left( \text{BasePrice} \times \left(1 - \frac{\text{MaxDiscount}}{100}\right), \frac{\text{CostPrice}}{1 - \frac{\text{MinMargin}}{100}} \right)$$

---

## 💡 Consequences & Trade-offs
* **Pros:**
  - 100% testable with pure unit tests without mocks or database seeding.
  - Sub-millisecond evaluation speed ($< 1\text{ms}$).
  - Guaranteed mathematical safety: No LLM hallucination can ever bypass a margin floor or discount limit.
