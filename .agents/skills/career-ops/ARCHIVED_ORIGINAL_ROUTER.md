# Archived Original Router

Reference-only archive of the previous upstream-style `career-ops` skill router.

Do not follow these instructions for the active `career-ops-swe` setup unless the user explicitly asks to inspect old upstream behavior. Active behavior lives in `SKILL.md`.

---

```markdown
---
name: career-ops
description: AI job search command center -- evaluate offers, generate CVs, scan portals, track applications
arguments: mode # Claude Code specific
user-invocable: true
argument-hint: "[scan | deep | pdf | oferta | ofertas | apply | batch | tracker | pipeline | contacto | training | project | interview-prep | update]"
license: MIT
---

# career-ops -- Router

## Mode Routing

Determine the mode from `$mode`:

| Input | Mode |
|-------|------|
| (empty / no args) | `discovery` -- Show command menu |
| JD text or URL (no sub-command) | **`auto-pipeline`** |
| `oferta` | `oferta` |
| `ofertas` | `ofertas` |
| `contacto` | `contacto` |
| `deep` | `deep` |
| `interview-prep` | `interview-prep` |
| `pdf` | `pdf` |
| `training` | `training` |
| `project` | `project` |
| `tracker` | `tracker` |
| `pipeline` | `pipeline` |
| `apply` | `apply` |
| `scan` | `scan` |
| `batch` | `batch` |
| `patterns` | `patterns` |
| `followup` | `followup` |

**Auto-pipeline detection:** If `$mode` is not a known sub-command AND contains JD text (keywords: "responsibilities", "requirements", "qualifications", "about the role", "we're looking for", company name + role) or a URL to a JD, execute `auto-pipeline`.

If `$mode` is not a sub-command AND doesn't look like a JD, show discovery.

---

## Discovery Mode (no arguments)

Show this menu:

```
career-ops -- Command Center

Available commands:
  /career-ops {JD}      → AUTO-PIPELINE: evaluate + report + PDF + tracker (paste text or URL)
  /career-ops pipeline  → Process pending URLs from inbox (data/pipeline.md)
  /career-ops oferta    → Evaluation only A-F (no auto PDF)
  /career-ops ofertas   → Compare and rank multiple offers
  /career-ops contacto  → LinkedIn power move: find contacts + draft message
  /career-ops deep      → Deep research prompt about company
  /career-ops interview-prep → Generate company-specific interview prep doc
  /career-ops pdf       → PDF only, ATS-optimized CV
  /career-ops training  → Evaluate course/cert against North Star
  /career-ops project   → Evaluate portfolio project idea
  /career-ops tracker   → Application status overview
  /career-ops apply     → Live application assistant (reads form + generates answers)
  /career-ops scan      → Scan portals and discover new offers
  /career-ops batch     → Batch processing with parallel workers
  /career-ops patterns  → Analyze rejection patterns and improve targeting
  /career-ops followup  → Follow-up cadence tracker: flag overdue, generate drafts

Inbox: add URLs to data/pipeline.md → /career-ops pipeline
Or paste a JD directly to run the full pipeline.
```

---

## Context Loading by Mode

After determining the mode, load the necessary files before executing:

### Modes that require `_shared.md` + their mode file:
Read `modes/_shared.md` + `modes/{mode}.md`

Applies to: `auto-pipeline`, `oferta`, `ofertas`, `pdf`, `contacto`, `apply`, `pipeline`, `scan`, `batch`

### Standalone modes (only their mode file):
Read `modes/{mode}.md`

Applies to: `tracker`, `deep`, `interview-prep`, `training`, `project`, `patterns`, `followup`

### Modes delegated to subagent:
For `scan`, `apply` (with Playwright), and `pipeline` (3+ URLs): launch as Agent with the content of `_shared.md` + `modes/{mode}.md` injected into the subagent prompt.

```
Agent(
  subagent_type="general-purpose",
  prompt="[content of modes/_shared.md]\n\n[content of modes/{mode}.md]\n\n[invocation-specific data]",
  description="career-ops {mode}"
)
```

Execute the instructions from the loaded mode file.

---

## Project Extraction Protocol

For job URLs in this repository, use agent-first extraction before generating application materials.

1. Inspect the normal job URL read-only with web/page access.
2. Extract the actual job facts, job description, requirements, uploads, personal-letter policy, exact application questions, personal fields, constraints, and any direct form URLs.
3. Look for direct form URLs in visible page structure, page source, `iframe[src]`, `turbo-frame[src]`, `form[action]`, rendered text, and obvious application links.
4. Run `npm run extract -- --url "<url>"` as a structured scanner and cross-check, not as the first authority. Use `--json` when comparison is easier.
5. Compare agent/web inspection against extractor output before trusting it. Flag polluted output when job text describes benefits, privacy, cookies, related jobs, or another page instead of the actual role.
6. If either method finds a direct form URL, inspect that URL read-only and run `npm run extract -- --url "<direct-form-url>"` if useful.
7. Stop after about 2-3 minutes of reasonable attempts. If expected questions are still missing, ask for pasted questions/screenshots and use the waiting-for-manually-pasted-questions flow.

Agent audit checklist:

- Does the extracted job text describe the actual role?
- Do all visible form questions in rendered text appear under application questions?
- Are consent, marketing, privacy, and future-job-offer fields separated from job-specific questions?
- Are personal/contact fields separated from job-specific questions?
- Are upload fields and personal-letter rules explicit?

Safety: all inspection is read-only. Do not type into fields, upload files, submit forms, send emails, or mark applications as applied.

Testing policy: do not add tests that depend on ephemeral job posts, live application pages, or real employer URLs. Add tests only when necessary and important for this project, and ask before adding any tests.
```
