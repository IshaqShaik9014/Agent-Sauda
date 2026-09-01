# ADR-017: Public Buyer Conversational Negotiation UI

* **Status:** Accepted
* **Date:** 2026-09-02
* **Context:** Providing customers with an interactive conversational storefront interface to negotiate prices with the AI sales agent.

Related: [[Index]], [[Buyer Negotiation Interface]], [[AI Tool Calling Loop]], [[Offer Lifecycle State Machine]], [[Phase 15 Public Buyer Chat UI]]

---

## 🎯 Context & Problem Statement
Prior to Phase 15, negotiation was tested programmatically via API scripts and Swagger. To provide a seamless consumer experience, shoppers need:
1. A public, accessible storefront URL per merchant (`/negotiate/[merchantSlug]`).
2. An interactive chat interface with real-time feedback.
3. Visual, structured formal quotation cards (`OfferCard.tsx`) displaying discount savings and countdown timers.
4. Direct transition from quotation acceptance into checkout and payment.

---

## ⚖️ Decision
1. **Next.js 15 App Router Architecture:**
   - Dynamic route `apps/web/src/app/negotiate/[merchantSlug]/page.tsx` fetches the merchant's redacted catalog on load.
2. **Interactive OfferCard Component:**
   - Visualizes line items, base price vs agreed price, percentage savings badge, and "Accept & Checkout" button.
   - Status indicators for `ACTIVE`, `DRAFT (Pending Approval)`, `ACCEPTED`, `REJECTED`, and `EXPIRED`.
3. **Product Catalog Drawer (`CatalogBrowser.tsx`):**
   - Allows buyers to click products to populate natural language counter-offers with one click.
4. **Typed API Client (`apps/web/src/lib/api.ts`):**
   - Centralizes API calls with strong TypeScript typing from `@agent-sauda/domain`.

---

## 💡 Consequences & Trade-offs
* **Pros:**
  - Modern, responsive, consumer-grade shopping and negotiation experience.
  - Zero risk of supplier cost leaks (frontend strictly consumes redacted catalog).
  - 1-click progression from conversational agreement to order creation.
