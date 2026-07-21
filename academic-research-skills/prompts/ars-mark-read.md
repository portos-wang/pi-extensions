---
description: "Record human-read signal for citation keys"
argument-hint: "<citation-key> [--scope {full_text,sections,abstract_only,toc_only,unknown}]"
---
Acknowledge that the user has personally read the source(s) backing the named citation key(s), so the next finalizer pass can promote `<!--ref:slug LOW-WARN-->` to `<!--ref:slug ok-->` for each acknowledged slug.

The dispatching agent substitutes `<path>` below with the active Material Passport path from session context before executing. The CLI handles validation (citation_key must exist in `literature_corpus[]`; on miss emit `[ARS-MARK-READ ERROR: citation_key '<slug>' not in literature_corpus[]]` and refuse to write).

Optional read-scope attestation: `--scope {full_text,sections,abstract_only,toc_only,unknown}` records how much of the source was read; `--locator "<text>"` (repeatable, requires `--scope sections`) names the read sections/pages; `--note "<text>"` free text (requires `--scope`).

Implementation:
```bash
python3 scripts/ars_mark_read.py $ARGUMENTS --passport-path "<path>"
```

Mode reference: `docs/design/2026-04-30-ars-v3.6.8-trust-provenance-and-drift-transparency-spec.md` §3.6 + Step 7.
