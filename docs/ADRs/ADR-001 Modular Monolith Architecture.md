# ADR-001: Modular Monolith Architecture

* **Status:** Accepted
* **Date:** 2026-08-29
* **Context:** Deciding the repository and codebase architecture for Agent Sauda.

Related: [[Index]], [[System Architecture]], [[Phase 1 Foundation]]

---

## 🎯 Context & Problem Statement
We need an architecture that supports both frontend (Next.js 15), backend API (Fastify), and shared domain schemas (`packages/domain`, `packages/database`) without the operational overhead, distributed network failures, and latency of microservices.

---

## ⚖️ Decision
Adopt a **Modular Monolith** using standard **npm workspaces**:
* `apps/api`: Fastify backend handling business logic and money actions.
* `apps/web`: Next.js 15 frontend handling merchant dashboard and buyer chat.
* `packages/database`: Prisma ORM client with PostgreSQL connection.
* `packages/domain`: Pure TypeScript types, state machine enums, and Zod schemas.

---

## 💡 Consequences & Trade-offs
* **Pros:**
  - Zero deployment friction for local development and buildathons.
  - End-to-end type safety between frontend, backend, and database without publishing private npm packages.
  - Atomic changes across API routes and database schemas in single Git commits.
* **Cons:**
  - Shared repository requires discipline around package boundaries (enforced by TypeScript references and workspace configs).
