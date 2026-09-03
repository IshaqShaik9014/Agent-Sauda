# Performance and Caching Architecture

The **Performance and Caching Architecture** delivers sub-millisecond response times for AI negotiations, protects database connection pools under load, and guarantees zero stale state across horizontal production containers.

Related: [[Index]], [[Deterministic Policy Engine]], [[AI Tool Calling Loop]], [[Merchant Control Portal]], [[ADR-021 Pluggable Multi-Tier Caching and Database Index Optimization]], [[Phase 19 Performance Optimization]]

---

## 🏛️ Multi-Tier Driver Topology

```
                  ┌────────────────────────────────────────┐
                  │           Fastify API Layer            │
                  └───────────────────┬────────────────────┘
                                      │
                                      ▼
                        ┌───────────────────────────┐
                        │    CacheService (API)     │
                        └─────────────┬─────────────┘
                                      │
               ┌──────────────────────┴──────────────────────┐
               ▼                                             ▼
┌───────────────────────────────┐             ┌───────────────────────────────┐
│     RedisCacheDriver          │             │     MemoryCacheDriver         │
│     (Production / Cloud)      │             │  (Local Dev & Unit Tests)     │
│                               │             │                               │
│  • ioredis client             │             │  • Zero-config fallback       │
│  • Shared across Pods         │             │  • Sub-millisecond RAM read   │
│  • Distributed invalidations  │             │  • 0.02ms latency             │
└───────────────────────────────┘             └───────────────────────────────┘
```

---

## ⚡ Caching Invariants & Invalidation Hooks
1. **Policy Cache (`sauda:policy:merchant:<id>`):**
   - Read during every offer evaluation.
   - Cache TTL: 60 seconds.
   - Invalidated immediately on `PUT /api/merchants/:id/policy`.
2. **Catalog Cache (`sauda:catalog:slug:<slug>`):**
   - Read during buyer discovery and AI search tool execution.
   - Cache TTL: 120 seconds.
   - Invalidated immediately on `POST /products`, `PATCH /products/:id`, and `PATCH /inventory/:productId`.
3. **Database Composite Indexes:**
   - Multi-column B-Tree indexes speed up range queries on `offers(merchantId, status, createdAt)` and `orders(merchantId, status, createdAt)` from $O(N)$ table scans to $O(\log N)$ index seeks.
