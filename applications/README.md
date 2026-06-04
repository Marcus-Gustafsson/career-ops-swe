# Application Workspaces

Raw job application URLs start in `../applications.md` under `Unprocessed URLs` as pipe-list items:

```markdown
- https://example.com/job-url | yes
- https://example.com/job-url | no
```

Use `yes` when application form questions are expected or must be checked. Use `no` when only normal job extraction and drafts are needed.

Each job application gets one folder here, named with a slugified company and role:

```text
applications/{company-role}/
```

Start by copying the template folder:

```text
applications/_template/ -> applications/{company-role}/
```

If a folder already exists for the same company and role, append a short suffix such as `-2` instead of overwriting it.

Expected files per application:

- `job.md` - extracted posting, requirements, form questions, uploads, and constraints.
- `cv.html` - editable tailored CV source.
- `cv.pdf` - generated CV PDF for submission.
- `personal-letter.html` - editable personal letter source, only when the posting asks for or allows a personal letter.
- `personal-letter.pdf` - generated personal letter PDF for submission, only when a personal letter is needed.
- `application-answers.md` - exact form questions with copy-paste-ready answers.
- `evidence.md` - source mapping and missing evidence.
- `review.md` - checklist/todo review notes and reusable improvement ideas.

## Manual Workflow

1. Add the raw URL to `../applications.md` under `Unprocessed URLs` as `- URL | yes` or `- URL | no`.
2. Inspect the URL agent-first using read-only web/page access, then run the extractor as a structured cross-check or fallback.
3. Extract company, role, language, application requirements, questions, uploads, and constraints.
4. Create `applications/{company-role}/` from `_template/`.
5. Fill `job.md` with the extracted posting and form requirements.
6. Add a row to `../applications.md` under `Processed Applications` with `Applied` set to `[ ]`.
7. Remove the raw URL from `Unprocessed URLs` only after the processed row and application folder exist.
8. Generate `cv.html` and, when needed, `personal-letter.html` using only `../personal/` as candidate evidence.
9. Regenerate the matching PDFs from the editable HTML files.
10. Keep `application-answers.md` as the Markdown review/copy-paste workspace for form answers.
11. Map every non-static candidate-facing claim in the generated HTML files and form answers to direct citations in `evidence.md`.
12. Capture review feedback and reusable future improvements in `review.md`.
13. Do not mark the tracker checkbox as applied until the application has actually been submitted manually.

If a URL cannot be inspected, keep it under `Unprocessed URLs` and ask for pasted job text, screenshots, or visible questions.

If the inbox item is marked `| yes`, try to extract visible application questions or form fields during read-only inspection. If questions are expected but not visible with current browser capability, create only `job.md` and `application-answers.md` in the application folder, mark both as waiting for manually pasted questions, and stop before generating CV, personal letter, evidence, or answers.

## Agent-First Extraction Workflow

Start with agent-first read-only inspection before creating or drafting an application packet. Use web/page access to extract the actual job posting and visible application form details, then run the extractor from the project root as a structured cross-check:

```bash
npm run extract -- --url "https://example.com/job-or-apply-url"
```

Use JSON output only when structured data is more useful:

```bash
npm run extract -- --url "https://example.com/job-or-apply-url" --json
```

The extractor is read-only. It may fetch pages, render pages, inspect frames, follow iframe/direct form URLs, and report fields. It must not type into fields, upload files, submit forms, send emails, click final application actions, update `applications.md`, or mark an application as applied.

Use this bounded sequence:

1. Inspect the normal job URL agent-first with read-only web/page access.
2. Extract job facts, job text, requirements, upload fields, personal-letter policy, exact form questions, personal fields, constraints, and direct form URLs.
3. Run `npm run extract -- --url "<url>"` as a scanner and cross-check, not as the first authority.
4. Compare agent/web inspection against the extractor report and flag mismatches.
5. If either method reveals a direct form URL, inspect it read-only and run `npm run extract -- --url "<direct-form-url>"` when useful.
6. Stop after about 2-3 minutes of reasonable attempts. Ask for pasted questions/screenshots instead of continuing indefinitely.

Use the report as structured inspection evidence for:

- Source URL and resolved/canonical/direct form URLs.
- Company, role, location, language, deadline when detected.
- Job description and requirement signals.
- Upload fields, accepted formats, required flags, and constraints.
- Exact application questions, question type, required flag, options, and field name/id.
- Personal data fields, kept separate from job-specific questions.
- Extraction notes and failed methods.

Agent audit checklist:

- Does the reported job text describe the actual role, not a benefits/privacy/cookie/related-jobs page?
- Do all visible form questions in rendered text appear under application questions?
- Are consent, marketing, privacy, and future-job-offer fields separated from job-specific questions?
- Are personal/contact fields separated from job-specific questions?
- Are upload fields and personal-letter rules explicit?

Extraction completeness checklist:

- Company, role, language, location, and deadline when present.
- Job description and requirements.
- Upload fields and whether a personal letter is required, optional, allowed, or absent.
- Exact application questions.
- Personal data fields separated from job-specific questions.
- Extraction notes showing methods tried and any failures.

For `| yes` inbox items, proceed to CV/letter/answer drafting only when both the job text and visible form fields/questions/uploads are captured. If the extractor finds questions, copy the exact question text into `job.md` and `application-answers.md`. If it does not find questions, continue with bounded manual read-only inspection. If questions still are not visible, create only `job.md` and `application-answers.md`, add a paste area for manually copied questions, and stop before generating candidate-facing documents.

## Evidence Format

`evidence.md` must make it easy to verify where generated material came from. Split claim evidence into document-specific sections:

- `CV Evidence`
- `Personal Letter Evidence`
- `Application Answers Evidence`

Include only sections for documents that exist and contain generated candidate-facing material. If a personal letter is intentionally not generated, note that under `Removed or Avoided Claims` instead of adding an empty evidence section.

Use this table format in each evidence section:

```markdown
| Draft claim / text | Used in | Source | Direct quote |
|---|---|---|---|
| PLC och sensorer | `cv.html` > Färdigheter | `personal/originals/om_mig.odt` | "..." |
```

Evidence rules:

- Quote the closest available source for each non-static claim: tailored summaries, selected skills, experience bullets, project bullets, motivation statements, freeform answers, and yes/no answers that assert a personal fact.
- Basic contact details and document headings do not need quote rows unless they contain a factual claim.
- Prefer `../personal/originals/*` when the direct quote is easy to extract and materially clearer.
- Use `../personal/*.md` when it is the approved distilled source, the original is unavailable, or the original is too broad.
- For education PDF evidence, use `../personal/education.md` unless PDF text extraction is available.
- Keep job-description facts in `Job Facts Used`; job facts may explain tailoring and vocabulary, but they are not personal evidence.

Do not create per-application Markdown draft files for the CV or personal letter. The editable source files for submission documents are `cv.html` and `personal-letter.html`.

## Regenerate PDFs

After manually editing an HTML file in an application folder, regenerate the matching PDF from the project root.

The folder slug is the folder name under `applications/`.

Regenerate a CV PDF:

```bash
npm run cv -- fmv-ingenjor-inom-produktdata
```

This reads:

```text
applications/fmv-ingenjor-inom-produktdata/cv.html
```

and replaces:

```text
applications/fmv-ingenjor-inom-produktdata/cv.pdf
```

Regenerate a personal-letter PDF:

```bash
npm run pl -- fmv-ingenjor-inom-produktdata
```

This reads `personal-letter.html` and replaces `personal-letter.pdf` in the same application folder. If an application does not have a personal-letter HTML file, the command fails with a message explaining which file is missing.
