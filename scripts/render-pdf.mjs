#!/usr/bin/env node

import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

if (process.platform !== 'win32' && !process.env.TMPDIR) {
  process.env.TMPDIR = '/tmp';
}

function usage(exitCode = 1) {
  console.error(`Usage:
  npm run pdf -- <html-file> [pdf-file]

Examples:
  npm run pdf -- applications/fmv-ingenjor-inom-produktdata/cv.html
  npm run pdf -- applications/fmv-ingenjor-inom-produktdata/cv.html /tmp/cv-preview.pdf`);
  process.exit(exitCode);
}

function outputPathFor(inputPath, outputPath) {
  if (outputPath) return resolve(outputPath);
  if (extname(inputPath).toLowerCase() !== '.html') {
    throw new Error('Input file must be an .html file when output path is omitted.');
  }
  return inputPath.replace(/\.html$/i, '.pdf');
}

function normalizeTextForATS(html) {
  const masks = [];
  const masked = html.replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, (match) => {
    const token = `\u0000MASK${masks.length}\u0000`;
    masks.push(match);
    return token;
  });

  let out = '';
  let i = 0;
  while (i < masked.length) {
    const lt = masked.indexOf('<', i);
    if (lt === -1) {
      out += sanitize(masked.slice(i));
      break;
    }
    out += sanitize(masked.slice(i, lt));
    const gt = masked.indexOf('>', lt);
    if (gt === -1) {
      out += masked.slice(lt);
      break;
    }
    out += masked.slice(lt, gt + 1);
    i = gt + 1;
  }

  return out.replace(/\u0000MASK(\d+)\u0000/g, (_, index) => masks[Number(index)]);
}

function sanitize(text) {
  return text
    .replaceAll('\u2014', '-')
    .replaceAll('\u2013', '-')
    .replaceAll('\u201C', '"')
    .replaceAll('\u201D', '"')
    .replaceAll('\u2018', "'")
    .replaceAll('\u2019', "'")
    .replaceAll('\u2026', '...')
    .replaceAll('\u00A0', ' ')
    .replace(/[\u200B\u200C\u200D\u2060\uFEFF]/g, '');
}

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    const fallbackPath = resolve(rootDir, 'inspo/career-ops/node_modules/playwright/index.mjs');
    return import(pathToFileURL(fallbackPath).href);
  }
}

export async function renderPdf(inputHtml, outputPdf) {
  const inputPath = resolve(inputHtml);
  const outputPath = outputPathFor(inputPath, outputPdf);

  await access(inputPath, constants.R_OK).catch(() => {
    throw new Error(`HTML input file not found or not readable: ${inputPath}`);
  });

  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const html = normalizeTextForATS(await readFile(inputPath, 'utf8'));
    await page.setContent(html, {
      waitUntil: 'networkidle',
      baseURL: `${pathToFileURL(dirname(inputPath)).href}/`,
    });
    await page.evaluate(() => document.fonts.ready);
    await page.pdf({
      path: outputPath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '14mm',
        right: '14mm',
        bottom: '14mm',
        left: '14mm',
      },
    });
  } finally {
    await browser.close();
  }

  return outputPath;
}

async function main() {
  const [inputHtml, outputPdf] = process.argv.slice(2);
  if (!inputHtml) usage();
  const outputPath = await renderPdf(inputHtml, outputPdf);
  console.log(`Generated ${outputPath}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`PDF generation failed: ${error.message}`);
    process.exit(1);
  });
}
