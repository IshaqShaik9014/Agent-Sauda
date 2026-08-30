# System Architecture

The **Agent Sauda** platform enables autonomous AI buyer-to-merchant sales negotiations while keeping the merchant in total deterministic financial control.

Related: [[Index]], [[Separation of Concerns]], [[Security Model]], [[Deterministic Policy Engine]], [[ADR-001 Modular Monolith]]

---

## 🏛️ High-Level Architectural Flow

```
                      BUYER / SIMULATED AI BUYER
                                  │
                                  ▼ (Natural Language Request)
                       MERCHANT SALES AGENT (LLM)
                                  │
                          TOOL INVOCATIONS
                                  │
         ┌────────────────────────┼────────────────────────┐
         ▼                        ▼                        ▼
   [[Agent Redaction Boundary|search_catalog]]     [[check_inventory]]      [[calculate_offer]]
         │                        │                        │
         └────────────────────────┬────────────────────────┘
                                  ▼
                     [[Deterministic Policy Engine]]
                 (Pure TypeScript - Zero LLM Discretion)
                                  │
         ┌────────────────────────┼────────────────────────┐
         ▼                        ▼                        ▼
      ALLOW                    COUNTER              APPROVAL_REQUIRED
         │                        │                        │
         │                        ▼                        ▼
         │               Counter-Offer Back to AI    Merchant Human Approval
         │                        │                        │
         └────────────────────────┴────────────────────────┘
                                  ▼
                         [[Order State Machine]]
                                  │
                                  ▼
                        [[Payment State Machine]]
                                  │
                                  ▼
                         RAZORPAY TEST MODE
                                  │
                                  ▼ (Webhook POST /api/webhooks/razorpay)
                     IDEMPOTENT WEBHOOK CONTROLLER
                                  │
                                  ▼
                        IMMUTABLE AUDIT TRAIL
```

---

## 📦 Workspace Subsystems

1. **`apps/api` (Fastify Backend)**:
   - Encapsulates private secrets (Razorpay keys, JWT secret, database connection).
   - Hosts all REST endpoints, middleware hooks, policy evaluation, and Swagger UI at `/docs`.
   - Connected to: [[Phase 1 Foundation]], [[Phase 3 Authentication and Authorization]], [[API and Swagger]].

2. **`apps/web` (Next.js Frontend)**:
   - Merchant Dashboard: Catalog management, policy configuration, approval queue, audit logs.
   - Buyer Interface: Real-time negotiation chat and Razorpay test checkout.

3. **`packages/database` (Prisma + Neon PostgreSQL)**:
   - 18 relational models with strict multi-tenant foreign keys (`merchantId`).
   - Connected to: [[Phase 2 Database and Domain Model]], [[Tenant Isolation]].

4. **`packages/domain` (Shared Types & Schemas)**:
   - Zod validation schemas and core enums (`OrderStatus`, `PaymentStatus`, `PolicyDecision`, `MerchantRole`).
