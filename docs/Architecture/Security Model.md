# Security Model

The security architecture of **Agent Sauda** is designed around zero trust across external inputs, AI outputs, and multi-tenant data access.

Related: [[Index]], [[Tenant Isolation]], [[ADR-004 Database Level Tenant Isolation]], [[ADR-005 Stateless JWT Sessions and RBAC]]

---

## 🛡️ Security Perimeter & Defenses

```
   [ Client / Browser ]            [ External AI Output ]         [ Webhook Payloads ]
           │                                 │                             │
           ▼ (Untrusted)                     ▼ (Untrusted)                 ▼ (Untrusted)
+─────────────────────────────────────────────────────────────────────────────────────+
|                               FASTIFY SECURITY GATEWAY                              |
|  - Zod Schema Validation on every body / query / param input                        |
|  - JWT Bearer Signature Verification (@fastify/jwt)                                 |
|  - Role-Based Access Control hook (requireRole: OWNER / ADMIN / STAFF)              |
|  - Tenant Scope Match (requireMerchantAccess: caller.merchantId == route.merchantId)|
+──────────────────────────────────────────┬──────────────────────────────────────────+
                                           │ (Sanitized & Authenticated)
                                           ▼
+─────────────────────────────────────────────────────────────────────────────────────+
|                             DATABASE & DOMAIN BOUNDARY                              |
|  - All queries strictly scoped by WHERE merchantId = :merchantId                    |
|  - Razorpay secrets never exposed to frontend or LLM prompt                         |
|  - Immutable audit logs written for every money/pricing/inventory change            |
+─────────────────────────────────────────────────────────────────────────────────────+
```

---

## 🔒 Key Security Guarantees

1. **Multi-Tenant Isolation**:
   - Every database model (products, inventory, policies, orders, payments, audit events) has a foreign key to `Merchant`.
   - The `requireMerchantAccess` middleware returns `403 Forbidden` if a token from Merchant A attempts to access Merchant B's resources.

2. **Server-Side Secret Isolation**:
   - Razorpay API keys, Razorpay webhook secrets, database credentials, and JWT signing keys live strictly on the server in `.env`.
   - Frontend and AI agents never have access to private keys.

3. **Tamper-Resistant JWT Tokens**:
   - Signed with HMAC-SHA256 (`JWT_SECRET`). Altering any byte in the token payload immediately invalidates the cryptographic signature (`401 Unauthorized`).
