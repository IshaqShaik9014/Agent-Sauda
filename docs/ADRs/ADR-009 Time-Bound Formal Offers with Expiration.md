# ADR-009: Time-Bound Formal Offers with Lazy Expiration

* **Status:** Accepted
* **Date:** 2026-08-30
* **Context:** Formalizing agreed negotiations into legally binding, time-limited commercial offers.

Related: [[Index]], [[Offer Lifecycle State Machine]], [[Deterministic Policy Engine]], [[Phase 7 Offer Management]]

---

## 🎯 Context & Problem Statement
When an AI agent or merchant agrees on a discounted quotation with a buyer, market conditions (wholesale supply costs, warehouse inventory, currency inflation) will shift over time. Allowing buyers to retain open quotations indefinitely exposes merchants to unhedged financial risk.

---

## ⚖️ Decision
1. **Immutable Formal Offer Record:**
   - Every agreed deal is materialized as a unique, immutable `Offer` with relational `OfferItem` records in PostgreSQL.
   - Financial totals (`subtotal`, `discountAmount`, `discountPercent`, `marginPercent`, `totalAmount`) are calculated and frozen at creation time.
2. **24-Hour Expiration Window & Lazy Expiration:**
   - Every offer carries an `expiresAt` timestamp (default: 24 hours).
   - Rather than relying solely on background cron jobs, expiration is evaluated **lazily upon access**: If `now > expiresAt` and the offer is still `ACTIVE`, the engine automatically transitions the status to `EXPIRED` and emits an `OFFER_EXPIRED` audit event.
   - Any attempt to accept an expired offer is rejected with a deterministic `400 Bad Request` (`OFFER_EXPIRED`).

---

## 💡 Consequences & Trade-offs
* **Pros:**
  - Zero risk of buyers checking out obsolete discount terms weeks later.
  - Zero background cron polling overhead needed to enforce expiration consistency.
  - Full audit trail of creation, expiration, acceptance, and rejection.
