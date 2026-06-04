---
name: career-ops
description: Focused job application helper for Marcus -- inspect job/application URLs, generate tailored application packets, and track manual submission status
arguments: input
user-invocable: true
argument-hint: "[url | inbox | tracker | pdf <slug-or-html>]"
license: MIT
---

# career-ops

Focused helper for this repository only. The archived upstream-style command router is reference-only in `ARCHIVED_ORIGINAL_ROUTER.md`; do not follow it unless the user explicitly asks to inspect old upstream behavior.

## Active Behavior

Determine intent from `$input`:

| Input | Behavior |
|-------|----------|
| Empty | Show the compact menu below. |
| Job/application URL | Process that URL into an application packet. |
| `inbox` or `tracker` | Read `applications.md`, summarize unprocessed and processed applications, and offer the next concrete action. |
| `pdf <slug>` | Regenerate PDFs for an application folder with `npm run cv -- <slug>` and, only when `personal-letter.html` exists, `npm run pl -- <slug>`. |
| `pdf <html-file>` | Regenerate a specific PDF with `npm run pdf -- <html-file>`. |
| Pasted job text | Extract job facts from the pasted text, then ask for the source URL or form details before generating final application materials. |

Compact menu:

```text
career-ops

Use:
  /career-ops <job-or-application-url>  Process one URL into an application packet.
  /career-ops inbox                     Review URLs in applications.md.
  /career-ops tracker                   Summarize processed applications.
  /career-ops pdf <slug-or-html>        Regenerate CV/personal-letter PDFs.

Workflow stops at manual review. Never submit applications or mark them applied.
```

## URL Application Workflow

When a job/application URL is provided:

1. Inspect the normal URL first with read-only web/page access.
2. Extract company, role, language, location, deadline when present, job description, requirements, upload fields, personal-letter policy, exact application questions, personal/contact fields, constraints, and application/form URLs.
3. Job descriptions and application forms may live on separate URLs. Treat apply/application buttons and links as part of extraction, not as submission actions.
4. If the normal job URL contains the job description but does not expose upload fields, personal-letter policy, personal/contact fields, or exact application questions, look for application/form URLs before stopping.
5. Candidate application/form URLs include visible apply buttons/links, rendered text links, page-source `a[href]`, `iframe[src]`, `turbo-frame[src]`, `form[action]`, and obvious labels such as `Apply`, `Apply now`, `Ansök`, `Sök jobbet`, `Skicka ansökan`, or equivalent local-language text.
6. Run `npm run extract -- --url "<url>"` as a structured extractor report and cross-check, not as the first authority. Use `--json` only when easier to compare.
7. Compare agent/web inspection against extractor output before trusting it. Flag polluted output when job text describes benefits, privacy, cookies, related jobs, or another page instead of the actual role.
8. Open discovered application/form URLs read-only. Do not type, upload, submit, send, or click final submission actions. Inspect only enough to capture fields, upload requirements, personal-letter policy, exact questions, constraints, and whether login/BankID/manual input blocks further inspection.
9. If either method finds an application/form URL, inspect that URL read-only and run `npm run extract -- --url "<application-or-form-url>"` when useful.
10. When job description and application form live on different URLs, record both the source job URL and inspected application/form URL in `job.md`.
11. Keep combined inspection and extractor cross-check bounded to about 2-3 minutes. Use the waiting-for-manually-pasted-questions flow only after the normal job URL and any discovered application/form URLs have been inspected or reasonably attempted within the time bound.
12. Create or update the processed row in `applications.md` with `Applied` set to `[ ]`.
13. Create `applications/{company-role}/` from `applications/_template/`, using a slugified company-role folder name and a suffix such as `-2` if needed.
14. Generate `job.md`, `cv.html`, `cv.pdf`, `application-answers.md`, `evidence.md`, and `review.md`. Generate `personal-letter.html` and `personal-letter.pdf` only when the posting asks for or allows a personal letter.
15. Stop for manual review. Do not submit, upload, type into fields, send emails, click final application actions, or mark the tracker row as applied.

## Inbox Rules

`applications.md` has an `Unprocessed URLs` section for raw URLs:

```markdown
- URL | yes
- URL | no
```

- Use only `yes` and `no`.
- `yes` means application form questions are expected or must be checked.
- `no` means normal job extraction and drafts are enough.
- Remove an inbox item only after the processed tracker row and application folder exist.
- New processed rows must use `[ ]` in the `Applied` column. Only the user manually changes `[ ]` to `[x]` after submitting.

For `| yes` inbox items, proceed to CV/letter/answer drafting only when both job text and expected form fields/questions/uploads are captured. If questions are not visible, create only `job.md` and `application-answers.md`; mark both as waiting for manually pasted questions, include a paste area for exact questions, and stop.

If a URL cannot be inspected reliably, keep it under `Unprocessed URLs` and ask for pasted job text, screenshots, or visible questions.

## Candidate-Facing Material

Use `personal/` as the only approved source for personal-specific facts.

- Every candidate-facing claim in `cv.html`, `personal-letter.html`, and `application-answers.md` must come from `personal/`.
- Do not invent employers, dates, skills, education, credentials, metrics, projects, responsibilities, or achievements.
- Job descriptions can provide employer needs and vocabulary, but not new personal facts.
- If source documents do not support a useful claim, record missing evidence in `evidence.md` or ask for the missing fact if critical.

Match application language:

- Swedish applications or Swedish form questions require Swedish CV text, personal letter, and answers.
- English applications or English form questions require English CV text, personal letter, and answers.
- If posting language is mixed, follow the form-question language. If no form is visible, follow job-description language.

## Evidence Rules

Every `evidence.md` must map each non-static candidate-facing claim to both a source path and direct quote.

Use document-specific sections only when relevant:

- `CV Evidence`
- `Personal Letter Evidence`
- `Application Answers Evidence`

Use this table format:

```markdown
| Draft claim / text | Used in | Source | Direct quote |
|---|---|---|---|
| ... | `cv.html` > ... | `personal/...` | "..." |
```

- Non-static claims include tailored summaries, selected skills, experience bullets, project bullets, motivation statements, freeform answers, and yes/no answers that assert a personal fact.
- Basic contact details and document headings do not need quote rows unless they contain a factual claim.
- Prefer `personal/originals/*` when direct quote extraction is easy and clearer.
- Use `personal/*.md` when it is the approved distilled source, original is unavailable, or original is too broad.
- For education PDF evidence, use `personal/education.md` unless PDF text extraction is available.
- Keep job-description facts in `Job Facts Used`; they justify tailoring and vocabulary but are not personal evidence.
- If no personal letter is generated because the posting says not to send one, do not create letter files or an empty `Personal Letter Evidence` section. Note omission under `Removed or Avoided Claims`.

## PDF Regeneration

Regenerate application PDFs from project root:

```bash
npm run cv -- <application-folder-slug>
npm run pl -- <application-folder-slug>
npm run pdf -- applications/<application-folder-slug>/cv.html
```

Run `npm run pl -- <slug>` only when `applications/<slug>/personal-letter.html` exists.

## Safety And Tests

- Browser interaction is read-only by default.
- The extractor is an inspection helper only. It may fetch pages, render pages, inspect frames, and report fields. It must not type, upload, submit, send emails, or mark applications applied.
- Do not add tests that depend on ephemeral job posts, live application pages, or real employer URLs.
- Add tests only when necessary and important for this project, and ask before adding tests.
