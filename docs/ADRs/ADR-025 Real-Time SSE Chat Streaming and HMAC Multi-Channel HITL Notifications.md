# ADR-025: Real-Time SSE Chat Streaming and HMAC Multi-Channel HITL Notifications

## Status
**ACCEPTED** (Implemented in Phase 22)

## Context
In commercial negotiation interfaces, conversational latency is a critical UX factor. Prior to this enhancement:
1. The AI sales agent processed conversational turns synchronously via `POST /api/agent/chat`, requiring the buyer to wait for the complete response before seeing any text.
2. Store managers needed to be logged into the desktop admin portal to review quotations that exceeded autonomous thresholds (`APPROVAL_REQUIRED`), causing deal delays when buyers were actively waiting.

To provide a modern, production-grade conversational experience and accelerate merchant authorization velocity, we required:
- Token-by-token streaming with live tool-calling telemetry so buyers understand what the agent is doing (e.g., searching catalog, checking warehouse stock, validating merchant policy).
- Multi-channel manager notifications (Slack, Discord, WhatsApp, Telegram, or custom webhook) dispatching rich BlockKit summaries with 1-click HMAC-signed cryptographic authorization URLs.

## Decision

### 1. Server-Sent Events (SSE) Streaming Architecture
We introduced a dedicated streaming endpoint `POST /api/agent/chat/stream` utilizing standard HTTP Server-Sent Events (`text/event-stream`).

- **Stream Protocol Events**:
  - `text_delta`: Emits conversational tokens in real time.
  - `tool_call`: Emits tool start telemetry (`search_catalog`, `check_inventory`, `search_knowledge_base`, `propose_offer`).
  - `tool_result`: Emits tool completion data.
  - `policy_evaluated`: Emits deterministic guardrail verdict (`ALLOW`, `COUNTER`, `APPROVAL_REQUIRED`, `REJECT`).
  - `offer_ready`: Dispatches the structured quotation payload for inline card rendering.
  - `done`: Signals the conclusion of the turn and returns the finalized response object.

- **Resilient Fallback**: If LLM provider streaming is interrupted or operates in batch mode, the `AgentStreamManager` gracefully streams tokens with natural word-by-word cadence.

### 2. Cryptographic HMAC-Signed 1-Click Mobile Approvals
For deals requiring human manager review:
- The backend generates a SHA-256 HMAC token with an embedded 24-hour expiration timestamp using `HMAC_SECRET`:
  $$\text{Token} = \text{Base64Url}(\text{offerId} : \text{timestamp} : \text{HMAC-SHA256}(\text{offerId} : \text{timestamp}, \text{Secret}))$$
- An alert is dispatched to configured merchant notification webhooks with deal financials (Quantity, Total, Discount %, Gross Margin %, Reason) and a 1-click approval link:
  `GET /api/offers/:offerId/quick-approve?token=...`
- When accessed, the endpoint cryptographically verifies the signature, ensures the token has not expired, and executes an atomic Prisma transaction transitioning the offer to `ACTIVE` and updating the approval record to `APPROVED`.

## Consequences

### Positive
- **Instant Buyer Feedback**: Time-to-first-token drops to sub-100ms, eliminating perceived conversational stall.
- **High Transparency**: Buyers see real-time tool badges (*"Searching catalog..."*, *"Checking inventory..."*, *"Validating discount policy..."*), building trust.
- **Fast Authorization**: Managers authorize quotations directly from mobile notification channels without logging into a desktop dashboard.
- **Tamper-Proof**: HMAC signature prevents forged approvals or unauthorized status transitions.

### Negative / Trade-offs
- SSE streams require open HTTP connections; distributed environments must maintain proper keep-alive headers (`Cache-Control: no-cache`, `Connection: keep-alive`).

## Related Notes
- [[ADR-008 Tool Calling Sales Agent with Fallback Driver]]
- [[ADR-010 Human in the Loop Approval Boundaries]]
- [[Concepts/HITL Approval Queue]]
- [[Concepts/Buyer Negotiation Interface]]
