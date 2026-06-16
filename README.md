# Career Ops SWE

This repository is now the workspace for Marcus's own job application helper.

The original `career-ops` project has been preserved under `inspo/career-ops/` as a reference snapshot. Treat it as inspiration: search it, compare against it, and borrow pieces when they fit the simpler helper being designed here.

## Current State

- `inspo/career-ops/` contains the archived upstream-style project, including the existing personal setup and generated artifacts.
- `ROADMAP.md` is the starting point for mapping the new helper.
- The root is intentionally minimal until the new product direction is defined.

## Working Principle

Build the new helper from the actual workflows Marcus wants, not from the full complexity of the original project. Copy concepts from `inspo/career-ops/` only when they clearly support that direction.

## Job Discovery

Use compliant, manual-review discovery to find possible applications without submitting anything or changing the application tracker:

```bash
npm run discover -- --dry-run --source platsbanken --limit 10
npm run discover
```

Results are written to `discovery/reports/YYYY-MM-DD.md` and deduplicated through `discovery/history.tsv`. v1 does not crawl LinkedIn, Indeed, Glassdoor, or Blocket automatically; use those as manual sources unless official access is added.
