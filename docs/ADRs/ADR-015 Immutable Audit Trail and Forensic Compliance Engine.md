# ADR-015: Immutable Audit Trail and Forensic Compliance Engine

* **Status:** Accepted
* **Date:** 2026-08-31
* **Context:** Providing tamper-evident historical logging, multi-entity forensic deal reconstruction, and regulatory export formats.

Related: [[Index]], [[Audit Trail and Compliance Engine]], [[Separation of Concerns]], [[Security Model]], [[Phase 13 Audit Trail and Compliance Engine]]

---

## 🎯 Context & Problem Statement
In autonomous AI commercial negotiations, merchants and regulators need verifiable proof of how deals were formed, which policies were checked, who approved discounts, and how funds moved. Mutation of historical audit logs must be strictly prevented.

---

## ⚖️ Decision
1. **Append-Only Immutable `AuditEvent` Ledger:**
   - Audit events are strictly append-only. No `UPDATE` or `DELETE` operations are exposed on the `AuditEvent` model.
   - Captures `actorType` (`USER`, `SYSTEM`, `AI_AGENT`, `WEBHOOK`) and `actorId` for transparent provenance.
2. **Cross-Subsystem Forensic Reconstruction:**
   - The forensic timeline engine queries connected foreign keys across subsystems (`CONVERSATION` $\rightarrow$ `POLICY` $\rightarrow$ `OFFER` $\rightarrow$ `ORDER` $\rightarrow$ `PAYMENT` $\rightarrow$ `INVENTORY`) into a unified chronological story.
3. **Dual Compliance Export (CSV / JSON):**
   - **RFC 4180 CSV Export:** For accountant spreadsheets, tax filing, and manual inspection.
   - **Structured JSON Export:** For automated SIEM systems and forensic archiving.

---

## 💡 Consequences & Trade-offs
* **Pros:**
  - Complete, unforgeable audit trail of every autonomous AI negotiation and transaction.
  - Zero ambiguity in merchant dispute resolutions and compliance reporting.
  - Multi-tenant data isolation strictly enforced during forensic queries and exports.
