# ADR-027: Dynamic Scarcity Guard, Voice Negotiation, Multi-Currency, and Merchant Simulation Sandbox

## Status
**ACCEPTED** (Implemented in Phase 24 / Part 2)

## Context
Following the implementation of document upload, buyer OTP verification, bundle margin elasticity, and Razorpay refunds (Phase 23), key advanced capabilities were added to elevate Agent Sauda into an end-to-end intelligent commerce workbench:
1. **Dynamic Inventory Scarcity & Urgency Margin Guard**: When warehouse stock levels fall below critical thresholds ($\le 3$ units), continuing to grant standard discounts risks margin leakage on rare high-velocity goods. A real-time scarcity guard is required to tighten discount elasticity and protect inventory margin.
2. **Merchant AI Negotiation Simulation Sandbox**: Store owners and managers need a dedicated testbench (`/admin/simulator`) to stress-test their active policy guardrails against diverse simulated buyer personas (*Aggressive Wholesaler*, *Budget Student*, *Corporate Procurement Lead*, *Adversarial Injection Bot*) before deploying them live.
3. **Hands-Free Voice Negotiation**: Buyers on mobile or voice-enabled interfaces benefit from speech-to-text dictation and conversational text-to-speech audio playback.
4. **Multi-Currency & Regional FX Engine**: Global buyers and multi-region storefronts require real-time conversion across major currencies (INR ₹, USD $, EUR €, GBP £, AED د.إ) with consistent quotation formatting.
5. **Interactive Manager Webhook Dispatcher**: Administrators require visibility into the exact cryptographic payloads (Slack BlockKit JSON & WhatsApp templates) dispatched during HITL holds.

---

## Decision

### 1. Dynamic Low Stock Scarcity Guard
- In `policy.engine.ts`, when any evaluated catalog item has available stock $\le 3$ units:
  - Tightens the maximum allowable discount ceiling by $-2.5\%$.
  - Raises the effective margin floor by $+1.5\%$.
  - Injects a `POLICY_RULE_SCARCITY_GUARD` breakdown metric explaining the tightened margin threshold.

### 2. Merchant AI Negotiation Simulation Sandbox (`/admin/simulator`)
- Built an interactive simulation control center supporting 4 distinct buyer archetypes.
- Executes multi-round automated dialogues against the pure `@agent-sauda` deterministic policy engine.
- Visualizes round-by-round proposed prices, discount percentages, profit margins, counter-offers, and bounded autonomy decisions (`ALLOW`, `APPROVAL_REQUIRED`, `COUNTER`, `REJECT`).
- Verifies policy invariants and calculates final order settlement P&L.

### 3. Voice-Enabled Negotiation (Web Speech API)
- Implemented native Speech-to-Text (`SpeechRecognition` / `webkitSpeechRecognition`) with pulsing microphone animation in `ChatInterface.tsx`.
- Integrated Text-to-Speech (`SpeechSynthesisUtterance`) with automatic voice playback on agent responses and a quick mute/unmute audio toggle.

### 4. Multi-Currency & Regional FX Engine
- Added `SupportedCurrency` schemas (`INR`, `USD`, `EUR`, `GBP`, `AED`) and `formatCurrencyAmount()` helper in `@agent-sauda/domain`.
- Integrated instant currency switcher dropdown in the buyer storefront header and updated all `OfferCard` quotation components to render localized currency symbols.

### 5. Webhook Payload Inspector Modal
- Added interactive **"Inspect Webhook Payloads"** modal in `/admin/approvals` displaying real-time Slack BlockKit JSON and WhatsApp alert templates with SHA-256 HMAC cryptographic 1-click approval links.

---

## Consequences

### Positive
- **Margin Protection on Rare Inventory**: Low-stock items automatically resist over-discounting without manual inventory manager intervention.
- **Risk-Free Policy Experimentation**: Merchants can validate and fine-tune pricing guardrails against aggressive or adversarial bots in milliseconds.
- **Multimodal Accessibility**: Buyers can bargain naturally via voice, improving user engagement and conversion rates.
- **Global Currency Readiness**: Transparent pricing across international currency pairs.

---

## Related Notes
- [[ADR-007 Pure Rule Pipeline Without LLM Discretion]]
- [[ADR-010 Human in the Loop Approval Boundaries]]
- [[ADR-017 Public Buyer Conversational Negotiation UI]]
- [[ADR-025 Real-Time SSE Chat Streaming and HMAC Multi-Channel HITL Notifications]]
- [[ADR-026 Merchant Knowledge Document Upload, Buyer OTP Verification, Bundle Optimization, and Automated Razorpay Refunds]]
