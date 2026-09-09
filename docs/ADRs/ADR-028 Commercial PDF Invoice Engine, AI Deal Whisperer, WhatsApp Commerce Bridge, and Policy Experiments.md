# ADR-028: Commercial PDF Invoice Engine, AI Deal Whisperer, WhatsApp Commerce Bridge, and Policy Experiments

## Status
**ACCEPTED** (Implemented in Phase 25)

## Context
As Agent Sauda transitions into an enterprise-grade commercial negotiation platform, four mission-critical operational and distribution capabilities were implemented:
1. **Cryptographic Proforma Quotations & Commercial Tax Invoices**: Enterprise buyers require formal, printable PDF Proforma Quotations and GST Tax Invoices featuring itemized tax breakdown (9% CGST + 9% SGST), merchant digital signature seals, buyer verification badges, and Razorpay dynamic UPI QR codes for immediate offline-to-online settlement.
2. **Merchant AI Deal Whisperer & Real-Time Approval Copilot**: In `/admin/approvals`, human managers evaluating high-value deal holds need instant contextual intelligence — including buyer Lifetime Value (LTV) tiering, inventory velocity, and explainable AI recommendations (`🟢 Strong Approve`, `🟡 Counter`, `🔴 High Risk`) with margin attribution.
3. **WhatsApp B2B Commerce Bot Bridge & Smartphone Simulator**: High-volume B2B wholesale transactions predominantly occur over WhatsApp. An omnichannel Meta WhatsApp Cloud API bridge (`/api/webhooks/whatsapp` & `/api/agent/whatsapp/webhook`) and an interactive smartphone simulator in `/admin/connect` were required to negotiate deals, format WhatsApp interactive reply buttons, and lock quotations natively in chat.
4. **Automated Policy A/B Testing & Margin Experimentation Workbench**: Store owners require a systematic workbench (`/admin/experiments`) to split-test pricing strategies (e.g. *Volume Velocity* vs *Margin Maximizer*) and run Monte Carlo simulations to measure conversion, gross margin, and statistical confidence ($p < 0.05$) before live deployment.

---

## Decision

### 1. Cryptographic PDF Proforma Quotation & Commercial Tax Invoice Engine
- Created [`InvoiceModal.tsx`](file:///apps/web/src/components/InvoiceModal.tsx) supporting both **Proforma Quotations** (pre-payment) and **Commercial Tax Invoices** (post-payment).
- Generates official Indian GST compliance details:
  - Seller GSTIN, PAN, and Registered Business Address.
  - Tax breakdown ($9\%$ CGST + $9\%$ SGST) on taxable subtotal.
  - Razorpay UPI QR code generated with dynamic payload `upi://pay?pa=agentsauda@razorpay&pn=...&am=...`.
  - Cryptographic verification hash (`SHA-256`) guaranteeing document immutability and authenticity.
  - Integrated into buyer quotation cards (`OfferCard.tsx`) and admin order history (`/admin/orders`).

### 2. Merchant AI Deal Whisperer in HITL Approvals (`/admin/approvals`)
- Integrated a real-time copilot card analyzing pending approval holds:
  - **Buyer LTV Tiering**: Analyzes customer purchase frequency and assigns tiers (*Gold Enterprise Buyer*, *Wholesale Partner*, *New Inquirer*).
  - **Inventory Velocity**: Evaluates product stock turnover days and reorder lead times.
  - **Explainable Recommendation**: Computes bounded decision rationale (`🟢 Strong Approve` for positive net margin + high LTV, `🟡 Counter` for marginal orders, `🔴 High Risk` for below-cost attempts).

### 3. WhatsApp B2B Commerce Bot Bridge & Smartphone Simulator
- Implemented webhook endpoints in `apps/api/src/modules/agent/agent.routes.ts`:
  - `GET /api/agent/whatsapp/webhook` & `GET /api/webhooks/whatsapp`: Meta Cloud API verify token handshake (`agent_sauda_wa_verify_2026`).
  - `POST /api/agent/whatsapp/webhook` & `POST /api/webhooks/whatsapp`: Ingests inbound text messages, routes them through `agentService.chat()`, and returns WhatsApp-formatted markdown, interactive action buttons (`[💳 Pay ₹X via UPI]`, `[📄 Proforma Invoice]`), and direct checkout URLs.
- Enhanced [`/admin/connect`](file:///apps/web/src/app/admin/connect/page.tsx) with a live interactive smartphone simulator for real-time testing.

### 4. Automated Policy A/B Testing & Margin Workbench (`/admin/experiments`)
- Created a dedicated experiments control center:
  - Configure **Variant A** (Volume Velocity) vs **Variant B** (Margin Maximizer).
  - Interactive traffic allocation slider ($10\%$ to $90\%$).
  - Built-in Monte Carlo simulation engine executing 150 simulated deal negotiations to calculate Conversion Rate, Average Margin, Total Gross Profit, and Statistical Significance ($Z$-score and $p$-value).
  - 1-Click deployment of winning policy variants directly to production.

---

## Consequences

### Positive
- **Enterprise Deal Closure**: B2B buyers can immediately generate, print, and circulate formal tax quotes within corporate procurement departments.
- **Informed HITL Decisions**: Merchant managers approve deals with full visibility into buyer LTV and inventory velocity instead of guessing.
- **Omnichannel Distribution**: Merchants can deploy the same deterministic negotiation engine to WhatsApp, Web, and mobile apps.
- **Empirical Margin Optimization**: Merchants make pricing policy decisions based on statistical data rather than intuition.

---

## Related Notes
- [[ADR-007 Pure Rule Pipeline Without LLM Discretion]]
- [[ADR-010 Human in the Loop Approval Boundaries]]
- [[ADR-013 Webhook Idempotency and Cryptographic Verification]]
- [[ADR-023 PostgreSQL pgvector Knowledge RAG and B2B Commerce SDK]]
- [[ADR-027 Dynamic Scarcity Guard, Voice Negotiation, Multi-Currency, and Merchant Simulation Sandbox]]
