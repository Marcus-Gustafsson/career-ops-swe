# Project Instructions

Specialized job application helper. The original `career-ops` project is archived at `inspo/career-ops/` for reference only.

## Core Workflow

When an application URL is provided:

1. Inspect the job/application page read-only.
2. Extract the company, role, job description, language, requirements, application questions, upload fields, and constraints.
3. Create or update the matching row in `applications.md` under `Processed Applications`.
4. Create an application folder under `applications/{company-role}/`.
5. Generate `job.md`, `cv.html`, `cv.pdf`, `application-answers.md`, `evidence.md`, and `review.md`, plus `personal-letter.html` and `personal-letter.pdf` only when the posting asks for or allows a personal letter. If the inbox item is marked `| yes` and expected application questions are not visible, create only `job.md` and `application-answers.md`, mark them as waiting for manually pasted questions, and stop.
6. Stop for manual review. Never submit an application.

## Application Tracker Inbox

- `applications.md` has an `Unprocessed URLs` section for raw URLs as pipe-list items: `- URL | yes` or `- URL | no`.
- Use only `yes` and `no` for the application questions flag.
- `| yes` means application form questions are expected or must be checked.
- `| no` means only normal job extraction and drafts are needed.
- A raw URL under `Unprocessed URLs` is not a processed tracker row yet.
- When processing a raw URL, inspect it read-only, create the application folder, add a row under `Processed Applications`, then remove the raw URL from `Unprocessed URLs`.
- If the item is marked `| yes`, try to extract visible application questions or form fields during read-only inspection.
- If the item is marked `| yes` but questions are not visible with current browser capability, create the application folder with only `job.md` and `application-answers.md`; `job.md` must include the source URL, company/role if extractable, inspection notes, and a clear note that questions are expected but not visible; `application-answers.md` must include a paste area for exact form questions and no generated answers.
- If a URL cannot be inspected, keep it under `Unprocessed URLs` and ask for pasted job text, screenshots, or visible questions.
- New processed rows must use `[ ]` in the `Applied` column.
- Only the user manually changes `Applied` to `[x]` after submitting an application.

## Source-of-Truth Rule

- `personal/` is the only approved source for personal-specific facts.
- Every candidate-facing claim in a CV, personal letter, or application answer must stem from `personal/`.
- Do not invent employers, dates, skills, education, credentials, metrics, projects, responsibilities, or achievements.
- If the source documents do not support a useful claim, write it as missing evidence in `evidence.md` or ask for the missing fact/information if critical for the application.
- Job descriptions can provide employer needs and vocabulary, but not new personal facts, as all facts and claims come from the documents within `personal/`.

## Evidence Citation Rule

- Every generated `evidence.md` must map each non-static candidate-facing claim in `cv.html`, `personal-letter.html`, and `application-answers.md` to both a source path and a direct quote.
- Non-static claims include tailored summaries, selected skills, experience bullets, project bullets, motivation statements, freeform answers, and yes/no answers that assert a personal fact. Basic contact details and document headings do not need quote rows unless they contain a factual claim.
- Split claim evidence into document-specific sections: `CV Evidence`, `Personal Letter Evidence`, and `Application Answers Evidence`. Include only the sections for generated documents that exist and contain candidate-facing content.
- If no personal letter is generated because the posting says not to send one, do not create `personal-letter.html`, `personal-letter.pdf`, or an empty `Personal Letter Evidence` section; note the omission under `Removed or Avoided Claims`.
- Use this table format for each document-specific evidence section: `Draft claim / text`, `Used in`, `Source`, `Direct quote`.
- Prefer `personal/originals/*` when a direct quote is easy to extract and materially clearer. Use `personal/*.md` when it is the approved distilled source, the original is unavailable, or the original is too broad. For education PDF evidence, use `personal/education.md` unless PDF text extraction is available.
- Keep job-description facts in `Job Facts Used`; they may justify tailoring and vocabulary, but must not be used as personal candidate evidence.

## Language Rule

- Candidate-facing material must match the application/form language.
- Swedish applications or Swedish form questions require total Swedish CV text, personal letter, and answers (loanwords are okay).
- English applications or English form questions require total English CV text, personal letter, and answers.
- If the posting mixes languages, follow the language used in the application form questions. If no form is visible, follow the job description language.
- Internal notes for the project can be either in English or Swedish unless told otherwise.

## Browser and Application Safety

- Browser interaction is read-only by default.
- Do not type into fields, upload documents, submit forms, send emails, or click final application actions unless explicitly told for that specific action.
- Even when drafting application answers, present them for copy-paste and review first, then generate the answer locally.
- Do not mark applications as applied or check the `Applied` checkbox; this is done manually by the user when the application has been sent.

## File Structure

- `personal/` contains private source-of-truth documents.
- `applications.md` is the markdown checklist tracker.
- `applications/{company-role}/` contains one application's extracted job notes, editable HTML documents, generated PDFs, application answers, evidence notes, and review notes.
- `templates/` contains future CV and personal-letter templates.
- `inspo/career-ops/` is a read-only reference snapshot.

## Reference Policy

- Treat `inspo/career-ops/` as inspiration, not active project logic.
- Do not run `inspo/career-ops/update-system.mjs apply` or archived career-ops workflows unless user explicitly asks.
- Borrow archived code or templates only when they align with `ROADMAP.md`, and explain how the borrowed code/templates fits before borrowing/implementing the borrowed code/template.
- Preserve personal artifacts inside the archive unless user asks to migrate or remove them.
