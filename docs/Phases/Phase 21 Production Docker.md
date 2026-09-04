# Phase 21: Production Docker & Deployment Orchestration

* **Status:** Completed & Verified ✅
* **Scope:** Production-grade multi-stage containerization for Next.js 15 and Fastify API, single-command orchestration via `docker-compose.yml`, root `.dockerignore`, environment templates, and automated verification.

Related: [[Index]], [[ADR-024 Production Docker Containerization]], [[ADR-001 Modular Monolith Architecture]], [[Phase 20 Security Hardening]]

---

## 🎯 What Was Implemented
* **Next.js 15 Standalone Dockerfile (`apps/web/Dockerfile`):**
  - Enabled `output: 'standalone'` in `apps/web/next.config.mjs`.
  - Multi-stage build (`deps` $\rightarrow$ `builder` $\rightarrow$ `runner`).
  - Next.js traces production dependencies, reducing image size from ~1.2GB to ~120MB.
  - Runs as unprivileged non-root user `nextjs:nodejs` on port 3000.
  - Native container health check via `curl -f http://localhost:3000/api/health`.
* **Fastify API Dockerfile (`apps/api/Dockerfile`):**
  - Multi-stage build with Prisma client generation in `@agent-sauda/database`.
  - Compiles TypeScript packages in dependency order (`@agent-sauda/domain`, `@agent-sauda/database`, `@agent-sauda/api`).
  - Runs as unprivileged non-root user `apiuser:apigroup` on port 4000.
  - Native container health check via `curl -f http://localhost:4000/health`.
* **Docker Compose Orchestration (`docker-compose.yml`):**
  - **`redis`:** Redis 7 Alpine with persistent volume and health check (`redis-cli ping`).
  - **`api`:** Fastify commerce engine, depends on `redis` health check, connected to PostgreSQL.
  - **`web`:** Next.js frontend, depends on `api` health check.
  - Bridge network `sauda-net` and named volume `redis-data`.
* **Production Build Ignore Rules (`.dockerignore`):**
  - Excludes `node_modules`, `.next`, `dist`, `.env*`, `.git`, and documentation artifacts to maximize Docker layer cache efficiency.
* **Environment Configuration (`.env.docker.example`):**
  - Production-ready template with database connection, Redis URL, JWT secrets, and Razorpay keys.
* **Automated Verification Suite (`scripts/verify-docker-builds.ts`):**
  - Validates Dockerfile multi-stage targets, Compose service topology, `.dockerignore` rules, health check routes, and environment configuration.

---

## 🧪 Verification Results
* **Root `.dockerignore`:** Excludes secrets and local dependencies.
* **API Dockerfile:** Multi-stage stages (`deps`, `builder`, `runner`) and health check verified.
* **Web Dockerfile:** Next.js `standalone` mode and unprivileged runner verified.
* **Docker Compose:** Redis, API, and Web services configured with dependency ordering.
* **Container Health Probes:** Both `/health` and `/api/health` verified.
