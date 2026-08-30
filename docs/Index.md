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

### 3. 🚀 [[Phases Index|Project Phases]]
* [[Phase 1 Foundation]]: Monorepo setup, Fastify, Next.js 15, TypeScript strictness, and Zod config.
* [[Phase 2 Database and Domain Model]]: 18 relational Prisma models, Neon PostgreSQL, and demo seeding.
* [[Phase 3 Authentication and Authorization]]: `bcrypt` hashing, `@fastify/jwt` sessions, and RBAC hooks.
* [[Phase 4 Merchant and Catalog Management]]: Catalog CRUD, warehouse inventory, and agent tool endpoint.
* [[Phase 5 Deterministic Policy Engine]]: Mathematical guardrails, 4 deterministic outcomes, and version history.
* [[Phase 6 AI Sales Agent]]: Autonomous sales agent with tool calling (`search_catalog`, `check_inventory`, `propose_offer`).
* [[Phase 7 Offer Management]]: Structured offer state machine, lifecycle tracking, and checkout link generation *(Next)*.

### 4. 💡 [[Concepts Index|Core Concepts]]
* [[Deterministic Policy Engine]]: Pure mathematical functions vs LLM hallucinations.
* [[AI Tool Calling Loop]]: How conversational turns trigger backend tool executions.
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
