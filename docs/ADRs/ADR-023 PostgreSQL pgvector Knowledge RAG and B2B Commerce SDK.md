# ADR-023: PostgreSQL pgvector Knowledge RAG and B2B Commerce SDK

* **Status:** Accepted
* **Date:** 2026-09-04
* **Context:** Enabling existing business AI assistants to integrate Agent Sauda as an infrastructure/SDK layer, with grounded merchant knowledge retrieval (RAG) and strict bounded autonomy.

Related: [[Index]], [[ADR-001 Modular Monolith Architecture]], [[ADR-004 Database Level Tenant Isolation]], [[ADR-007 Pure Rule Pipeline Without LLM Discretion]], [[AI Tool Calling Loop]], [[Tenant Isolation]]

---

## 🎯 Context & Problem Statement
Agent Sauda is not a consumer marketplace or standalone shopping bot. It is B2B commerce infrastructure. Businesses already have their own AI chatbots (on websites, WhatsApp, Zendesk) and need:
1. **Zero-Replatforming Commerce:** Ability to connect their existing AI assistant to merchant-controlled negotiation and checkout.
2. **Grounded Merchant Knowledge (RAG):** Store policies (returns, warranties, shipping, defect handling) must be grounded in facts, preventing LLM hallucinations.
3. **Database-Level Tenant Isolation:** Merchant A must never access or search Merchant B's confidential policy documents.
4. **Bounded Autonomy:** Clear discount tiers: auto-approved discounts ($\le 5\%$), manager-reviewed discounts ($5\text{--}10\%$), and hard rejection ($> 10\%$ or below floor price).
5. **Zero-Double-Deduction Payment Resilience:** Clean payment failure and retry state machine.

---

## ⚖️ Decision
1. **PostgreSQL + `pgvector` Integration:**
   - Stored in Neon PostgreSQL using native extension `vector(768)`.
   - Chunks indexed using Hierarchical Navigable Small World (`HNSW`) with `vector_cosine_ops`.
   - Strict SQL tenant partitioning: `WHERE "merchantId" = $1`.
2. **Interactive Merchant Knowledge UI (`/admin/knowledge`):**
   - Merchants paste/type return and warranty policies, select categories, and vectorize them with one click.
   - Built-in search tester for real-time cosine similarity verification.
3. **B2B Commerce SDK (`AgentSauda`):**
   - Client package exporting lightweight SDK:
     ```typescript
     const agentSauda = new AgentSauda({ apiKey, merchantId, baseUrl });
     const result = await agentSauda.commerce.process({ message, sessionId });
     ```
   - Unified commerce endpoint `POST /api/v1/commerce/process`.
4. **Bounded Autonomy Policy Engine:**
   - $\le 5\%$ discount $\rightarrow$ `ALLOW`.
   - $5\% - 10\%$ discount $\rightarrow$ `APPROVAL_REQUIRED` (queued in `/admin/approvals`).
   - $> 10\%$ or $< ₹5,400$ $\rightarrow$ `REJECT`.
5. **Resilient DNS & Connection Pooling:**
   - Node.js DNS fallback configured with Google DNS (`8.8.8.8`) and `dns.resolve4` to guarantee zero connection drops to cloud databases.

---

## 💡 Consequences & Trade-offs
* **Pros:**
  - Zero extra infrastructure: leverages existing PostgreSQL instance without requiring Pinecone, Weaviate, or ChromaDB.
  - Complete data privacy and cryptographic multi-tenant isolation.
  - Turnkey integration for any third-party AI assistant.
* **Cons:**
  - High-dimension embeddings require adequate PostgreSQL RAM for HNSW graph traversal (mitigated by Neon serverless scaling).
