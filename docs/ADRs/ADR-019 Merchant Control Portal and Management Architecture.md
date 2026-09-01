# ADR-019: Merchant Control Portal and Management Architecture

* **Status:** Accepted
* **Date:** 2026-09-02
* **Context:** Providing store owners and commercial managers with a centralized command center to govern AI negotiation, manage inventory, review HITL approvals, and track order fulfillment and commercial KPIs.

Related: [[Index]], [[Merchant Control Portal]], [[Merchant Analytics and KPI Engine]], [[HITL Approval Queue]], [[Deterministic Policy Engine]], [[Phase 17 Merchant Admin Dashboard]]

---

## 🎯 Context & Problem Statement
Prior to Phase 17, administrative management (policy changes, approval decisions, fulfillment tracking) required API calls or Swagger. Store owners and operations teams need:
1. A unified, authenticated web dashboard (`/admin`).
2. Real-time commercial KPIs (Gross Revenue, Net Profit, Average Margin %, AI Negotiation Win Rate %).
3. Direct controls to configure deterministic policy guardrails without touching code or database tables.
4. An actionable HITL queue where managers can approve or reject high-value AI quotes in 1 click.
5. An order fulfillment workflow to transition orders to packaging and assign courier tracking.
6. A forensic audit trail viewer for regulatory compliance.

---

## ⚖️ Decision
1. **Next.js 15 App Router Architecture with Shared Sidebar Layout (`apps/web/src/app/admin/`):**
   - Layout shell (`layout.tsx`) handles stateless JWT session verification and renders `AdminSidebar.tsx`.
2. **7 Core Admin Screens:**
   - `/admin`: Commercial KPI Overview, win-rate metrics, and product revenue rankings.
   - `/admin/login`: JWT sign-in, registration, and 1-click demo merchant launcher.
   - `/admin/catalog`: Product catalog CRUD, cost price & gross margin tracking, and inventory restock actions.
   - `/admin/policy`: Policy sliders for max discount %, minimum margin %, and autonomous order limits.
   - `/admin/approvals`: Human-in-the-Loop review queue for high-value quotes held in `DRAFT`.
   - `/admin/orders`: Order tracking and warehouse fulfillment dispatch with courier assignment.
   - `/admin/audit`: Forensic compliance log showing immutable multi-entity events.

---

## 💡 Consequences & Trade-offs
* **Pros:**
  - Complete control and operational visibility for merchants.
  - Zero-friction demo testing (1-click demo login enables instant end-to-end evaluation).
  - Clean separation between buyer-facing storefronts and merchant administrative back-office.
