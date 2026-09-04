# ADR-024: Production Docker Containerization and Multi-Stage Builds

* **Status:** Accepted
* **Date:** 2026-09-04
* **Context:** Providing lightweight, reproducible, and secure container images for production deployment of the Fastify API and Next.js 15 web application.

Related: [[Index]], [[ADR-001 Modular Monolith Architecture]], [[ADR-021 Pluggable Multi-Tier Caching and Database Index Optimization]], [[ADR-022 Production Security Hardening and Distributed Rate Limiting]], [[Phase 21 Production Docker]]

---

## 🎯 Context & Problem Statement
Deploying a modern TypeScript monorepo with multiple applications (`apps/api`, `apps/web`) and shared packages (`packages/domain`, `packages/database`) presents specific deployment challenges:
1. **Container Image Bloat:** Naively copying the entire monorepo and `node_modules` into a container results in images $>1.2\text{GB}$.
2. **Security Vulnerabilities:** Running containers as `root` creates privilege escalation risks in multi-tenant cloud environments.
3. **Build Reproducibility:** Differences in system dependencies (OpenSSL, glibc vs musl) can cause Prisma native binaries or Fastify plugins to fail.
4. **Local Orchestration Complexity:** Developers and staging operators need a single command to boot the API, web interface, and Redis cache.

---

## ⚖️ Decision
1. **Multi-Stage Docker Architecture:**
   - Both `apps/api/Dockerfile` and `apps/web/Dockerfile` utilize three distinct stages:
     - `deps`: Installs root workspace dependencies via `npm ci`.
     - `builder`: Generates Prisma clients and compiles TypeScript artifacts.
     - `runner`: Minimal Node.js 20 Alpine base with only production artifacts and non-root execution.
2. **Next.js 15 Standalone Mode (`output: 'standalone'`):**
   - Enabled in `apps/web/next.config.mjs`.
   - Next.js automatically traces and copies only required dependencies into `.next/standalone`, slashing container size by ~90% down to ~120MB.
3. **Security Hardening in Containers:**
   - Fastify API executes as `apiuser:apigroup` (UID/GID 1001).
   - Next.js Web executes as `nextjs:nodejs` (UID/GID 1001).
   - Containers include explicit `HEALTHCHECK` probes on `/health` and `/api/health`.
4. **Docker Compose Orchestration (`docker-compose.yml`):**
   - Coordinates `redis` (Redis 7 Alpine), `api` (Fastify), and `web` (Next.js) on isolated bridge network `sauda-net`.
   - Uses `service_healthy` condition checks to ensure services boot in correct dependency order.

---

## 💡 Consequences & Trade-offs
* **Pros:**
  - Fast, reproducible cloud deployments across AWS ECS, Render, Railway, Fly.io, or VPS.
  - Drastically reduced cold-start and image transfer times due to ~120MB image footprint.
  - Zero root-level security exposure in production containers.
* **Cons:**
  - Standalone Next.js requires manual copying of `public/` and `.next/static` assets into the runner stage (handled cleanly in `apps/web/Dockerfile`).
