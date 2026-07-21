---
description: "QA an existing rebuttal draft against reviewer comments (advisory)"
argument-hint: "[reviewer comments + rebuttal draft]"
---
Trigger the `academic-paper` skill in `rebuttal-audit` mode. Requires BOTH the reviewer comments AND an existing rebuttal/response draft to evaluate. Produces an advisory QA report (per-comment coverage + gaps + risk flags). Does NOT generate a new response. Fidelity spectrum, low oversight.

If only reviewer comments are present (no draft yet), use `/ars-revision-coach` instead.

Mode reference: `MODE_REGISTRY.md` § academic-paper.
Skill entry: `academic-paper/SKILL.md`.
