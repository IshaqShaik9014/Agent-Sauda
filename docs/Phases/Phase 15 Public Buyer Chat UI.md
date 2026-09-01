# Phase 15: Public Buyer Chat & Negotiation Frontend (Next.js 15)

* **Status:** Completed & Verified ✅
* **Scope:** Next.js 15 App Router dynamic storefront `/negotiate/[merchantSlug]`, interactive `OfferCard` widget, `CatalogBrowser` drawer, typed API client (`lib/api.ts`), and landing page demo stores.

Related: [[Index]], [[ADR-017 Public Buyer Conversational Negotiation UI]], [[Buyer Negotiation Interface]], [[Phase 14 Merchant Analytics Engine]], [[Phase 16 Public Buyer Checkout and Payment UI]]

---

## 🎯 What Was Implemented
* **Typed API Client (`apps/web/src/lib/api.ts`):**
  - Type-safe communication with backend Fastify endpoints for catalog search, AI chat turns, offer retrieval, and order conversion.
* **Component Suite (`apps/web/src/components/`):**
  - `Navbar.tsx`: Store branding, active status indicator, catalog toggle, and API links.
  - `OfferCard.tsx`: Formal quotation card with line items, percentage savings badge, 24h expiration indicator, and "Accept & Checkout" button.
  - `CatalogBrowser.tsx`: Slide-over drawer with product search, category filters, in-stock badges, and 1-click negotiation prompt population.
  - `ChatInterface.tsx`: Real-time chat stream with buyer messages, agent replies, typing state, embedded quote cards, and quick suggestion chips.
* **Storefront Page (`apps/web/src/app/negotiate/[merchantSlug]/page.tsx`):**
  - Dynamic route rendering the merchant's live store.
* **Landing Page (`apps/web/src/app/page.tsx`):**
  - Updated showcase featuring live demo store cards linking to `/negotiate/quantum-dynamics`, `/negotiate/apex-robotics`, and `/negotiate/ocp-sauda`.

---

## 🧪 Verification & Proof
* Ran `scripts/verify-frontend-routes.ts` testing the complete flow:
  1. Catalog discovery by merchant slug (`GET /api/agent/catalog?merchantSlug=...`).
  2. Natural language negotiation chat (`POST /api/agent/chat`).
  3. Formal quote materialization (`GET /api/offers/:id`).
  4. Offer acceptance and atomic order creation (`POST /api/orders/create-from-offer`).
* Verified Next.js 15 production build (`npm run build --workspace=@agent-sauda/web`).
