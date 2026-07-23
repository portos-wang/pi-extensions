---
description: "Drop cached verification entries for citation keys"
argument-hint: "<citation-key>"
---
Invalidate the persistent verification cache for one citation key, so the next pipeline run re-verifies it live against Crossref / OpenAlex / Semantic Scholar / arXiv instead of returning a stale cached verdict.

The cache is a local SQLite store at `~/.cache/ars/verification.db` (override via `ARS_VERIFICATION_CACHE_PATH`), keyed by `(citation_key, resolver_name, query_form)` with a 90-day TTL. This command removes **every** cached entry for the named citation key (all four resolvers, all query forms); other citations are untouched. It is idempotent.

**Invalidation cascade**: after invalidation the next gate regenerates the citation's verification summary row and re-runs Phase E audit verdicts for claims citing it.

To invalidate the **entire** cache at once: `rm ~/.cache/ars/verification.db`.

Implementation:
```bash
python3 scripts/ars_cache_invalidate.py $ARGUMENTS
```

Mode reference: `docs/design/2026-05-21-v3.10-182-promote-citation-gate-spec.md` §2 Delta 2.
