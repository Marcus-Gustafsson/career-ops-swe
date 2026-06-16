---
name: career-ops
description: Focused job application helper for Marcus -- inspect job/application URLs, generate tailored application packets, and track manual submission status
arguments: input
user-invocable: true
argument-hint: "[url | new url | inbox | tracker | pdf <slug-or-html> | continue <slug>]"
license: MIT
---

# career-ops

Focused helper for this repository only. The archived upstream-style command router is reference-only in `ARCHIVED_ORIGINAL_ROUTER.md`; do not follow it unless the user explicitly asks to inspect old upstream behavior.

## Active Behavior

Determine intent from `$input`:

| Input | Behavior |
|-------|----------|
| Empty | Show the compact menu below. |
| `new url`, `new application`, `new job application`, `next application`, `process inbox`, or `process next` | Read `applications.md`, select the first real unprocessed URL, and process it with the URL application workflow. |
| `process all` or `process inbox all` | Process all real unprocessed URLs in order, stopping when a blocker requires manual pasted questions or other user input. |
| Job/application URL | Process that URL into an application packet. If the URL already exists under `Unprocessed URLs`, preserve that row's `yes`/`no` application-question flag. |
| `inbox`, `tracker`, `status`, or `show applications` | Read `applications.md`, summarize unprocessed and processed applications, and offer the next concrete action. |
| `pdf <slug>` or `regenerate pdf <slug>` | Regenerate PDFs for an application folder with `npm run cv -- <slug>` and, only when `personal-letter.html` exists, `npm run pl -- <slug>`. |
| `pdf <html-file>` | Regenerate a specific PDF with `npm run pdf -- <html-file>`. |
| `questions pasted`, `form questions`, or `continue <slug>` | Resume a waiting application folder after the user has supplied exact form questions. Draft copy-paste answers locally and stop for review. |
| Pasted job text | Extract job facts from the pasted text, then ask for the source URL or form details before generating final application materials. |

Compact menu:

```text
career-ops

Use:
  new url                               Process the first real URL in applications.md.
  process all                           Process every real unprocessed URL in order.
  /career-ops <job-or-application-url>  Process one URL into an application packet.
  inbox | tracker | status              Review URLs and processed applications.
  /career-ops pdf <slug-or-html>        Regenerate CV/personal-letter PDFs.
  continue <slug>                       Resume after manually pasted form questions.

Workflow stops at manual review. Never submit applications or mark them applied.
```

## Inbox Trigger Rules

For `new url`, `new application`, `new job application`, `next application`, `process inbox`, and `process next`:

1. Read `applications.md`.
2. In `## Unprocessed URLs`, select the first real pipe-list item matching `- URL | yes` or `- URL | no`.
3. Ignore instructional examples, placeholders, and any item where the URL starts with `<`.
4. Preserve the selected row's `yes`/`no` application-question flag throughout extraction and drafting.
5. Run the URL application workflow on the selected URL.
6. Remove the selected inbox item only after the processed tracker row and application folder exist.

For `process all` or `process inbox all`, repeat the same process for each real unprocessed URL in order. Stop the batch when a URL cannot be inspected reliably, when expected `| yes` questions are not visible and must be manually pasted, or when any other blocker needs user input.

When a direct URL is provided, first check whether the same URL already exists under `Unprocessed URLs`. If it does, use that row's `yes`/`no` flag and remove that inbox item only after the processed tracker row and application folder exist.

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
- Real inbox URLs are pipe-list items under `## Unprocessed URLs` that do not start with `<`; placeholders and examples are instructions, not work items.
- Remove an inbox item only after the processed tracker row and application folder exist.
- New processed rows must use `[ ]` in the `Applied` column. Only the user manually changes `[ ]` to `[x]` after submitting.

For `| yes` inbox items, proceed to CV/letter/answer drafting only when both job text and expected form fields/questions/uploads are captured. If questions are not visible, create only `job.md` and `application-answers.md`; mark both as waiting for manually pasted questions, include a paste area for exact questions, and stop.

If a URL cannot be inspected reliably, keep it under `Unprocessed URLs` and ask for pasted job text, screenshots, or visible questions.

## Resume Questions Workflow

Use this for `questions pasted`, `form questions`, or `continue <slug>` after a previous `| yes` application stopped waiting for manual form questions.

1. Identify the application folder from `<slug>` or the most recent waiting folder if the user has clearly pasted questions for it.
2. Read that folder's `job.md` and `application-answers.md`.
3. Preserve the exact pasted question text in both files.
4. Generate only local draft answers for copy-paste review, using `personal/` as the source of personal facts and matching the form-question language.
5. If enough information is now available, complete the normal packet files that were intentionally skipped while waiting, including CV, optional personal letter, evidence, a minimal `review.md` notes file, and PDFs as appropriate.
6. Stop for manual review. Do not type answers into the form, upload documents, submit, send emails, or mark the application as applied.

## Candidate-Facing Material

Use `personal/` as the only approved source for personal-specific facts.

- Every candidate-facing claim in `cv.html`, `personal-letter.html`, and `application-answers.md` must come from `personal/`.
- Do not invent employers, dates, skills, education, credentials, metrics, projects, responsibilities, or achievements.
- Job descriptions can provide employer needs and vocabulary, but not new personal facts.
- If source documents do not support a useful claim, record missing evidence in `evidence.md` or ask for the missing fact if critical.
- For CV generation, read `personal/cv-generation-rules.md` and use its Swedish/English CV template examples as the default wording foundation for summaries, work-experience descriptions, project descriptions, and other reusable CV sections. Follow the examples more strictly than before and make only minor edits for role relevance when the edited wording remains supported by `personal/`.
- Never mention the application company name in a CV, including visible text and HTML `<title>` metadata. Do not write phrases such as `hos <company>`, `i rollen hos <company>`, `för <company>`, or equivalent company-specific CV wording. Use job text only for relevance, ordering, emphasis, omission, and small wording changes.
- In CV HTML, each work-experience entry and each project entry should have one `<li>` description. If multiple sentence lines are needed, keep them inside that one `<li>` and separate readable lines with `<br>`.
- In the education section, keep the degree and thesis/publication facts stable, but treat any extra supporting line as curated per role. For software roles, a programming/coursework line may fit. For medtech roles, prefer medtech-relevant support or omit the extra line if nothing fits well.
- Personal letters should focus on the strongest application-relevant evidence instead of repeating all background.
- Personal letters should sound semi-spoken, direct, and source-grounded rather than recruiter-polished.
- Mild colloquial phrasing is allowed when natural, but stronger slang or dramatic expressions should usually be softened into recruiter-safe wording.
- Prefer concrete/selective detail over generic summary when named systems or practical examples materially strengthen fit.
- CV summaries should stay tighter and more restrained than personal letters.
- A denser flowing middle paragraph is acceptable when that better matches Marcus's voice.
- Do not force a rigid word target when a slightly longer letter better matches Marcus's natural voice and strongest evidence.

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
