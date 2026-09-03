# Agent Sauda — Knowledge Vault

> **Tagline:** *"AI agents negotiate. Merchants stay in control."*
> **Core Principle:** *"The AI may propose a money action, but the AI must never be the authority that authorizes the money action."*

Welcome to the **Agent Sauda Knowledge Vault**. This Obsidian vault serves as the structured knowledge layer of the project—capturing the **architecture, technical decisions (ADRs), concepts, and phase learnings**.

---

## 🗺️ Knowledge Map (MOC)

```
                       [[Index]]
                          │
     ┌──────────────┬─────┴──────────────┬──────────────┐
     ▼              ▼                    ▼              ▼
[[Architecture]]  [[ADRs]]           [[Phases]]    [[Concepts]]
```

### 1. 🏗️ [[System Architecture|Architecture]]
* [[System Architecture]]: High-level architecture, subsystem boundaries, and request flows.
* [[Separation of Concerns]]: The triad of AI Reasoning vs. Deterministic Policy vs. Money Movement.
* [[Security Model]]: Multi-tenant isolation, RBAC permissions, and prompt injection defense.
* [[API and Swagger]]: Fastify server, OpenAPI spec, and interactive testing via `/docs`.

### 2. 📜 [[ADR Index|Architectural Decision Records (ADRs)]]
* [[ADR-001 Modular Monolith]]: Why a modular monorepo (`apps/*`, `packages/*`) was chosen over microservices.
* [[ADR-002 AI Is Not The Authority]]: Why money authorization is strictly deterministic backend code.
* [[ADR-003 Decoupled Order and Payment State]]: Why `OrderStatus` and `PaymentStatus` are separate state machines.
* [[ADR-004 Database Level Tenant Isolation]]: Foreign key cascade policies and tenant scoping rules.
* [[ADR-005 Stateless JWT Sessions and RBAC]]: Stateless JWT authentication with `OWNER`, `ADMIN`, `STAFF` roles.
* [[ADR-006 Redacted Agent Catalog Boundary]]: Why internal `costPrice` is redacted from agent tools.
* [[ADR-007 Pure Rule Pipeline Without LLM Discretion]]: Pure mathematical evaluation engine without database/network I/O in the evaluation loop.
* [[ADR-008 Tool Calling Sales Agent with Fallback Driver]]: Tool-gated negotiation loop and deterministic driver fallback.
* [[ADR-009 Time-Bound Formal Offers with Expiration]]: Immutable offer creation with lazy 24-hour expiration.
* [[ADR-010 Human in the Loop Approval Boundaries]]: Locking offers in `DRAFT` and RBAC manager authorization for high-value orders.
* [[ADR-011 Atomic Inventory Reservation on Order Creation]]: Two-phase stock allocation and release on order cancellation.
* [[ADR-012 Decoupled Payment State Machine and Mockable Driver]]: Razorpay integration with integer paise precision and test drivers.
* [[ADR-013 Webhook Idempotency and Cryptographic Verification]]: HMAC SHA256 signatures, database idempotency, and permanent stock deduction.
* [[ADR-014 Post-Payment Order Fulfillment Pipeline]]: Warehouse packaging and shipment tracking timeline.
* [[ADR-015 Immutable Audit Trail and Forensic Compliance Engine]]: Multi-entity timeline reconstruction and CSV/JSON reporting.
* [[ADR-016 Merchant Commercial Analytics and Negotiation Intelligence]]: Realized profit formulas, AI win rate metrics, and dashboard API.
* [[ADR-017 Public Buyer Conversational Negotiation UI]]: Dynamic Next.js 15 negotiation storefront, interactive quote cards, and catalog drawer.
* [[ADR-018 Public Buyer Checkout and Real-Time Tracking]]: Two-column checkout review, Razorpay simulation modal, and 5-milestone delivery timeline.
* [[ADR-019 Merchant Control Portal and Management Architecture]]: Full merchant dashboard, policy sliders, HITL approvals queue, orders dispatch, and forensic audit log.
* [[ADR-020 End-to-End Multi-Actor System Integration]]: Comprehensive multi-actor simulation, prompt injection defense, and financial reconciliation.
* [[ADR-021 Pluggable Multi-Tier Caching and Database Index Optimization]]: RedisCacheDriver and MemoryCacheDriver adapter with 60s/120s TTL and composite Prisma indexes.

### 3. 🚀 [[Phases Index|Project Phases]]
* [[Phase 1 Foundation]]: Monorepo setup, Fastify, Next.js 15, TypeScript strictness, and Zod config.
* [[Phase 2 Database and Domain Model]]: 18 relational Prisma models, Neon PostgreSQL, and demo seeding.
* [[Phase 3 Authentication and Authorization]]: `bcrypt` hashing, `@fastify/jwt` sessions, and RBAC hooks.
* [[Phase 4 Merchant and Catalog Management]]: Catalog CRUD, warehouse inventory, and agent tool endpoint.
* [[Phase 5 Deterministic Policy Engine]]: Mathematical guardrails, 4 deterministic outcomes, and version history.
* [[Phase 6 AI Sales Agent]]: Autonomous sales agent with tool calling (`search_catalog`, `check_inventory`, `propose_offer`).
* [[Phase 7 Offer Management]]: Formal offer materialization, 24h expiration, and buyer checkout endpoints.
* [[Phase 8 Human in the Loop Approvals]]: Merchant approval queues, timeout auto-rejections, and manager actions.
* [[Phase 9 Order Creation and Validation]]: Atomic order creation, two-phase inventory reservation, and cancellation stock release.
* [[Phase 10 Razorpay Payments]]: Razorpay order creation, paise subunit precision, and checkout payloads.
* [[Phase 11 Razorpay Webhooks]]: Webhook idempotency, HMAC signature verification, and payment capture.
* [[Phase 12 Order Lifecycle Transitions]]: Post-payment fulfillment, delivery tracking, and completion.
* [[Phase 13 Audit Trail and Compliance Engine]]: Immutable audit trail, compliance queries, and regulatory reporting.
* [[Phase 14 Merchant Analytics Engine]]: Negotiation metrics, conversion funnels, and discount analytics.
* [[Phase 15 Public Buyer Chat UI]]: Real-time buyer negotiation and conversational storefront interface.
* [[Phase 16 Buyer Checkout UI]]: Razorpay checkout modal, order review, and 5-milestone live delivery tracking.
* [[Phase 17 Merchant Admin Dashboard]]: Merchant portal for catalog, policies, HITL approvals, orders, and analytics.
* [[Phase 18 End to End System Integration]]: Comprehensive multi-actor simulation and automated regression suite.
* [[Phase 19 Performance Optimization]]: Pluggable Redis & Memory caching, composite indexes, and sub-millisecond lookups.
* [[Phase 20 Security Hardening]]: Rate limiting, brute-force defense, and security middleware *(Next)*.

### 4. 💡 [[Concepts Index|Core Concepts]]
* [[Performance and Caching Architecture]]: Multi-tier caching topology, Redis vs Memory adapter, and proactive invalidation hooks.
* [[End-to-End System Integration]]: Multi-actor simulation and end-to-end commerce synchronization.
* [[Merchant Control Portal]]: Back-office management center for catalog, policy guardrails, approvals, orders, and compliance.
* [[Buyer Checkout and Payment Flow]]: Real-time quotation review, Razorpay execution, and 5-milestone delivery timeline.
* [[Buyer Negotiation Interface]]: Real-time conversational shopping stream with interactive quote widgets.
* [[Merchant Analytics and KPI Engine]]: Multi-dimensional commercial KPIs, AI negotiation metrics, and bestseller ranking.
* [[Deterministic Policy Engine]]: Pure mathematical functions vs LLM hallucinations.
* [[AI Tool Calling Loop]]: How conversational turns trigger backend tool executions.
* [[Offer Lifecycle State Machine]]: The journey of formal quotes from `ACTIVE` to `ACCEPTED`, `EXPIRED`, or `REJECTED`.
* [[HITL Approval Queue]]: The manager workflow for authorizing high-value commercial quotations.
* [[Inventory Reservation Engine]]: Two-phase stock allocation (`availableUnits` vs `reservedUnits`).
* [[Razorpay Payment Flow]]: Client-server-gateway interaction with integer paise precision.
* [[Webhook Processing and Idempotency]]: Cryptographic webhook ingestion and replay attack prevention.
* [[Order Fulfillment Lifecycle]]: Tracking physical warehouse fulfillment and delivery milestones.
* [[Audit Trail and Compliance Engine]]: Append-only provenance and forensic reconstruction across subsystems.
* [[Order State Machine]]: Explicit state lifecycle from `NEGOTIATING` to `PAID` / `COMPLETED`.
* [[Payment State Machine]]: Tracking raw Razorpay transaction attempts, signatures, and webhooks.
* [[Tenant Isolation]]: Preventing cross-merchant data leakage at the query layer.
* [[Agent Redaction Boundary]]: Ensuring LLMs cannot leak supplier costs or profit margins.
* [[Graphify vs Obsidian]]: The division between code structure analysis and project knowledge.

---

## 🔄 The Graphify + Obsidian + Antigravity Triad

| Tool | Role | Responsibility |
| :--- | :--- | :--- |
| **Graphify** | **Code Structure & Dependencies** | AST extraction, call-flows, symbols, community detection, code retrieval (`graphify query`). |
| **Obsidian** | **Knowledge & Reasoning** | Architecture, ADRs, "Why" decisions, human learning, and concept relationships (`[[links]]`). |
| **Antigravity** | **Agent Orchestrator** | Consults Graphify for code structure, consults Obsidian for decisions & constraints, and writes code. |
