#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const DEFAULT_TIMEOUT_MS = 30000;
const RENDER_SETTLE_MS = 3000;

const PERSONAL_FIELD_RE =
  /(^|[\s:-])(e-?post(adress)?|email|bekräfta e-?post(adress)?|bekrafta e-?post(adress)?|förnamn|fornamn|efternamn|namn|födelse(år)?|fodelse(ar)?|kön|kon|telefon|mobil|adress|postnummer|ort|land|linkedin|personuppgifter|personnummer|var såg du|var sag du|annonsen|personuppgift|integritet|integritetspolicy|samtycke|marknadsföring|marknadsforing|framtida jobberbjudanden|future job|behandlar mina personuppgifter)([\s:*-]|$)/i;
const NON_QUESTION_FIELD_RE =
  /^(ja|nej|välj|valj|välj\.\.\.|valj\.\.\.|välj fil|valj fil|skriv i formulär istället|skriv i formular istallet|registrera|skicka|ansök|ansok|ångra|angra|fetstil|kursiv stil|vänsterställ|vansterstall|centrera|högerställ|hogerstall|punktlista)$/i;
const STATIC_REQUIREMENTS_RE =
  /(krav|kräver|ska ha|must|required|required qualifications|requirements|kvalifikationer|meriterande|nice to have|vi söker dig|om dig)/i;
const FORM_URL_RE = /\/(applications\/new|apply|application|jobapply|candidate|candidates)([/?#]|$)/i;
const NOISE_TEXT_RE =
  /^(acceptera alla cookies|neka alla|inställningar för cookies|strikt nödvändiga|statistik|teamtailor|godkänn dessa cookies|hoppa till huvudinnehållet|karriärmeny|fler jobb|ansök här|ladda upp fler|klicka för att ladda upp|dra en fil hit|släpp en fil|laddar upp|menade du|valt land|förhandsvisa sammanfattning\.?)$/i;

function cleanText(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function oneLine(value) {
  return cleanText(value).replace(/\s+/g, " ").trim();
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = keyFn(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function absolutizeUrl(value, baseUrl) {
  if (!value) return "";
  try {
    return new URL(value, baseUrl).href;
  } catch {
    return "";
  }
}

export function isCandidateFormUrl(value, baseUrl = "") {
  const url = absolutizeUrl(value, baseUrl) || value;
  try {
    const parsed = new URL(url);
    if (/^\/candidates?\/?$/i.test(parsed.pathname)) return false;
    return FORM_URL_RE.test(`${parsed.pathname}${parsed.search}${parsed.hash}`);
  } catch {
    return FORM_URL_RE.test(String(value || ""));
  }
}

function emptyResult(url) {
  return {
    source: { url, inspectedAt: new Date().toISOString(), readOnly: true },
    resolvedUrls: [],
    jobFacts: {
      company: "",
      role: "",
      location: "",
      language: "",
      deadline: "",
    },
    jobDescriptionText: "",
    requirementsText: "",
    uploads: [],
    questions: [],
    personalDataFields: [],
    constraints: [],
    extractionNotes: [],
  };
}

function addNote(result, method, status, detail = "") {
  result.extractionNotes.push({ method, status, detail });
}

function addResolvedUrl(result, url, source) {
  if (!url) return;
  if (!result.resolvedUrls.some((entry) => entry.url === url)) {
    result.resolvedUrls.push({ url, source });
  }
}

function addConstraint(result, text, source) {
  const normalized = oneLine(text);
  if (!normalized) return;
  if (!result.constraints.some((entry) => entry.text === normalized)) {
    result.constraints.push({ text: normalized, source });
  }
}

function addQuestions(result, questions) {
  result.questions = uniqueBy(
    [...result.questions, ...questions].filter((question) => question.text),
    (question) => `${question.type}:${question.name || question.id || ""}:${question.text}`,
  );
}

function addPersonalFields(result, fields) {
  result.personalDataFields = uniqueBy(
    [...result.personalDataFields, ...fields].filter((field) => field.label),
    (field) => `${field.type}:${field.name || field.id || ""}:${field.label}`,
  );
}

function addUploads(result, uploads) {
  result.uploads = uniqueBy(
    [...result.uploads, ...uploads].filter((upload) => upload.label),
    (upload) => `${upload.name || upload.id || ""}:${upload.label}`,
  );
}

function mergeJobFacts(result, facts) {
  for (const [key, value] of Object.entries(facts)) {
    const current = result.jobFacts[key];
    const next = oneLine(value);
    const currentIsGeneric = /^(lediga jobb|ansök|ansok|jobb|apply)$/i.test(current || "");
    if (next && (!current || currentIsGeneric)) {
      result.jobFacts[key] = next;
    }
  }
}

async function fetchText(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "career-ops-swe-read-only-extractor/0.1",
      },
    });
    const text = await response.text();
    return { ok: response.ok, status: response.status, url: response.url, text };
  } finally {
    clearTimeout(timer);
  }
}

function getAttr(html, pattern) {
  const match = html.match(pattern);
  return match ? cleanText(match[1]) : "";
}

function stripHtml(html) {
  return cleanText(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<\/(p|div|li|h\d|br|tr|section|article)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code))),
  );
}

function extractStaticHints(html, pageUrl) {
  const title =
    getAttr(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
    getAttr(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const description =
    getAttr(html, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
    getAttr(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
  const ogUrl = absolutizeUrl(
    getAttr(html, /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i),
    pageUrl,
  );
  const canonicalUrl = absolutizeUrl(
    getAttr(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i),
    pageUrl,
  );
  const lang = getAttr(html, /<html[^>]+lang=["']([^"']+)["']/i);
  const bodyText = stripHtml(html);
  const scripts = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)]
    .map((match) => absolutizeUrl(match[1], pageUrl))
    .filter(Boolean);
  const iframes = [...html.matchAll(/<iframe[^>]+src=["']([^"']+)["']/gi)]
    .map((match) => absolutizeUrl(match[1], pageUrl))
    .filter(Boolean);
  const candidateFormUrls = discoverCandidateFormUrlsFromHtml(html, pageUrl);
  const trackingBaseUrl = getAttr(html, /baseUrl:\s*['"]([^'"]+)['"]/i);
  const derivedPublicUrl = trackingBaseUrl
    ? absolutizeUrl(new URL(pageUrl).pathname, trackingBaseUrl)
    : "";
  const jsonLdJob = extractJsonLdJobPosting(html);

  return {
    title,
    description,
    ogUrl,
    canonicalUrl,
    derivedPublicUrl,
    lang,
    bodyText,
    scripts,
    iframes,
    candidateFormUrls,
    jsonLdJob,
  };
}

export function discoverCandidateFormUrlsFromHtml(html, pageUrl) {
  const urls = [];
  const add = (value, source) => {
    const url = absolutizeUrl(value, pageUrl);
    if (url && isCandidateFormUrl(url)) urls.push({ url, source });
  };
  for (const match of html.matchAll(/<(iframe|turbo-frame)[^>]+src=["']([^"']+)["']/gi)) {
    add(match[2], `${match[1]} src`);
  }
  for (const match of html.matchAll(/<form[^>]+action=["']([^"']+)["']/gi)) {
    add(match[1], "form action");
  }
  for (const match of html.matchAll(/\s(data-[\w:-]+)=["']([^"']+)["']/gi)) {
    if (isCandidateFormUrl(match[2], pageUrl)) add(match[2], match[1]);
  }
  return uniqueBy(urls, (entry) => entry.url);
}

function extractJsonLdJobPosting(html) {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const script of scripts) {
    const parsed = parseJson(script[1]);
    const posting = findJobPosting(parsed);
    if (posting) {
      return {
        role: posting.title || "",
        company: posting.hiringOrganization?.name || "",
        deadline: posting.validThrough || "",
        location: extractJobLocation(posting.jobLocation),
        description: stripHtml(posting.description || ""),
      };
    }
  }
  return null;
}

function parseJson(text) {
  try {
    return JSON.parse(text.replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
  } catch {
    return null;
  }
}

function findJobPosting(value) {
  if (!value) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findJobPosting(item);
      if (found) return found;
    }
  }
  if (typeof value === "object") {
    const type = value["@type"];
    if (type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"))) return value;
    if (value["@graph"]) return findJobPosting(value["@graph"]);
  }
  return null;
}

function extractJobLocation(location) {
  const first = Array.isArray(location) ? location[0] : location;
  const address = first?.address || first;
  return oneLine([address?.addressLocality, address?.addressRegion, address?.addressCountry].filter(Boolean).join(", "));
}

function extractRequirementText(bodyText) {
  const lines = cleanText(bodyText)
    .split("\n")
    .map(oneLine)
    .filter(Boolean);
  return lines.filter((line) => STATIC_REQUIREMENTS_RE.test(line)).join("\n");
}

function extractConstraintLines(bodyText, source) {
  const lines = cleanText(bodyText)
    .split("\n")
    .map(oneLine)
    .filter(Boolean);
  return lines
    .filter((line) =>
      /(personligt brev|personal letter|photo|bild|cv|betyg|intyg|certificate|upload|ladda upp|bifoga|deadline|sista ansökningsdag|security|säkerhetsprövning|citizen|medborgare)/i.test(
        line,
      ),
    )
    .slice(0, 20)
    .map((text) => ({ text, source }));
}

function isPersonalField(label) {
  return PERSONAL_FIELD_RE.test(oneLine(label));
}

function isIgnorableQuestion(label) {
  const normalized = oneLine(label);
  return (
    !normalized ||
    normalized.length < 3 ||
    NON_QUESTION_FIELD_RE.test(normalized) ||
    NOISE_TEXT_RE.test(normalized) ||
    /^obligatoriskt$/i.test(normalized)
  );
}

function fieldKind(type, tagName) {
  if (tagName === "TEXTAREA") return "free-text";
  if (tagName === "SELECT") return "select";
  if (type === "radio") return "radio";
  if (type === "checkbox") return "checkbox";
  if (type === "file") return "upload";
  if (type === "submit" || type === "button") return type;
  if (type === "hidden") return "hidden";
  return "text";
}

export async function collectDocumentFromPageLike(pageLike, pageUrl, source) {
  const documentData = await pageLike.evaluate(() => {
    const clean = (value) =>
      String(value || "")
        .replace(/\u00a0/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    const textBlock = (value) =>
      String(value || "")
        .replace(/\u00a0/g, " ")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    const labelFor = (element) => {
      if (!element) return "";
      if (element.id) {
        const explicit = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
        if (explicit) return clean(explicit.innerText);
      }
      const wrapping = element.closest("label");
      if (wrapping) return clean(wrapping.innerText);
      const group = element.closest(".form-group, .form-row, .field, .question, fieldset, [class*='upload']");
      if (group) {
        const label = group.querySelector("label, legend");
        if (label) return clean(label.innerText);
      }
      return "";
    };
    const questionLabelFor = (element) => {
      const fieldsetLegend = element.closest("fieldset")?.querySelector("legend");
      if (fieldsetLegend) return clean(fieldsetLegend.innerText).replace(/\s*(Obligatoriskt|Required)\s*$/i, "");
      const question = element.closest(".question, [data-question-uuid]");
      const label = question?.querySelector("legend, label");
      if (label) return clean(label.innerText).replace(/\s*(Obligatoriskt|Required)\s*$/i, "");
      return "";
    };
    const allTextNodesBefore = (element) => {
      const root = element.closest("form") || document.body;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (node.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING) {
          const text = clean(node.textContent);
          if (text) nodes.push(text);
        }
      }
      return nodes;
    };
    const precedingQuestionText = (element) => {
      const nodes = allTextNodesBefore(element).filter(
        (text) =>
          !/^(ja|nej|yes|no|välj|valj|välj\.\.\.|valj\.\.\.|choose|select|födelseår|fodelsear|\*|uppgifter markerade.*obligatoriska)$/i.test(
            text,
          ) &&
          !/^(obligatoriskt|required)$/i.test(text) &&
          !/^du kan bifoga filer/i.test(text) &&
          text.length > 2,
      );
      return nodes[nodes.length - 1] || "";
    };
    const optionsForSelect = (select) =>
      [...select.options].map((option) => clean(option.innerText)).filter(Boolean);
    const optionForInput = (input) => {
      if (input.id) {
        const label = document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
        if (label) return clean(label.innerText);
      }
      const parentLabel = input.closest("label");
      if (parentLabel) return clean(parentLabel.innerText);
      let node = input.nextSibling;
      while (node) {
        const text = node.nodeType === Node.TEXT_NODE ? clean(node.textContent) : clean(node.innerText);
        if (text) return text;
        node = node.nextSibling;
      }
      return input.value || "";
    };
    const formRoots = [
      ...document.querySelectorAll(
        "form, #application_form, [id*='application' i], [class*='application' i], [data-controller*='form' i]",
      ),
    ];
    const rootsWithControls = formRoots
      .filter((root) => root.querySelector("input, textarea, select, button"))
      .filter((root, index, all) => !all.some((other, otherIndex) => otherIndex !== index && other.contains(root)));
    const controlRoots = rootsWithControls.length ? rootsWithControls : [];
    const controlElements = [...new Set(controlRoots.flatMap((root) => [...root.querySelectorAll("input, textarea, select, button")]))];
    const controls = controlElements.map((element) => ({
      tagName: element.tagName,
      type: (element.getAttribute("type") || "").toLowerCase(),
      name: element.getAttribute("name") || "",
      id: element.id || "",
      value: element.getAttribute("value") || "",
      label: labelFor(element),
      questionLabel: questionLabelFor(element),
      precedingText: precedingQuestionText(element),
      text: clean(element.innerText || element.getAttribute("aria-label") || element.getAttribute("placeholder") || ""),
      required:
        element.required ||
        element.getAttribute("aria-required") === "true" ||
        Boolean(element.getAttribute("data-msg")) ||
        element.closest("[data-question-mandatory='true']") !== null ||
        /\*/.test(labelFor(element) || questionLabelFor(element) || precedingQuestionText(element)),
      options: element.tagName === "SELECT" ? optionsForSelect(element) : [],
      optionLabel:
        element.getAttribute("type") === "radio" || element.getAttribute("type") === "checkbox"
          ? optionForInput(element)
          : "",
      accept: element.getAttribute("accept") || "",
    }));
    const scripts = [...document.querySelectorAll("script[src]")].map((script) => script.src).filter(Boolean);
    const links = [...document.querySelectorAll("a[href], link[href]")]
      .map((link) => link.href)
      .filter(Boolean);
    const iframes = [...document.querySelectorAll("iframe[src]")].map((iframe) => iframe.src).filter(Boolean);
    const candidateFormUrls = [];
    const formPattern = /\/(applications\/new|apply|application|jobapply|candidate|candidates)([/?#]|$)/i;
    const addCandidate = (value, source) => {
      if (!value || !formPattern.test(value)) return;
      try {
        const url = new URL(value, document.baseURI);
        if (/^\/candidates?\/?$/i.test(url.pathname)) return;
        candidateFormUrls.push({ url: url.href, source });
      } catch {
        // Some data attributes contain controller config fragments rather than URLs.
      }
    };
    document.querySelectorAll("iframe[src], turbo-frame[src]").forEach((element) => {
      addCandidate(element.getAttribute("src"), `${element.tagName.toLowerCase()} src`);
    });
    document.querySelectorAll("form[action]").forEach((element) => {
      addCandidate(element.getAttribute("action"), "form action");
    });
    document.querySelectorAll("*").forEach((element) => {
      for (const attribute of element.attributes) {
        if (attribute.name.startsWith("data-")) addCandidate(attribute.value, attribute.name);
      }
    });
    const metas = Object.fromEntries(
      [...document.querySelectorAll("meta[name], meta[property]")].map((meta) => [
        meta.getAttribute("name") || meta.getAttribute("property"),
        meta.getAttribute("content") || "",
      ]),
    );
    return {
      title: document.title || "",
      lang: document.documentElement.lang || "",
      h1: clean(document.querySelector("h1")?.innerText || ""),
      h2: clean(document.querySelector("h2")?.innerText || ""),
      bodyText: textBlock(document.body?.innerText || ""),
      controls,
      scripts,
      links,
      iframes,
      candidateFormUrls,
      metas,
    };
  });

  return normalizeDocumentData(documentData, pageUrl, source);
}

function normalizeDocumentData(data, pageUrl, source) {
  const radioGroups = new Map();
  const questions = [];
  const personalDataFields = [];
  const uploads = [];

  for (const control of data.controls) {
    const type = fieldKind(control.type, control.tagName);
    if (type === "hidden" || type === "submit" || type === "button") {
      if (
        type === "button" &&
        /välj fil|valj fil|choose file/i.test(control.text) &&
        !/^(ångra|angra|fetstil|kursiv|vänsterställ|vansterstall|centrera|högerställ|hogerstall|punktlista)$/i.test(control.text)
      ) {
        const label = oneLine(control.label || control.precedingText || control.text);
        uploads.push({
          label,
          type: "upload",
          required: Boolean(control.required || /\*/.test(label)),
          acceptedFormats: acceptedFormatsFromText(label),
          name: control.name,
          id: control.id,
          source,
        });
      }
      continue;
    }
    if (/(^|-)required$/i.test(control.name || control.id || "")) {
      continue;
    }
    if (!control.name && !control.id && ["text", "free-text", "select", "checkbox"].includes(type)) {
      continue;
    }

    if (type === "upload") {
      const label = oneLine(control.label || control.precedingText || "File upload");
      if (
        /^file upload$/i.test(label) ||
        /^(ie8_upload|fileform_ulitmateuploadfield)$/i.test(control.id || "") ||
        /^(afile)$/i.test(control.name || "")
      ) {
        continue;
      }
      uploads.push({
        label,
        type: "upload",
        required: Boolean(control.required || /\*/.test(label)),
        acceptedFormats: control.accept || acceptedFormatsFromText(label),
        name: control.name,
        id: control.id,
        source,
      });
      continue;
    }

    if (type === "radio") {
      const key = control.name || control.id;
      const text = oneLine(control.questionLabel || control.precedingText || control.label);
      if (!radioGroups.has(key)) {
        radioGroups.set(key, {
          text,
          type: "radio",
          required: Boolean(control.required || /\*/.test(control.questionLabel || control.precedingText || control.label)),
          options: [],
          name: control.name,
          id: control.id,
          source,
        });
      }
      const group = radioGroups.get(key);
      if (text && (!group.text || isIgnorableQuestion(group.text))) group.text = text;
      group.required = group.required || Boolean(control.required || /\*/.test(control.questionLabel || control.precedingText || control.label));
      const option = oneLine(control.optionLabel || control.value);
      if (option && !group.options.includes(option)) group.options.push(option);
      continue;
    }

    const label = oneLine(control.label || control.questionLabel || control.precedingText || control.text);
    if (isIgnorableQuestion(label)) continue;
    const field = {
      label,
      text: label,
      type,
      required: Boolean(control.required || /\*/.test(label)),
      options: control.options.filter((option) => !/^välj/i.test(option)).slice(0, 30),
      name: control.name,
      id: control.id,
      source,
    };
    if (isPersonalField(label)) {
      personalDataFields.push({ ...field, label });
    } else {
      questions.push(field);
    }
  }

  for (const group of radioGroups.values()) {
    if (isIgnorableQuestion(group.text)) continue;
    if (isPersonalField(group.text)) {
      personalDataFields.push({ ...group, label: group.text });
    } else {
      questions.push(group);
    }
  }

  return {
    pageUrl,
    title: oneLine(data.title),
    lang: oneLine(data.lang),
    role: oneLine(data.h1 || data.h2 || data.metas?.["og:title"] || data.title),
    bodyText: cleanText(data.bodyText),
    scripts: data.scripts.map((script) => absolutizeUrl(script, pageUrl)).filter(Boolean),
    links: data.links.map((link) => absolutizeUrl(link, pageUrl)).filter(Boolean),
    iframes: data.iframes.map((iframe) => absolutizeUrl(iframe, pageUrl)).filter(Boolean),
    candidateFormUrls: uniqueBy(
      (data.candidateFormUrls || [])
        .map((entry) => ({ url: absolutizeUrl(entry.url, pageUrl), source: entry.source }))
        .filter((entry) => entry.url),
      (entry) => entry.url,
    ),
    questions,
    personalDataFields,
    uploads,
    constraints: extractConstraintLines(data.bodyText, source),
  };
}

function acceptedFormatsFromText(text) {
  const matches = [...String(text).matchAll(/\.(docx?|rtf|pdf|pptx?|jpe?g|gif|png)/gi)].map((match) =>
    match[0].toLowerCase(),
  );
  return [...new Set(matches)].join(" ");
}

function isRelevantNetworkUrl(url) {
  return (
    /customerjs|\/ext\/|apply|application|job|candidate|reachmee|attract/i.test(url) &&
    !/cookiebot|font|\.css|\.js|\.woff|\.jpg|\.jpeg|\.png|\.svg|\.gif|tinymce|jquery|bootstrap|countries|validate|rm\.utils/i.test(
      url,
    )
  );
}

export function parseReachMeeScript(scriptText, scriptUrl, pageUrl) {
  const varValue = (name) => {
    const match = scriptText.match(new RegExp(`var\\s+${name}\\s*=\\s*['"]([^'"]*)['"]`, "i"));
    return match ? match[1] : "";
  };
  const iid = varValue("iid") || scriptUrl.match(/\/(I\d+)-/)?.[1] || "I009";
  const customer = varValue("customer") || scriptUrl.match(/I\d+-(\d+)-/)?.[1] || "";
  const site = varValue("site") || scriptUrl.match(/I\d+-\d+-(\d+)\.js/i)?.[1] || "";
  const validator = varValue("validator");
  const langDef = varValue("langDef") || "SE";
  const iFrameUrl = varValue("iFrameUrl") || new URL("/ext/", scriptUrl).href;
  const page = new URL(pageUrl);
  const rmpage = page.searchParams.get("rmpage") || "main";
  const rmjob = page.searchParams.get("rmjob") || page.searchParams.get("RMURL") || page.searchParams.get("rmurl") || "";
  const rmlang = page.searchParams.get("rmlang") || langDef;
  const rmproj = page.searchParams.get("rmproj") || "";

  return { iid, customer, site, validator, lang: rmlang, iFrameUrl, rmpage, rmjob, rmproj };
}

export function buildReachMeeDirectUrls(config) {
  if (!config.customer || !config.site || !config.validator) return [];
  let destPage = config.rmpage || "main";
  const params = new URLSearchParams({
    site: config.site,
    validator: config.validator,
    lang: config.lang || "SE",
    notrack: "1",
  });

  if (["job", "apply", "application"].includes(destPage)) {
    if (!config.rmjob) destPage = "main";
    else params.set("job_id", config.rmjob);
  }
  if (destPage === "assessment" && config.rmproj) params.set("commseqno", config.rmproj);
  if (destPage === "booking" && config.rmproj && config.rmjob) {
    params.set("commseqno", config.rmproj);
    params.set("job_id", config.rmjob);
  }

  const base = new URL(`${config.iid}/${config.customer}/${destPage}`, config.iFrameUrl).href;
  return [`${base}?${params.toString()}`];
}

async function inspectRenderedUrl(browser, url, result, label, timeoutMs) {
  const page = await browser.newPage();
  const networkUrls = [];
  page.on("response", (response) => {
    networkUrls.push(response.url());
  });
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.waitForTimeout(RENDER_SETTLE_MS);
    const documents = [];
    for (const frame of page.frames()) {
      if (frame.url() === "about:blank" || frame.url() === "about:srcdoc") continue;
      try {
        documents.push(await collectDocumentFromPageLike(frame, frame.url(), `${label}: ${frame.url()}`));
      } catch (error) {
        addNote(result, `${label}: frame ${frame.url()}`, "failed", error.message);
      }
    }
    for (const document of documents) {
      mergeDocument(result, document);
    }
    for (const networkUrl of networkUrls.filter(isRelevantNetworkUrl)) {
      addResolvedUrl(result, networkUrl, `${label} network`);
    }
    addNote(result, label, "ok", `Rendered ${documents.length} document(s)`);
    return documents;
  } catch (error) {
    addNote(result, label, "failed", error.message);
    return [];
  } finally {
    await page.close();
  }
}

function mergeDocument(result, document) {
  addResolvedUrl(result, document.pageUrl, "rendered document");
  mergeJobFacts(result, {
    role: document.role,
    language: document.lang,
  });
  if (shouldReplaceLongText(result.jobDescriptionText, document.bodyText) && document.questions.length === 0) {
    result.jobDescriptionText = document.bodyText.slice(0, 12000);
  }
  if (!result.requirementsText) {
    result.requirementsText = extractRequirementText(document.bodyText).slice(0, 6000);
  }
  addQuestions(result, document.questions);
  addPersonalFields(result, document.personalDataFields);
  addUploads(result, document.uploads);
  for (const constraint of document.constraints) addConstraint(result, constraint.text, constraint.source);
}

function shouldReplaceLongText(current, next) {
  const cleanCurrent = cleanText(current);
  const cleanNext = cleanText(next);
  if (!cleanNext) return false;
  if (!cleanCurrent) return true;
  if (/lediga jobb|ansök|ansok/i.test(cleanCurrent) && cleanNext.length > cleanCurrent.length + 200) return true;
  return cleanNext.length > cleanCurrent.length * 1.5 && cleanNext.length > cleanCurrent.length + 500;
}

async function inspectStaticUrl(url, result, timeoutMs) {
  try {
    const response = await fetchText(url, timeoutMs);
    addResolvedUrl(result, response.url, "static fetch");
    const hints = extractStaticHints(response.text, response.url);
    if (hints.ogUrl) addResolvedUrl(result, hints.ogUrl, "og:url");
    if (hints.canonicalUrl) addResolvedUrl(result, hints.canonicalUrl, "canonical");
    if (hints.derivedPublicUrl && hints.derivedPublicUrl !== response.url) {
      addResolvedUrl(result, hints.derivedPublicUrl, "tracking baseUrl + path");
    }
    mergeJobFacts(result, {
      role: hints.jsonLdJob?.role || splitCompanyRole(hints.title).role || hints.title,
      company: hints.jsonLdJob?.company || splitCompanyRole(hints.title).company,
      location: hints.jsonLdJob?.location,
      deadline: hints.jsonLdJob?.deadline,
      language: hints.lang,
    });
    const descriptionText = [hints.description, hints.jsonLdJob?.description, hints.bodyText].filter(Boolean).join("\n\n");
    if (shouldReplaceLongText(result.jobDescriptionText, descriptionText)) {
      result.jobDescriptionText = cleanText(descriptionText).slice(
        0,
        12000,
      );
    }
    if (!result.requirementsText) {
      result.requirementsText = extractRequirementText(hints.bodyText).slice(0, 6000);
    }
    for (const constraint of extractConstraintLines(hints.bodyText, `static: ${response.url}`)) {
      addConstraint(result, constraint.text, constraint.source);
    }
    addNote(result, `static fetch: ${url}`, response.ok ? "ok" : "warning", `HTTP ${response.status}`);
    return { ...hints, pageUrl: response.url, html: response.text };
  } catch (error) {
    addNote(result, `static fetch: ${url}`, "failed", error.message);
    return null;
  }
}

function splitCompanyRole(title) {
  const normalized = oneLine(title);
  if (!normalized) return { company: "", role: "" };
  const pipeParts = normalized.split(/\s+\|\s+/);
  if (pipeParts.length >= 2) return { company: pipeParts[0], role: pipeParts.slice(1).join(" | ") };
  const dashParts = normalized.split(/\s+-\s+|\s+–\s+/);
  if (dashParts.length >= 2) {
    return { company: dashParts.slice(1).join(" - "), role: dashParts[0] };
  }
  return { company: "", role: normalized };
}

async function inspectReachMeeScripts(scripts, pageUrl, result, browser, timeoutMs) {
  const inspected = [];
  for (const scriptUrl of scripts) {
    if (!/\/customerjs\/I\d+-\d+-\d+\.js/i.test(scriptUrl)) continue;
    const response = await fetchText(scriptUrl, timeoutMs).catch((error) => {
      addNote(result, `ReachMee script: ${scriptUrl}`, "failed", error.message);
      return null;
    });
    if (!response?.text) continue;
    const config = parseReachMeeScript(response.text, response.url || scriptUrl, pageUrl);
    const directUrls = buildReachMeeDirectUrls(config);
    for (const directUrl of directUrls) {
      if (inspected.includes(directUrl)) continue;
      inspected.push(directUrl);
      addResolvedUrl(result, directUrl, "ReachMee direct form");
      await inspectRenderedUrl(browser, directUrl, result, "ReachMee direct form", timeoutMs);
    }
  }
  return inspected;
}

async function inspectCandidateFormUrls(urls, result, browser, timeoutMs) {
  const candidates = uniqueBy(
    urls
      .map((entry) => (typeof entry === "string" ? { url: entry, source: "candidate" } : entry))
      .filter((entry) => /^https?:\/\//i.test(entry.url))
      .filter((entry) => isCandidateFormUrl(entry.url))
      .filter(
        (entry) =>
          !/scupload|sccheckemail|cookiebot|font|css|\.css|\.js|\.woff|\.jpg|\.jpeg|\.png|\.svg|\.gif/i.test(
            entry.url,
          ),
      )
      .sort((a, b) => candidatePriority(a.url, result.source.url) - candidatePriority(b.url, result.source.url)),
    (entry) => entry.url,
  ).slice(0, 8);

  for (const candidate of candidates) {
    if (candidate.url === result.source.url || result.resolvedUrls.some((entry) => entry.url === candidate.url)) {
      continue;
    }
    await inspectRenderedUrl(browser, candidate.url, result, `candidate form URL (${candidate.source})`, timeoutMs);
  }
}

function candidatePriority(candidateUrl, sourceUrl) {
  try {
    const candidate = new URL(candidateUrl);
    const source = new URL(sourceUrl);
    if (candidate.origin === source.origin && /applications\/new/i.test(candidate.pathname)) return 0;
    if (candidate.origin === source.origin) return 1;
    if (/\/ext\//i.test(candidate.pathname)) return 2;
    return 3;
  } catch {
    return 4;
  }
}

function formatsFromConstraints(constraints) {
  for (const constraint of constraints) {
    const formats = acceptedFormatsFromText(constraint.text);
    if (formats) return formats;
  }
  return "";
}

function uploadRequiredFromConstraints(upload, constraints) {
  if (upload.required) return true;
  const labelStart = oneLine(upload.label).slice(0, 30).toLowerCase();
  if (!labelStart) return false;
  return constraints.some((constraint) => {
    const text = oneLine(constraint.text).toLowerCase();
    return text.includes(labelStart) && /\*/.test(constraint.text);
  });
}

function finalizeResult(result) {
  result.questions = result.questions.map((question) => ({
    text: oneLine(question.text || question.label),
    type: question.type,
    required: Boolean(question.required),
    options: question.options || [],
    name: question.name || "",
    id: question.id || "",
    source: question.source || "",
  }));
  result.personalDataFields = result.personalDataFields.map((field) => ({
    label: oneLine(field.label || field.text),
    type: field.type,
    required: Boolean(field.required),
    options: field.options || [],
    name: field.name || "",
    id: field.id || "",
    source: field.source || "",
  }));
  result.uploads = result.uploads.map((upload) => ({
    label: oneLine(upload.label),
    type: "upload",
    required: uploadRequiredFromConstraints(upload, result.constraints),
    acceptedFormats: upload.acceptedFormats || formatsFromConstraints(result.constraints),
    name: upload.name || "",
    id: upload.id || "",
    source: upload.source || "",
  }));
  if (result.questions.length === 0) {
    addNote(
      result,
      "question visibility",
      "warning",
      "No job-specific application questions were extracted. If the inbox item is marked | yes, inspect manually or request pasted questions.",
    );
  }
  return result;
}

export async function extractApplication(url, options = {}) {
  const timeoutMs = Number(options.timeoutMs || DEFAULT_TIMEOUT_MS);
  process.env.TMPDIR ||= "/tmp";
  process.env.PLAYWRIGHT_ARTIFACTS_PATH ||= "/tmp";

  const result = emptyResult(url);
  addResolvedUrl(result, url, "source");

  const staticOriginal = await inspectStaticUrl(url, result, timeoutMs);
  const staticUrls = [staticOriginal?.ogUrl, staticOriginal?.canonicalUrl, staticOriginal?.derivedPublicUrl].filter(Boolean);
  for (const staticUrl of staticUrls) {
    if (staticUrl !== url) await inspectStaticUrl(staticUrl, result, timeoutMs);
  }

  const browser = await chromium.launch({ headless: true });
  try {
    const renderedDocuments = await inspectRenderedUrl(browser, url, result, "render original", timeoutMs);
    const scriptUrls = uniqueBy(
      [
        ...(staticOriginal?.scripts || []),
        ...renderedDocuments.flatMap((document) => document.scripts),
        ...result.resolvedUrls.map((entry) => entry.url),
      ],
      (entry) => entry,
    );
    await inspectReachMeeScripts(scriptUrls, url, result, browser, timeoutMs);
    const candidateUrls = [
      ...(staticOriginal?.iframes || []).map((url) => ({ url, source: "static iframe" })),
      ...(staticOriginal?.candidateFormUrls || []),
      ...renderedDocuments.flatMap((document) => [
        ...document.iframes.map((url) => ({ url, source: "render iframe" })),
        ...document.links.map((url) => ({ url, source: "render link" })),
        ...(document.candidateFormUrls || []),
      ]),
      ...result.resolvedUrls.map((entry) => ({ url: entry.url, source: entry.source })),
    ];
    await inspectCandidateFormUrls(candidateUrls, result, browser, timeoutMs);
  } finally {
    await browser.close();
  }

  return finalizeResult(result);
}

function formatList(items, formatter, emptyText = "- None extracted.") {
  if (!items.length) return emptyText;
  return items.map(formatter).join("\n");
}

export function formatMarkdown(result) {
  const facts = result.jobFacts;
  return `# Application Extraction

## Source

- Source URL: ${result.source.url}
- Inspected at: ${result.source.inspectedAt}
- Read-only: ${result.source.readOnly ? "yes" : "no"}

## Resolved URLs

${formatList(result.resolvedUrls, (entry) => `- ${entry.url} (${entry.source})`)}

## Job Facts

- Company: ${facts.company || "Not detected"}
- Role: ${facts.role || "Not detected"}
- Location: ${facts.location || "Not detected"}
- Language: ${facts.language || "Not detected"}
- Deadline: ${facts.deadline || "Not detected"}

## Job Description / Posting Text

${result.jobDescriptionText || "Not extracted."}

## Requirements Signals

${result.requirementsText || "Not extracted."}

## Upload Fields

${formatList(
  result.uploads,
  (upload) =>
    `- ${upload.label} | required: ${upload.required ? "yes" : "no"} | formats: ${
      upload.acceptedFormats || "not detected"
    } | field: ${upload.name || upload.id || "n/a"}`,
)}

## Application Questions

${formatList(
  result.questions,
  (question, index) =>
    `${index + 1}. ${question.text}\n   - Type: ${question.type}\n   - Required: ${
      question.required ? "yes" : "no"
    }\n   - Options: ${question.options?.length ? question.options.join(", ") : "n/a"}\n   - Field: ${
      question.name || question.id || "n/a"
    }`,
)}

## Personal Data Fields

${formatList(
  result.personalDataFields,
  (field) =>
    `- ${field.label} | type: ${field.type} | required: ${field.required ? "yes" : "no"} | field: ${
      field.name || field.id || "n/a"
    }`,
)}

## Constraints

${formatList(result.constraints, (constraint) => `- ${constraint.text} (${constraint.source})`)}

## Extraction Notes

${formatList(result.extractionNotes, (note) => `- ${note.method}: ${note.status}${note.detail ? ` - ${note.detail}` : ""}`)}
`;
}

function parseArgs(argv) {
  const args = { url: "", json: false, timeoutMs: DEFAULT_TIMEOUT_MS };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--url") args.url = argv[++i] || "";
    else if (arg === "--json") args.json = true;
    else if (arg === "--timeout-ms") args.timeoutMs = Number(argv[++i] || DEFAULT_TIMEOUT_MS);
    else if (!arg.startsWith("--") && !args.url) args.url = arg;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.url) {
    console.error('Usage: npm run extract -- --url "<application-url>" [--json] [--timeout-ms 30000]');
    process.exit(2);
  }
  const result = await extractApplication(args.url, { timeoutMs: args.timeoutMs });
  if (args.json) console.log(JSON.stringify(result, null, 2));
  else console.log(formatMarkdown(result));
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
