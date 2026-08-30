# ADR-004: Database-Level Tenant Isolation

* **Status:** Accepted
* **Date:** 2026-08-30
* **Context:** Ensuring hard isolation between competing merchants in a shared multi-tenant database.

Related: [[Index]], [[Tenant Isolation]], [[Security Model]], [[Phase 2 Database and Domain Model]]

---

## 🎯 Context & Problem Statement
In multi-tenant commerce, merchant catalog data, cost structures, orders, and customer conversations must never be exposed or modified by another merchant.

---

## ⚖️ Decision
1. **Mandatory Foreign Keys:** Every merchant-owned entity (`Product`, `Inventory`, `Policy`, `PolicyVersion`, `Conversation`, `Offer`, `Approval`, `Order`, `Payment`, `AuditEvent`) has a non-nullable `merchantId` foreign key.
2. **Cascade vs. Restrict Policies:**
   - Catalog items and policies delete with the merchant (`onDelete: Cascade`).
   - Financial records (`Order`, `Payment`, `AuditEvent`) are strictly preserved for accounting compliance (`onDelete: Restrict`).
3. **Middleware Guard:** `requireMerchantAccess('merchantId')` checks that the caller's JWT claims match the route's target merchant before executing any database query.

---

## 💡 Consequences & Trade-offs
* **Pros:**
  - Guarantees at both the database layer and API layer that data cannot leak between tenants.
  - Indexed composite keys (`[merchantId, slug]`, `[merchantId, status]`) optimize query speeds.
