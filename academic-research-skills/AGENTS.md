# Academic Research Skills (ARS)

A suite of pi skills for rigorous academic research, paper writing, peer review, and pipeline orchestration.

## Skills Overview

| Skill | Purpose | Key Modes |
|-------|---------|-----------|
| `deep-research` | 13-agent research team | full, quick, socratic, review, lit-review, three-way-scan, fact-check, systematic-review |
| `academic-paper` | 12-agent paper writing | full, plan, outline-only, revision, revision-coach, abstract-only, lit-review, format-convert, citation-check, disclosure, rebuttal-audit |
| `academic-paper-reviewer` | Multi-perspective paper review (5 reviewers) | full, re-review, quick, methodology-focus, guided, calibration |
| `academic-pipeline` | Full pipeline orchestrator | (coordinates all above) |

## Routing Discipline

**Step 0 — Escape hatch:** If the user's message begins with `[direct-mode]`, strip it and route by intent on the remaining content.

1. **Explicit intent** — user invokes a specific skill via `/ars-*` or unambiguous trigger keyword → route directly.
2. **Cross-phase materials** — artifacts spanning ≥2 pipeline phases without a specific skill → **clarify** before routing.
3. **Ambiguous intent, no materials** → clarify per `shared/references/intent_clarification_protocol.md`.

## Routing Rules

1. **academic-pipeline vs individual skills**: Use pipeline for full workflow. Use individual skills for single functions.
2. **deep-research vs academic-paper**: Complementary. deep-research = upstream research, academic-paper = downstream writing.
3. **deep-research socratic vs full**: socratic = guided dialogue, full = direct report production.
4. **academic-paper plan vs full**: plan = Socratic chapter planning, full = direct production.
5. **academic-paper-reviewer guided vs full**: guided = Socratic review, full = standard review report.
6. **rebuttal-audit vs revision-coach**: Route by INPUT SHAPE. rebuttal-audit needs both comments AND existing draft. revision-coach generates from comments alone.

## Key Rules

- All claims must have citations
- Evidence hierarchy respected (meta-analyses > RCTs > cohort > case reports > expert opinion)
- Contradictions disclosed with evidence quality comparison
- AI disclosure in all reports
- Default output language matches user input (Traditional Chinese or English)

## Full Academic Pipeline

```
deep-research (socratic/full)
  → academic-paper (plan/full)
    → integrity check (Stage 2.5)
      → academic-paper-reviewer (full/guided)
        → academic-paper (revision)
          → academic-paper-reviewer (re-review, max 2 loops)
            → final integrity check (Stage 4.5)
              → academic-paper (format-convert → final output)
                → Process Summary + AI Self-Reflection Report
```

## Handoff Protocol

### deep-research → academic-paper
Materials: RQ Brief, Methodology Blueprint, Annotated Bibliography, Synthesis Report, INSIGHT Collection

### academic-paper → academic-paper-reviewer
Materials: Complete paper text. field_analyst_agent auto-detects domain.

### academic-paper-reviewer → academic-paper (revision)
Materials: Editorial Decision Letter, Revision Roadmap, Per-reviewer detailed comments

## Prompt Templates

Use `/ars-<mode>` to invoke specific pipeline modes:
- `/ars-full` — Full pipeline
- `/ars-plan` — Socratic chapter planning
- `/ars-outline` — Detailed outline + evidence map
- `/ars-revision` — Revised draft + R&R responses
- `/ars-revision-coach` — Parse reviewer comments → Roadmap + Skeleton
- `/ars-rebuttal-audit` — QA existing rebuttal draft
- `/ars-abstract` — Bilingual abstract + keywords
- `/ars-lit-review` — Annotated bibliography
- `/ars-3w` — WHY/HOW/WHAT paper comparison
- `/ars-reviewer` — Simulated peer-review panel
- `/ars-format-convert` — Convert between LaTeX/DOCX/PDF/Markdown
- `/ars-citation-check` — Citation error report
- `/ars-disclosure` — AI-usage disclosure statement
- `/ars-mark-read` — Record human-read signal
- `/ars-unmark-read` — Rescind human-read mark
- `/ars-cache-invalidate` — Drop cached verification entries

## Version Info

- **Suite version**: 3.18.0
- **Author**: Cheng-I Wu
- **License**: CC-BY-NC 4.0
