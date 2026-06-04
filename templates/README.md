# Templates

This folder will hold simplified templates for CV and personal-letter generation.

Initial direction:

- HTML-first editable CV and personal-letter files.
- Simple ATS-friendly PDF output from HTML.
- Single-column PDF layouts with selectable text.
- Reuse only the useful parts of `inspo/career-ops/generate-pdf.mjs` and its template approach.

Current templates:

- `cv-layout.html` - HTML/PDF layout baseline for CV output.
- `personal-letter-layout.html` - HTML/PDF layout baseline for personal-letter output.

Mock layout generation:

```bash
npm run mock:layout
```

The mock command writes Swedish placeholder output to `applications/_mock-layout/` for visual inspection.

PDF regeneration from edited HTML:

```bash
npm run pdf -- applications/fmv-ingenjor-inom-produktdata/cv.html
```

The output defaults to the same path with `.pdf`, replacing the previous PDF.

Custom output path:

```bash
npm run pdf -- applications/fmv-ingenjor-inom-produktdata/cv.html /tmp/cv-preview.pdf
```
