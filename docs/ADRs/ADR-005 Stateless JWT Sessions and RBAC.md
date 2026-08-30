# ADR-005: Stateless JWT Sessions and RBAC

* **Status:** Accepted
* **Date:** 2026-08-30
* **Context:** Choosing session management and authorization mechanisms for merchants and staff.

Related: [[Index]], [[Security Model]], [[Phase 3 Authentication and Authorization]]

---

## 🎯 Context & Problem Statement
We need an authentication mechanism that supports fast API requests, works seamlessly across Swagger and web clients, and enforces role permissions (`OWNER`, `ADMIN`, `STAFF`).

---

## ⚖️ Decision
* **Password Security:** Use `bcrypt` with 10 salt rounds for all user credentials.
* **Session Tokens:** Use signed stateless JWTs (`@fastify/jwt`) containing `{ userId, email, merchantId, merchantSlug, role }` with 7-day expiration.
* **Role-Based Access Control:** Use Fastify hook `requireRole(['OWNER', 'ADMIN'])` to gate privileged endpoints.

---

## 💡 Consequences & Trade-offs
* **Pros:**
  - Stateless: Fastify handles verification without hitting the database on every HTTP request.
  - Swagger Compatible: Easily authenticated via standard Bearer tokens in Swagger UI.
* **Cons:**
  - Token revocation before expiry requires token blacklisting or short expiration periods.
