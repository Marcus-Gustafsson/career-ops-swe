# Project Instructions

Specialized job application helper. The original `career-ops` project is archived at `inspo/career-ops/` for reference only.

## Trigger Phrase Router

Treat these short user phrases as workflow commands:

| User phrase | Behavior |
|---|---|
| `new url`, `new application`, `new job application`, `next application`, `process inbox`, `process next` | Read `applications.md`, find the first real URL under `Unprocessed URLs`, then run the normal URL application workflow. |
| `process all`, `process inbox all` | Process every real unprocessed URL in order, stopping on blockers that require manually pasted questions or other user input. |
| `inbox`, `tracker`, `status`, `show applications` | Summarize unprocessed URLs and processed applications, with the next recommended action. |
| `pdf <slug>`, `regenerate pdf <slug>` | Regenerate `cv.pdf` and, only if present, `personal-letter.pdf`. |
| `pdf <html-file>` | Regenerate one specific PDF with `npm run pdf -- <html-file>`. |
| Direct job/application URL | Process that URL immediately. If it already exists under `Unprocessed URLs`, use that row's `yes`/`no` flag. |
| `questions pasted`, `form questions`, `continue <slug>` | Resume a waiting application folder after manually pasted form questions are supplied. |

For inbox-trigger phrases, the first real unprocessed URL is the first pipe-list item under `## Unprocessed URLs` matching `- URL | yes` or `- URL | no` where the URL is not a placeholder and does not start with `<`.

For direct URL input, first check whether the URL already exists under `Unprocessed URLs`; if so, preserve the row's `yes`/`no` application-question flag and remove the inbox item only after a processed tracker row and application folder exist.

Do not copy the archived `apply` behavior. This project only drafts local copy-paste answers and stops for manual review.

## Core Workflow

When an application URL is provided:

1. Inspect the job/application page agent-first using read-only web/page access, then run `npm run extract -- --url "<url>"` as a structured cross-check or fallback.
2. Extract the company, role, job description, language, requirements, application questions, upload fields, and constraints.
3. Create or update the matching row in `applications.md` under `Processed Applications`.
4. Create an application folder under `applications/{company-role}/`.
5. Generate `job.md`, `cv.html`, `cv.pdf`, `application-answers.md`, `evidence.md`, and `review.md`, plus `personal-letter.html` and `personal-letter.pdf` only when the posting asks for or allows a personal letter. If the inbox item is marked `| yes` and expected application questions are not visible, create only `job.md` and `application-answers.md`, mark them as waiting for manually pasted questions, and stop.
6. Stop for manual review. Never submit an application.

## Agent-First Extraction

- Start with agent-first read-only inspection of the normal job URL. Use web/page access to extract job facts, job description, requirements, uploads, personal-letter policy, exact application questions, personal fields, constraints, and application/form URLs.
- Job descriptions and application forms may live on separate URLs. Treat apply/application buttons and links as part of extraction, not as submission actions.
- If the normal job URL contains the job description but does not expose upload fields, personal-letter policy, personal/contact fields, or exact application questions, look for application/form URLs before stopping.
- Candidate application/form URLs include visible apply buttons/links, rendered text links, page-source `a[href]`, `iframe[src]`, `turbo-frame[src]`, `form[action]`, and obvious labels such as `Apply`, `Apply now`, `Ansök`, `Sök jobbet`, `Skicka ansökan`, or equivalent local-language text.
- Run `npm run extract -- --url "<url>"` as a structured scanner and cross-check, not as the first authority. Use `npm run extract -- --url "<url>" --json` only when structured output is easier to compare.
- Compare agent/web inspection against the extractor report before trusting it. Flag mismatches such as job text that describes benefits, privacy, cookies, related jobs, or another page instead of the actual role.
- Open discovered application/form URLs read-only. Do not type, upload, submit, send, or click final submission actions. Inspect only enough to capture fields, upload requirements, personal-letter policy, exact questions, constraints, and whether login/BankID/manual input blocks further inspection.
- If either method finds an application/form URL, inspect that URL read-only and run `npm run extract -- --url "<application-or-form-url>"` if useful.
- The extractor is an inspection helper, not an application generator. It may fetch pages, render pages, inspect frames, and report fields, but it must not type into fields, upload files, submit forms, send emails, or mark applications as applied.
- Preserve exact form question text in `job.md` and `application-answers.md`; do not paraphrase questions that will be answered in the real form.
- When job description and application form live on different URLs, record both the source job URL and inspected application/form URL in `job.md`.
- Keep the combined agent/web inspection and extractor cross-check bounded to about 2-3 minutes. Use the waiting-for-manually-pasted-questions flow only after the normal job URL and any discovered application/form URLs have been inspected or reasonably attempted within the time bound.
- For `| yes` inbox items, proceed to CV/letter/answer drafting only when both the job text and the expected form fields/questions/uploads are captured. If questions are still missing, follow the waiting-for-manually-pasted-questions flow.
- If `npm run extract` fails for environment or network reasons, record the failure in `job.md` or keep the URL under `Unprocessed URLs` if no reliable job facts can be inspected.

### Extraction Completeness

Before drafting candidate-facing material, confirm the extraction captured:

- Company, role, language, location, and deadline when present.
- Job description and requirements.
- Upload fields and whether a personal letter is required, optional, allowed, or absent.
- Exact application questions.
- Personal data fields separated from job-specific questions.
- Extraction notes showing methods tried and any failures.

### Agent Audit Checklist

- Does the reported job text describe the actual role, not a benefits, privacy, cookie, related-jobs, or generic company page?
- Do all visible form questions in rendered text appear under application questions?
- Are consent, marketing, privacy, and future-job-offer fields separated from job-specific questions?
- Are personal/contact fields separated from job-specific questions?
- Are upload fields and personal-letter rules explicit?

## Application Tracker Inbox

- `applications.md` has an `Unprocessed URLs` section for raw URLs as pipe-list items: `- URL | yes` or `- URL | no`.
- Use only `yes` and `no` for the application questions flag.
- `| yes` means application form questions are expected or must be checked.
- `| no` means only normal job extraction and drafts are needed.
- A raw URL under `Unprocessed URLs` is not a processed tracker row yet.
- Real inbox work items are pipe-list URL rows that do not start with `<`; placeholders and examples are not work items.
- When processing a raw URL, inspect it read-only, create the application folder, add a row under `Processed Applications`, then remove the raw URL from `Unprocessed URLs`.
- If the item is marked `| yes`, use agent-first read-only inspection and the extractor cross-check to capture visible application questions or form fields.
- If the item is marked `| yes` but questions are not visible with current browser capability, create the application folder with only `job.md` and `application-answers.md`; `job.md` must include the source URL, company/role if extractable, inspection notes, and a clear note that questions are expected but not visible; `application-answers.md` must include a paste area for exact form questions and no generated answers.
- If a URL cannot be inspected, keep it under `Unprocessed URLs` and ask for pasted job text, screenshots, or visible questions.
- New processed rows must use `[ ]` in the `Applied` column.
- Only the user manually changes `Applied` to `[x]` after submitting an application.

### Resume Manually Pasted Questions

- Use `questions pasted`, `form questions`, or `continue <slug>` when a `| yes` application was previously stopped because exact form questions were not visible.
- Read the waiting folder's `job.md` and `application-answers.md`, preserve the exact pasted question text, then draft local copy-paste answers in the form-question language.
- If the pasted questions unblock the full packet, generate the skipped CV, optional personal letter, evidence, a minimal `review.md` notes file, and PDFs as appropriate.
- Stop for manual review and never type into the live form, upload files, submit, send emails, or mark the tracker row as applied.

## Source-of-Truth Rule

- `personal/` is the only approved source for personal-specific facts.
- Every candidate-facing claim in a CV, personal letter, or application answer must stem from `personal/`.
- Do not invent employers, dates, skills, education, credentials, metrics, projects, responsibilities, or achievements.
- If the source documents do not support a useful claim, write it as missing evidence in `evidence.md` or ask for the missing fact/information if critical for the application.
- Job descriptions can provide employer needs and vocabulary, but not new personal facts, as all facts and claims come from the documents within `personal/`.
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

## Test Policy

- Do not add tests that depend on ephemeral job posts, live application pages, or real employer URLs, because those sources can change or disappear.
- Add tests only when they are necessary and important for the project.
- Ask before adding any tests.

## File Structure

- `personal/` contains private source-of-truth documents.
- `applications.md` is the markdown checklist tracker.
- `applications/{company-role}/` contains one application's extracted job notes, editable HTML documents, generated PDFs, application answers, evidence notes, and a minimal `review.md` file for manual notes.
- `templates/` contains future CV and personal-letter templates.
- `inspo/career-ops/` is a read-only reference snapshot.

## Reference Policy

- Treat `inspo/career-ops/` as inspiration, not active project logic.
- Do not run `inspo/career-ops/update-system.mjs apply` or archived career-ops workflows unless user explicitly asks.
- Borrow archived code or templates only when they align with `ROADMAP.md`, and explain how the borrowed code/templates fits before borrowing/implementing the borrowed code/template.
- Preserve personal artifacts inside the archive unless user asks to migrate or remove them.
