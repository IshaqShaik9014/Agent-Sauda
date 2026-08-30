# Tenant Isolation

**Tenant Isolation** ensures that each merchant organization operates in a completely isolated silo, even though all merchants share the same PostgreSQL database.

Related: [[Index]], [[ADR-004 Database Level Tenant Isolation]], [[Security Model]], [[Phase 2 Database and Domain Model]]

---

## 🏢 How Tenant Isolation is Enforced

1. **Foreign Key Constraints:**
   - Every product, inventory batch, policy, conversation, offer, approval, and order record has an immutable `merchantId` field.

2. **Middleware Scope Verification (`requireMerchantAccess`):**
   - The route parameter `request.params.merchantId` is compared with the caller's verified JWT claim `request.user.merchantId`.
   - If they do not match, Fastify immediately halts execution with **`403 Forbidden` (`CROSS_TENANT_FORBIDDEN`)**.

3. **Database Repository Scoping:**
   - All Prisma queries explicitly filter by `where: { merchantId }` to ensure zero cross-contamination.
