#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = resolve(rootDir, 'applications/_mock-layout');
const githubProfileUrl = 'https://github.com/marcus-gustafsson';

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function template(html, replacements) {
  return Object.entries(replacements).reduce(
    (out, [key, value]) => out.replaceAll(`{{${key}}}`, value),
    html,
  );
}

function tags(items) {
  return items.map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join('\n        ');
}

function bullets(items) {
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

function projectTitle(title, url = githubProfileUrl) {
  return `<h3><a href="${escapeHtml(url)}">${escapeHtml(title)}</a></h3>`;
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

async function renderPdf(inputHtml, outputPdf) {
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const html = normalizeTextForATS(await readFile(inputHtml, 'utf8'));
    await page.setContent(html, {
      waitUntil: 'networkidle',
      baseURL: `${pathToFileURL(dirname(inputHtml)).href}/`,
    });
    await page.evaluate(() => document.fonts.ready);
    await page.pdf({
      path: outputPdf,
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
}

function cvBody() {
  return `
    <header class="header">
      <h1>Marcus Gustafsson</h1>
      <div class="accent"></div>
      <div class="contact">
        <span>Örebro, Sverige</span>
        <a href="mailto:marcus.thomas.gustafsson@gmail.com">Marcus.Thomas.Gustafsson@gmail.com</a>
        <span>+46 70 26 33 044</span>
        <a href="https://www.linkedin.com/in/marcus-gustafsson-1926518a/">LinkedIn</a>
        <a href="https://github.com/marcus-gustafsson">GitHub</a>
      </div>
    </header>

    <section>
      <h2>Sammanfattning</h2>
      <p class="summary">Mocktext: Medicinteknisk ingenjör med erfarenhet från automation, felsökning, medicinteknisk utrustning och praktisk mjukvaruutveckling. Den här sammanfattningen är avsiktligt skriven som layoutprov och ska i en riktig ansökan anpassas efter rollens behov utan att lägga till fakta som saknar stöd i <code>personal/</code>.</p>
    </section>

    <section>
      <h2>Färdigheter</h2>
      <div class="skills">
        ${tags(['Python', 'Flask', 'PostgreSQL', 'Git/GitHub', 'Medicinteknik', 'Automation', 'Felsökning', 'Dokumentation', 'AI/LLM-utvärdering', 'Användarperspektiv', 'Svenska - flytande', 'Engelska - flytande', 'Finska - nybörjare'])}
      </div>
    </section>

    <section>
      <h2>Arbetslivserfarenhet</h2>
      <article class="entry">
        <div class="entry-head">
          <h3>AI-träning / frilans</h3>
          <span class="meta">Dec. 2024 - pågående</span>
        </div>
        <div class="role">Distans</div>
        ${bullets([
          'Mocktext: arbetar med prompt engineering och strukturerad utvärdering av AI/LLM-svar för att identifiera svagheter och förbättringsmöjligheter.',
          'Mocktext: använder kriteriebaserad granskning för att bedöma kvalitet, korrekthet och följsamhet i modellrespons.',
        ])}
      </article>
      <article class="entry">
        <div class="entry-head">
          <h3>Medicinteknisk ingenjör - Universitetssjukhuset i Örebro</h3>
          <span class="meta">Juni 2021 - aug. 2021, juni 2022 - juli 2022</span>
        </div>
        <div class="role">Örebro</div>
        ${bullets([
          'Mocktext: utförde förebyggande och avhjälpande underhåll av medicinteknisk utrustning med fokus på dokumentation, spårbarhet och patientsäkerhet.',
          'Mocktext: arbetade med övervakningssystem, diatermiutrustning, endoskopiutrustning och kardiotokografer i sjukhusmiljö.',
          'Mocktext: samarbetade med flera yrkesgrupper inom vården och utvecklade förståelse för kliniska användarbehov.',
        ])}
      </article>
      <article class="entry">
        <div class="entry-head">
          <h3>Linje- och automationstekniker - Spendrups Bryggeri AB</h3>
          <span class="meta">Nov. 2013 - juni 2018, feb. 2019 - aug. 2019</span>
        </div>
        <div class="role">Grängesberg</div>
        ${bullets([
          'Mocktext: felsökte mekaniska, elektriska och mjukvarurelaterade driftstörningar på produktionslinjer och prioriterade åtgärder utifrån produktionspåverkan.',
          'Mocktext: arbetade praktiskt med PLC-system, sensorer, servomotorer, ventiler, frekvensomriktare och styrsystem.',
          'Mocktext: bidrog till installation, driftsättning och förbättring av produktionsutrustning tillsammans med interna tekniker och externa leverantörer.',
        ])}
      </article>
    </section>

    <section>
      <h2>Projekt</h2>
      <article class="entry">
        <div class="entry-head">
          ${projectTitle('Paddlingen')}
          <span class="meta">Python, Flask, PostgreSQL</span>
        </div>
        ${bullets([
          'Mocktext: webbaserad bokningsapplikation med formulär, inloggning, CSRF-skydd, rate limiting, databasmodeller och adminvy.',
          'Mocktext: erfarenhet av användarflöden, driftsättning, miljövariabler, backup, övervakning och underhållbarhet.',
        ])}
      </article>
      <article class="entry">
        <div class="entry-head">
          ${projectTitle('Neurofeedback Training App')}
          <span class="meta">Python, EEG, Muse2</span>
        </div>
        ${bullets([
          'Mocktext: kandidatarbete inom EEG/neurofeedback med fokus på tydlighet, användbarhet och patientnära träningsprogram.',
        ])}
      </article>
    </section>

    <section>
      <h2>Utbildning och publikation</h2>
      <p><strong>Högskoleingenjör: Medicinteknik</strong>, Kungliga Tekniska Högskolan (KTH), 2020 - 2024.</p>
      <p><strong>Kandidatuppsats:</strong> <a href="https://kth.diva-portal.org/smash/record.jsf?pid=diva2%3A1860681&dswid=6645">Developing and Validating a User-Friendly Application for Neurofeedback Training</a>.</p>
    </section>

    <section>
      <h2>Referenser</h2>
      <p>Referenser tillgängliga på begäran.</p>
    </section>

    <p class="footnote">Layoutprov med mocktext. Riktig generering ska använda källor i <code>personal/</code> och dokumentera saknat stöd i <code>evidence.md</code>.</p>
  `;
}

function letterBody() {
  return `
    <div class="topline"></div>
    <header class="sender">
      <h1>Marcus Gustafsson</h1>
      <div class="contact">
        <span>Örebro, Sverige</span>
        <a href="mailto:marcus.thomas.gustafsson@gmail.com">Marcus.Thomas.Gustafsson@gmail.com</a>
        <span>+46 70 26 33 044</span>
        <a href="https://www.linkedin.com/in/marcus-gustafsson-1926518a/">LinkedIn</a>
        <a href="https://github.com/marcus-gustafsson">GitHub</a>
      </div>
    </header>

    <div class="letter-meta">
      <p>2026-06-04</p>
      <p>Exempelföretaget AB</p>
      <p>Ansökan: Junior mjukvaruutvecklare</p>
    </div>

    <p>Hej,</p>

    <p>Mocktext: Jag söker rollen eftersom den verkar kombinera praktisk problemlösning, teknisk nyfikenhet och möjligheten att bygga lösningar som används av människor i verkliga situationer. I en riktig ansökan skulle den här inledningen knytas tydligt till arbetsgivarens behov och formuleringar från jobbannonsen.</p>

    <p>Mocktext: Min bakgrund rör sig mellan medicinteknik, automation och mjukvaruutveckling. Jag har arbetat med felsökning i produktionsmiljö, med medicinteknisk utrustning i sjukhusmiljö och med egna mjukvaruprojekt där jag behövt tänka på användarflöden, databaser, säkerhet och drift.</p>

    <p>Mocktext: Ett exempel som ofta kan lyftas fram är Paddlingen, där jag byggt en Flask/PostgreSQL-applikation för bokningshantering. Ett annat är mitt kandidatarbete inom neurofeedback, där fokus låg på att göra ett träningsprogram tydligt och användbart för riktiga användare. Vilket exempel som används i ett skarpt brev ska väljas utifrån rollen.</p>

    <p>Mocktext: Jag uppskattar miljöer där man får förstå problemet ordentligt, samarbeta med andra och samtidigt ta ansvar för att föra arbetet framåt. Det här brevet är avsiktligt skrivet som layoutprov och ska inte användas som ansökan utan genomgång mot källmaterialet i <code>personal/</code>.</p>

    <div class="signature">
      <p>Vänliga hälsningar,</p>
      <p class="name">Marcus Gustafsson</p>
    </div>

    <p class="note">Layoutprov med mocktext. Riktig generering ska vara källgrundad, rollspecifik och granskas manuellt före användning.</p>
  `;
}

async function main() {
  await mkdir(outputDir, { recursive: true });

  const cvTemplate = await readFile(resolve(rootDir, 'templates/cv-layout.html'), 'utf8');
  const letterTemplate = await readFile(resolve(rootDir, 'templates/personal-letter-layout.html'), 'utf8');

  const cvHtml = template(cvTemplate, {
    LANG: 'sv',
    TITLE: 'Marcus Gustafsson - CV mock layout',
    BODY: cvBody(),
  });
  const letterHtml = template(letterTemplate, {
    LANG: 'sv',
    TITLE: 'Marcus Gustafsson - personligt brev mock layout',
    BODY: letterBody(),
  });

  const cvPath = resolve(outputDir, 'cv.html');
  const cvPdfPath = resolve(outputDir, 'cv.pdf');
  const letterPath = resolve(outputDir, 'personal-letter.html');
  const letterPdfPath = resolve(outputDir, 'personal-letter.pdf');

  await writeFile(cvPath, cvHtml);
  await writeFile(letterPath, letterHtml);
  await writeFile(resolve(outputDir, 'README.md'), `# Mock Layout Output

These files are generated layout samples with Swedish placeholder/mock text.

- \`cv.html\`
- \`cv.pdf\`
- \`personal-letter.html\`
- \`personal-letter.pdf\`

The content is not a real application. Use these files to inspect typography, spacing, page breaks, section density, and the borrowed career-ops visual baseline before generating a real job-specific application packet.
`);

  await renderPdf(cvPath, cvPdfPath);
  await renderPdf(letterPath, letterPdfPath);

  console.log(`Generated mock layout files in ${outputDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
