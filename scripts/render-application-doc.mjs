#!/usr/bin/env node

import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';
import { renderPdf } from './render-pdf.mjs';

const docTypes = new Map([
  ['cv', 'cv.html'],
  ['pl', 'personal-letter.html'],
  ['personal-letter', 'personal-letter.html'],
]);

function usage(exitCode = 1) {
  console.error(`Usage:
  npm run cv -- <application-folder-slug>
  npm run pl -- <application-folder-slug>

Examples:
  npm run cv -- fmv-ingenjor-inom-produktdata
  npm run pl -- example-company-role`);
  process.exit(exitCode);
}

async function main() {
  const [docType, slug] = process.argv.slice(2);
  if (!docType || !slug || !docTypes.has(docType)) usage();

  const htmlName = docTypes.get(docType);
  const inputPath = resolve('applications', slug, htmlName);

  await access(inputPath, constants.R_OK).catch(() => {
    throw new Error(
      `Expected HTML file does not exist: ${inputPath}\n` +
      `Create or edit that HTML file first, then rerun the command.`,
    );
  });

  const outputPath = await renderPdf(inputPath);
  console.log(`Generated ${outputPath}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
