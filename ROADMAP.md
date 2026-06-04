# Roadmap

This project is a focused job application helper. The first product goal is simple: given an application URL, inspect the job and form read-only, then generate a specialized CV, personal letter, and answers to application questions using only source-of-truth documents from `personal/`.

## Current Next Step

- [x] Use `applications/_template/` for the first real job-application packet.
- [x] Generate one real application packet before settling the final editable document format.
- [x] Capture review feedback in that application's `review.md`.
- [ ] Promote reusable fixes from `review.md` into `personal/cv-generation-rules.md`, `templates/`, or `AGENTS.md`.
- [x] Generate mock Swedish CV and personal-letter layout files for visual inspection.

## Phase 1 - Source of Truth

Status: complete

- [x] Create `personal/` as the only approved source for candidate-specific facts.
- [x] Preserve original evidence documents under `personal/originals/`.
- [x] Normalize stable facts into editable Markdown source files.
- [x] Define static versus tailored CV sections in `personal/cv-generation-rules.md`.
- [x] Require generated CVs, letters, and answers to trace every personal claim back to `personal/`.
- [x] Define missing-evidence behavior: write a TODO or ask for the fact instead of inventing experience, dates, metrics, employers, skills, or credentials.

## Phase 2 - Application Tracking

Status: complete for first smoke test

- [x] Use `applications.md` as the human-readable tracker.
- [x] Add `Unprocessed URLs` as a pipe-list inbox for raw job URLs and application-questions flags.
- [x] Define processed application rows with `Applied`, company, role, URL, language, folder, and notes.
- [x] Keep unchecked rows for not-yet-applied applications.
- [x] Mark an application as applied only after manual confirmation.

## Phase 3 - URL Inspection

Status: first live URL smoke test complete; reusable form extraction fallback pending

- [x] Start each workflow from a user-provided application URL.
- [x] Inspect the page read-only and extract company, role, job description, application language, requirements, visible questions, upload fields, and constraints.
- [x] Do not type into forms, upload files, submit applications, or click final apply/submit actions.
- [x] If the page cannot be inspected reliably, ask for pasted job text, screenshots, or visible questions.
- [ ] Improve reusable handling for application forms that are hidden, session-gated, or not exposed to headless inspection.

## Phase 4 - Per-Application Workspace

Status: first live application workspace complete; repeatability pending

- [x] Create one folder per application under `applications/{company-role}/`.
- [x] Use slugified company and role names; if a folder already exists, append a short suffix such as `-2`.
- [x] Use `applications/_template/` as the starting structure.
- [x] Store `job.md`, `cv.html`, `cv.pdf`, `application-answers.md`, `evidence.md`, and `review.md` per application.
- [x] Store `personal-letter.html` and `personal-letter.pdf` only when the posting asks for or allows a personal letter.
- [x] Store PDFs in the same application folder once the PDF phase is implemented.

## Phase 5 - HTML Document Generation

Status: first live Swedish CV HTML/PDF complete; reusable generation still pending

- [x] Generate candidate-facing text in the application/form language.
- [x] Swedish application or form questions produce Swedish CV, personal letter, and answers.
- [ ] English application or form questions produce English CV, personal letter, and answers.
- [x] Keep CV and personal-letter submission documents editable as HTML and regenerate PDFs from those files.
- [x] Keep application answers in Markdown because they are reviewed and copied into forms.
- [x] Preserve a clear review step before any application is submitted.

## Phase 6 - HTML/PDF Generation

Status: pending

- [ ] Borrow the useful parts of `inspo/career-ops/generate-pdf.mjs` and the archived template approach.
- [x] Keep the new implementation smaller: editable CV and personal-letter HTML rendered directly to PDF.
- [ ] Use single-column layouts, selectable text, clear headings, and no rasterized body content.
- [ ] Include ATS-safe text normalization from the archived implementation where useful.
- [ ] Tune CV and personal-letter layout after one Markdown packet has been reviewed.

## Phase 7 - Review and Applied Status

Status: pending

- [ ] Present generated files for manual review.
- [ ] Record missing evidence and unanswered questions in `evidence.md`.
- [ ] Record QA notes and reusable improvement ideas in `review.md`.
- [ ] Promote reusable improvements into `personal/cv-generation-rules.md`, `templates/`, or `AGENTS.md`.
- [ ] Update `applications.md` only after manual confirmation of what happened.
- [ ] Keep the application folder as the long-term record of what was generated and sent.

## Later Ideas

- [ ] Add script-assisted URL intake and folder creation.
- [ ] Add validation that generated claims cite `personal/` evidence.
- [ ] Add reusable HTML templates under `templates/`.
- [ ] Add optional browser automation for form field discovery, still read-only by default.
- [ ] Borrow scanning or dashboard ideas from `inspo/career-ops/` only if they become clearly useful.
