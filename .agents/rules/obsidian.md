---
trigger: always_on
description: Consult and maintain the Obsidian knowledge vault at docs/ for architecture, decisions, and conceptual learning.
---

## Obsidian Knowledge Vault (`docs/`)

This project maintains a curated, human-readable knowledge vault inside `docs/`.

Rules:
- For architecture, design principles, ADRs, and concept explanations, consult `docs/Index.md` and related notes.
- When making major architectural or technical decisions from Phase 5 onward, document them as new ADRs in `docs/ADRs/` or concept notes in `docs/Concepts/`.
- Keep notes cleanly interlinked using Obsidian `[[WikiLink]]` syntax.
- Maintain the clear boundary:
  - **Graphify (`graphify-out/`)**: For code structure, symbols, imports, and AST relationships.
  - **Obsidian (`docs/`)**: For concepts, reasoning, architecture, decisions, and phase summaries.
