# Graphify vs Obsidian

Understanding the division of labor between **Graphify** (code structure graph) and **Obsidian** (knowledge & decision layer) in the Agent Sauda development workflow.

Related: [[Index]], [[System Architecture]]

---

## ⚖️ Division of Responsibilities

```
+─────────────────────────────────────────────────────────────────────────────+
|                               ANTIGRAVITY                                   |
|                         (Senior Coding Partner)                             |
+───────────────────────────────┬─────────────────────────────────────────────+
                                │
        ┌───────────────────────┴───────────────────────┐
        ▼                                               ▼
+───────────────────────────────+               +─────────────────────────────+
|           GRAPHIFY            |               |          OBSIDIAN           |
| (Code Graph & Dependencies)   |               | (Knowledge & Reasonings)    |
+───────────────────────────────+               +─────────────────────────────+
| • AST extraction from code    |               | • Architecture & Vision     |
| • Symbol-to-symbol calls      |               | • Architectural Decisions   |
| • File imports & exports      |               | • Concept Explanations      |
| • Community cluster detection |               | • Phase Summaries           |
| • Scoped code retrieval       |               | • Human Learnings & "Why"   |
| • Command: `graphify query`   |               | • Interlinked [[WikiLinks]] |
+───────────────────────────────+               +─────────────────────────────+
```

---

## 🎯 When to Use Which
* **Use Graphify when asking:**
  - *"Which files import `auth.service.ts`?"*
  - *"Where is `requireMerchantAccess` implemented in code?"*
  - *"Trace the AST call path between the routes and Prisma client."*

* **Use Obsidian when asking:**
  - *"Why did we decouple Order State from Payment State?"*
  - *"What are the 4 deterministic decisions of the Policy Engine?"*
  - *"How is the Agent Redaction Boundary designed to prevent prompt injection?"*
  - *"What did we build and verify in Phase 3?"*
