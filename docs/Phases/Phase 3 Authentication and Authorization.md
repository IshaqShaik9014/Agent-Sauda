# Phase 3: Authentication and Authorization

* **Status:** Completed & Verified ✅
* **Scope:** Multi-tenant registration, `bcrypt` password hashing, `@fastify/jwt` stateless session tokens, RBAC hooks, and Swagger UI at `/docs`.

Related: [[Index]], [[ADR-005 Stateless JWT Sessions and RBAC]], [[Security Model]], [[Phase 4 Merchant and Catalog Management]]

---

## 🎯 What Was Implemented
* **Atomic Registration:** `POST /api/auth/register` creates `User`, `Merchant`, `MerchantMember` (`OWNER`), and `Policy` in one transaction.
* **Credential Verification:** `POST /api/auth/login` verifies passwords with `bcrypt` and issues signed JWT tokens.
* **Fastify Middleware Hooks:**
  - `authenticate`: Validates JWT token and decorates `request.user`.
  - `requireRole(['OWNER', 'ADMIN'])`: Enforces RBAC permissions.
  - `requireMerchantAccess('merchantId')`: Blocks cross-tenant data requests.
* **Interactive Swagger UI:** Added `@fastify/swagger` and `@fastify/swagger-ui` with OpenAPI specs at `http://localhost:4000/docs`.

---

## 🧪 Verification & Proof
* Ran `npx tsx scripts/verify-auth.ts` $\rightarrow$ 7 automated tests passed:
  1. Atomic merchant & owner creation (201).
  2. Duplicate email/slug rejection (409).
  3. Login with valid password (200).
  4. Login with invalid password (401).
  5. Protected route unauthenticated rejection (401).
  6. Protected route authenticated session retrieval (200).
  7. Cryptographic signature tampering rejection (401).
* Git commits: `0c2e027` & `92be537` (pushed to GitHub).
