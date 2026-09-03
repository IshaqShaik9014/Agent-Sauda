# ADR-022: Production Security Hardening, HTTP Shielding, and Distributed Rate Limiting

* **Status:** Accepted
* **Date:** 2026-09-03
* **Context:** Protecting the platform against automated credential brute-forcing, LLM token-drain Denial of Service (DoS), cross-site scripting (XSS), and adversarial prompt injections.

Related: [[Index]], [[Security Hardening and Rate Limiting]], [[Security Model]], [[AI Tool Calling Loop]], [[Deterministic Policy Engine]], [[Phase 20 Security Hardening]]

---

## 🎯 Context & Problem Statement
Exposing AI sales agents and e-commerce transactions to the public internet presents distinct security attack vectors:
1. **LLM Token-Drain DoS:** Malicious actors could loop millions of queries through the AI chat endpoint to exhaust merchant LLM API quotas or spike billing.
2. **Credential Brute-Forcing:** Automated botnets could spray common passwords against the `/api/auth/login` endpoint.
3. **Reflected & Stored XSS:** Untrusted user input submitted in chat conversations or customer notes could inject malicious script tags.
4. **Prompt Injection Attacks:** Attackers attempting "Jailbreak" instructions to force the agent to approve 99% discounts or ₹1 deals.

---

## ⚖️ Decision
1. **HTTP Security Shielding (`@fastify/helmet`):**
   - Content-Security-Policy (CSP) restricting scripts, styles, and asset origins.
   - HTTP Strict Transport Security (HSTS) with `includeSubDomains`.
   - MIME type sniffing prevention (`X-Content-Type-Options: nosniff`).
   - Clickjacking defense (`X-Frame-Options: SAMEORIGIN`).
2. **Multi-Tier Distributed Rate Limiting (`@fastify/rate-limit`):**
   - **Auth Endpoints (`/api/auth/*`):** Strict **5 requests per minute** per client IP. Thwarts brute-force guessing.
   - **AI Chat Negotiation (`/api/merchants/:id/agent/chat` & `/api/agent/chat`):** **30 requests per minute** per client IP. Stops LLM token drain.
   - **Public Catalog:** **60 requests per minute**.
   - **Global Fallback:** **120 requests per minute**.
   - Backed by distributed Redis store when configured, with memory cache fallback.
3. **Payload Sanitization (`apps/api/src/lib/sanitize.ts`):**
   - Strict stripping of `<script>`, `<iframe>`, `<style>`, and other active HTML tags.
   - Neutralization of `javascript:` pseudo-protocols.
   - Applied to incoming chat messages and customer profile fields.
4. **Deterministic Backend Policy Defense:**
   - LLMs can never override numerical guardrails. Rejections occur deterministically on pure math, immune to prompt text manipulation.

---

## 💡 Consequences & Trade-offs
* **Pros:**
  - Automated attacks are throttled at the gateway level before hitting LLM APIs or database queries.
  - XSS payloads neutralized before touching storage or UI views.
  - Zero performance regression on legitimate user traffic.
