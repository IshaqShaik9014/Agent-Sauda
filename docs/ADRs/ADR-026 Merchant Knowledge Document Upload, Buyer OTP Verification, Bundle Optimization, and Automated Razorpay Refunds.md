# ADR-026: Merchant Knowledge Document Upload, Buyer OTP Verification, Bundle Optimization, and Automated Razorpay Refunds

## Status
**ACCEPTED** (Implemented in Phase 23)

## Context
Following the implementation of real-time SSE chat streaming and HITL webhooks (Phase 22), key enterprise capabilities were required to bridge operational friction:
1. **Unstructured Knowledge Document Ingestion**: Merchants previously could only type or paste plain text into the RAG portal. A production-grade dropzone supporting drag-and-drop file ingestion (`.pdf`, `.md`, `.txt`, `.csv`, `.json`, `.docx`) with instant auto-chunking preview and pgvector persistence was needed.
2. **Buyer Identity & OTP Verification**: High-ticket enterprise wholesale orders (e.g. ₹5,00,000 quotations) require authenticated buyer identity rather than anonymous guest browser sessions.
3. **Multi-Product Bundle Optimization**: High gross-margin multi-product baskets (e.g., buying a Standing Desk + Ergonomic Chair) warrant dynamic cross-product basket discounting (+2.5% discount elasticity) while maintaining mathematical gross margin guardrails.
4. **Automated Razorpay Refund Execution**: Reversing payments on returned goods must trigger live Razorpay payment refund APIs (`POST /v1/payments/:id/refund`) and restock warehouse inventory atomically.

## Decision

### 1. Document Upload & Live Auto-Chunking Engine
- Upgraded `/admin/knowledge` with a drag-and-drop file dropzone and client-side stream parser.
- Added live auto-chunking telemetry calculating character lengths, token approximations, and semantic chunks (~500 chars with 80-char overlap) before persisting 768-dim embeddings into PostgreSQL via `pgvector`.
- Automated document title and category inference (`RETURN_POLICY`, `WARRANTY`, `SHIPPING`, `FAQ`, `TERMS`).

### 2. Verified Buyer Identity & OTP Verification
- Added interactive buyer identity verification modal and verified status badge (`🛡️ Verified Buyer`).
- Attaches authenticated buyer profile (`customerName`, `customerPhone`, `customerEmail`) to conversational negotiation turns and quote reservations.

### 3. Multi-Product Cross-Basket Bundle Margin Pooling
- In `policy.engine.ts`, when `itemFacts.length >= 2` and combined basket gross margin $\ge \text{minimumMargin} + 4\%$:
  - Automatically grants a +2.5% bundle bonus discount elasticity.
  - Generates a `POLICY_RULE_BUNDLE_OPTIMIZATION` breakdown metric demonstrating mathematically protected profit margins.

### 4. Automated Razorpay Refund & Return Execution
- Implemented `refundPayment()` in `payment.driver.ts` supporting both live Razorpay production endpoints and mock test environments.
- Added `POST /api/merchants/:merchantId/orders/:orderId/refund` route executing an atomic transaction:
  - Updates `Payment` status to `REFUNDED`.
  - Increments available inventory in `Inventory` table for returned product items.
  - Updates `Order` status to `CANCELLED` / `REFUNDED` with resolution notes.
  - Emits immutable `ORDER_REFUNDED` audit log for forensic compliance.
- Added 1-click **"Refund"** modal in `/admin/orders` portal.

## Consequences

### Positive
- **Frictionless Document Ingestion**: Store managers upload PDF/Markdown policies in 1 click and inspect chunking breakdown.
- **Enterprise Authenticity**: Wholesale B2B buyers verify credentials before locking formal quotations.
- **Increased Cart Value**: Cross-product bundling incentivizes multi-item purchases safely within merchant profit floors.
- **Complete Financial Lifecycle**: Reversible payments with live Razorpay refunds and automatic stock replenishment.

## Related Notes
- [[ADR-007 Pure Rule Pipeline Without LLM Discretion]]
- [[ADR-012 Decoupled Payment State Machine and Mockable Driver]]
- [[ADR-023 PostgreSQL pgvector Knowledge RAG and B2B Commerce SDK]]
- [[ADR-025 Real-Time SSE Chat Streaming and HMAC Multi-Channel HITL Notifications]]
