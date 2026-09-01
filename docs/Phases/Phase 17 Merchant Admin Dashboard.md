# Phase 17: Merchant Admin Dashboard (Next.js 15)

* **Status:** Completed & Verified ✅
* **Scope:** Next.js 15 App Router merchant control center (`/admin/*`), JWT session management, Commercial KPI Overview, Catalog & Stock Manager, Policy Guardrails Configurator, HITL Approvals Queue, Orders & Fulfillment Pipeline, and Forensic Audit Log Viewer.

Related: [[Index]], [[ADR-019 Merchant Control Portal and Management Architecture]], [[Merchant Control Portal]], [[Phase 16 Buyer Checkout UI]], [[Phase 18 End to End System Integration]]

---

## 🎯 What Was Implemented
* **Stateless JWT Session Manager (`apps/web/src/lib/auth.ts`):**
  - Handles token persistence, active merchant context, and 1-click demo login.
* **Layout Shell & Navigation (`apps/web/src/app/admin/layout.tsx` & `AdminSidebar.tsx`):**
  - Responsive dark-theme sidebar with active store badge and quick links.
* **Admin Module Pages:**
  - `page.tsx`: Commercial KPI Overview (Revenue, Profit, Margin, AI Win Rate, Top Products).
  - `login/page.tsx`: Sign-in, registration, and instant demo login button.
  - `catalog/page.tsx`: Catalog table with cost prices, margins, stock levels, and product creation modal.
  - `policy/page.tsx`: Policy sliders for max discount, min margin %, and autonomous order limits.
  - `approvals/page.tsx`: HITL approval queue with 1-click **Authorize Quote** and **Decline** actions.
  - `orders/page.tsx`: Order table with status filter, packaging starter, and courier dispatch modal.
  - `audit/page.tsx`: Forensic compliance log showing immutable multi-entity events.

---

## 🧪 Verification & Proof
* Ran `scripts/verify-admin-dashboard.ts` testing all 7 operational stages:
  1. Merchant registration & JWT session issuance.
  2. Policy guardrails update (Max Discount: 25%, Approval Threshold: ₹150,000).
  3. Catalog product creation & stock restock to 8 units.
  4. High-value quote ($>\text{₹}150,000$) locked in `DRAFT` $\rightarrow$ Authorized by manager in HITL queue.
  5. Order conversion $\rightarrow$ Payment $\rightarrow$ Warehouse packaging $\rightarrow$ BlueDart Aviation dispatch.
  6. Commercial analytics aggregation (Gross Revenue: ₹1,80,000, Profit: ₹60,000, Margin: 33.33%).
  7. Forensic audit trail verification (15 immutable events logged).
* Verified Next.js 15 production build (`npm run build --workspace=@agent-sauda/web`).
