#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_CONFIG_PATH = "job-search.yml";
const HISTORY_PATH = "discovery/history.tsv";
const REPORTS_DIR = "discovery/reports";
const DEFAULT_LIMIT = 50;
const USER_AGENT = "career-ops-swe-discovery/0.1";
const PLATSBANKEN_SEARCH_URL = "https://platsbanken-api.arbetsformedlingen.se/jobs/v1/search";
const MARKDOWN_URL_RE = /https?:\/\/[^\s|)`]+/g;

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function decodeEntities(value) {
  return String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function stripHtml(value) {
  return cleanText(decodeEntities(value).replace(/<[^>]+>/g, " "));
}

function parseScalar(value) {
  const trimmed = String(value || "").trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "[]") return [];
  if (/^-?\d+$/.test(trimmed)) return Number(trimmed);
  return trimmed.replace(/^["']|["']$/g, "");
}

export function parseSimpleYaml(text) {
  const root = {};
  const stack = [{ indent: -1, value: root }];
  const lines = String(text || "").split(/\r?\n/);

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const raw = lines[lineIndex];
    const withoutComment = raw.trimStart().startsWith("#") ? "" : raw.replace(/\s+#.*$/, "");
    if (!withoutComment.trim()) continue;
    const indent = withoutComment.match(/^ */)[0].length;
    const line = withoutComment.trim();

    while (stack.length > 1 && indent <= stack.at(-1).indent) stack.pop();
    const parent = stack.at(-1).value;

    if (line.startsWith("- ")) {
      if (!Array.isArray(parent)) {
        throw new Error(`YAML parser expected list parent for: ${line}`);
      }
      const body = line.slice(2).trim();
      if (body.includes(": ")) {
        const [key, ...rest] = body.split(":");
        const value = rest.join(":").trim();
        const item = {};
        item[key.trim()] = parseScalar(value);
        parent.push(item);
        stack.push({ indent, value: item });
      } else {
        parent.push(parseScalar(body));
      }
      continue;
    }

    const sep = line.indexOf(":");
    if (sep === -1) {
      throw new Error(`YAML parser cannot parse line: ${line}`);
    }
    const target =
      Array.isArray(parent) && parent.length > 0 && typeof parent.at(-1) === "object" ? parent.at(-1) : parent;
    if (Array.isArray(target)) {
      throw new Error(`YAML parser cannot parse line: ${line}`);
    }
    const key = line.slice(0, sep).trim();
    const value = line.slice(sep + 1).trim();
    if (value) {
      target[key] = parseScalar(value);
      continue;
    }

    const nextMeaningful = lines
      .slice(lineIndex + 1)
      .map((candidate) => (candidate.trimStart().startsWith("#") ? "" : candidate.replace(/\s+#.*$/, "")))
      .find((candidate) => candidate.trim());
    const nextTrimmed = nextMeaningful?.trim() || "";
    target[key] = nextTrimmed.startsWith("- ") ? [] : {};
    stack.push({ indent, value: target[key] });
  }

  return root;
}

export function buildKeywordFilter(filter = {}) {
  const positive = (filter.positive || []).map((value) => String(value).toLowerCase());
  const negative = (filter.negative || []).map((value) => String(value).toLowerCase());

  return (title) => {
    const lower = String(title || "").toLowerCase();
    const positives = positive.filter((keyword) => lower.includes(keyword));
    const negatives = negative.filter((keyword) => lower.includes(keyword));
    return { positives, negatives, passes: positives.length > 0 && negatives.length === 0 };
  };
}

export function buildLocationFilter(filter = {}) {
  const allow = (filter.allow || []).map((value) => String(value).toLowerCase());
  const block = (filter.block || []).map((value) => String(value).toLowerCase());

  return (location) => {
    const lower = String(location || "").toLowerCase();
    const blocked = block.filter((keyword) => lower.includes(keyword));
    const allowed = allow.filter((keyword) => lower.includes(keyword));
    const passes = !lower || (blocked.length === 0 && (allow.length === 0 || allowed.length > 0));
    return { allowed, blocked, passes };
  };
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

async function fetchJson(url, opts = {}) {
  const response = await fetch(url, {
    ...opts,
    headers: {
      "user-agent": USER_AGENT,
      accept: "application/json",
      ...(opts.headers || {}),
    },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${cleanText(text).slice(0, 300)}`);
  }
  return JSON.parse(text);
}

async function fetchText(url, opts = {}) {
  const response = await fetch(url, {
    ...opts,
    headers: {
      "user-agent": USER_AGENT,
      accept: "text/plain, application/rss+xml, application/xml, text/xml, */*",
      ...(opts.headers || {}),
    },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${cleanText(text).slice(0, 300)}`);
  }
  return text;
}

function normalizeUrl(value, baseUrl = "") {
  try {
    return baseUrl ? new URL(value, baseUrl).href : new URL(value).href;
  } catch {
    return "";
  }
}

function platsbankenAdUrl(id) {
  return `https://arbetsformedlingen.se/platsbanken/annonser/${encodeURIComponent(id)}`;
}

export async function fetchPlatsbankenJobs(config, { limit = DEFAULT_LIMIT } = {}) {
  const queries = config?.sources?.platsbanken?.queries || [];
  const perQuery = Math.max(1, Math.ceil(limit / Math.max(queries.length, 1)));
  const out = [];

  for (const query of queries) {
    const json = await fetchJson(PLATSBANKEN_SEARCH_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        maxRecords: perQuery,
        startIndex: 0,
        filters: [{ type: "freetext", value: query }],
      }),
    });

    const ads = Array.isArray(json?.ads) ? json.ads : [];
    for (const ad of ads) {
      out.push({
        title: cleanText(ad.title),
        company: cleanText(ad.workplaceName),
        location: cleanText(ad.workplace),
        url: ad.id ? platsbankenAdUrl(ad.id) : "",
        deadline: cleanText(ad.lastApplicationDate).slice(0, 10),
        source: "platsbanken-api",
        sourceQuery: String(query),
        supportsSafeAutoRefresh: true,
      });
    }
  }

  return uniqueBy(out, (job) => job.url).slice(0, limit);
}

function greenhouseApiUrl(entry) {
  if (entry.api) return entry.api;
  const match = String(entry.careers_url || "").match(/job-boards(?:\.eu)?\.greenhouse\.io\/([^/?#]+)/);
  return match ? `https://boards-api.greenhouse.io/v1/boards/${match[1]}/jobs` : "";
}

function leverApiUrl(entry) {
  const match = String(entry.careers_url || "").match(/jobs\.lever\.co\/([^/?#]+)/);
  return match ? `https://api.lever.co/v0/postings/${match[1]}` : "";
}

function ashbyApiUrl(entry) {
  const match = String(entry.careers_url || "").match(/jobs\.ashbyhq\.com\/([^/?#]+)/);
  return match ? `https://api.ashbyhq.com/posting-api/job-board/${match[1]}?includeCompensation=true` : "";
}

function teamtailorRssUrl(entry) {
  if (entry.rss_url) return entry.rss_url;
  const careersUrl = String(entry.careers_url || "");
  try {
    const parsed = new URL(careersUrl);
    return `${parsed.origin}/jobs.rss`;
  } catch {
    return careersUrl.endsWith("/") ? `${careersUrl}jobs.rss` : `${careersUrl}/jobs.rss`;
  }
}

function xmlTagValue(xml, tag) {
  const match = String(xml || "").match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? cleanText(decodeEntities(match[1])) : "";
}

function teamtailorLocation(item, description) {
  const locationBlock = xmlTagValue(item, "tt:location");
  const city = xmlTagValue(locationBlock, "tt:city") || xmlTagValue(locationBlock, "city");
  const name = xmlTagValue(locationBlock, "tt:name") || xmlTagValue(locationBlock, "name");
  const country = xmlTagValue(locationBlock, "tt:country") || xmlTagValue(locationBlock, "country");
  return (
    cleanText([city || name, country].filter(Boolean).join(", ")) ||
    xmlTagValue(item, "location") ||
    (description.match(/\b(Stockholm|Uppsala|Göteborg|Gothenburg|Malmö|Lund|Linköping|Mölndal|Kalmar|Sundsvall|Luleå|Norrköping)\b/i)?.[0] || "")
  );
}

export function parseTeamtailorRss(xml, entry = {}) {
  const items = [...String(xml || "").matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map((match) => match[1]);
  return items.map((item) => {
    const title = xmlTagValue(item, "title");
    const link = xmlTagValue(item, "link");
    const description = stripHtml(xmlTagValue(item, "description"));
    const location = teamtailorLocation(item, description);
    return {
      title,
      company: entry.name || xmlTagValue(xml, "title"),
      location,
      url: normalizeUrl(link),
      deadline: "",
      source: "teamtailor-rss",
      supportsSafeAutoRefresh: true,
    };
  });
}

async function fetchAtsEntry(entry) {
  const provider = entry.provider || "";
  if (provider === "greenhouse") {
    const json = await fetchJson(greenhouseApiUrl(entry));
    return (json?.jobs || []).map((job) => ({
      title: cleanText(job.title),
      company: entry.name,
      location: cleanText(job.location?.name),
      url: normalizeUrl(job.absolute_url),
      deadline: "",
      source: "greenhouse-api",
      supportsSafeAutoRefresh: true,
    }));
  }
  if (provider === "lever") {
    const json = await fetchJson(leverApiUrl(entry));
    return (Array.isArray(json) ? json : []).map((job) => ({
      title: cleanText(job.text),
      company: entry.name,
      location: cleanText(job.categories?.location),
      url: normalizeUrl(job.hostedUrl || job.applyUrl),
      deadline: "",
      source: "lever-api",
      supportsSafeAutoRefresh: true,
    }));
  }
  if (provider === "ashby") {
    const json = await fetchJson(ashbyApiUrl(entry));
    return (json?.jobs || []).map((job) => ({
      title: cleanText(job.title),
      company: entry.name,
      location: cleanText(job.location),
      url: normalizeUrl(job.jobUrl),
      deadline: "",
      source: "ashby-api",
      supportsSafeAutoRefresh: true,
    }));
  }
  if (provider === "teamtailor") {
    const xml = await fetchText(teamtailorRssUrl(entry));
    return parseTeamtailorRss(xml, entry);
  }
  throw new Error(`Unsupported ATS provider "${provider}" for ${entry.name}`);
}

export async function fetchAtsJobs(config, { limit = DEFAULT_LIMIT } = {}) {
  const source = config?.sources?.ats || {};
  if (source.enabled === false) return [];
  const entries = Array.isArray(source.tracked_companies) ? source.tracked_companies : [];
  const perCompanyLimit = Math.max(1, Math.ceil(limit / Math.max(entries.length, 1)));
  const out = [];
  for (const entry of entries) {
    out.push(...(await fetchAtsEntry(entry)).slice(0, perCompanyLimit));
  }
  return uniqueBy(out, (job) => job.url).slice(0, limit);
}

function addSeenUrl(seen, url, source) {
  if (!url) return;
  seen.urls.add(url);
  if (!seen.urlSources.has(url)) seen.urlSources.set(url, []);
  seen.urlSources.get(url).push(source);
}

function addSeenCompanyRole(seen, company, role, source) {
  const normalizedCompany = cleanText(company).toLowerCase();
  const normalizedRole = cleanText(role).toLowerCase();
  if (!normalizedCompany || !normalizedRole) return;
  const key = `${normalizedCompany}::${normalizedRole}`;
  seen.companyRoles.add(key);
  if (!seen.companyRoleSources.has(key)) seen.companyRoleSources.set(key, []);
  seen.companyRoleSources.get(key).push(source);
}

export function loadSeen({ historyPath = HISTORY_PATH, applicationsPath = "applications.md" } = {}) {
  const seen = {
    urls: new Set(),
    companyRoles: new Set(),
    urlSources: new Map(),
    companyRoleSources: new Map(),
  };

  if (existsSync(historyPath)) {
    const lines = readFileSync(historyPath, "utf8").split(/\r?\n/).slice(1);
    for (const line of lines) {
      const [url] = line.split("\t");
      addSeenUrl(seen, url, "history");
    }
  }

  if (existsSync(applicationsPath)) {
    const text = readFileSync(applicationsPath, "utf8");
    const unprocessed = text.match(/## Unprocessed URLs([\s\S]*?)(?:\n## |\n$)/)?.[1] || "";
    const processed = text.match(/## Processed Applications([\s\S]*?)(?:\n## |\n$)/)?.[1] || "";
    for (const match of unprocessed.matchAll(/-\s*(https?:\/\/[^\s|)]+)\s*\|\s*(yes|no)\b/gi)) {
      addSeenUrl(seen, match[1], "applications.md unprocessed");
    }
    for (const match of processed.matchAll(MARKDOWN_URL_RE)) {
      addSeenUrl(seen, match[0], "applications.md processed");
    }
    for (const row of text.matchAll(/\|\s*\[[ x]\]\s*\|\s*([^|]+)\|\s*([^|]+)\|/g)) {
      addSeenCompanyRole(seen, row[1], row[2], "applications.md processed");
    }
  }

  return seen;
}

export function rankLead(lead, config) {
  const title = buildKeywordFilter(config.title_filter)(lead.title);
  const location = buildLocationFilter(config.location_filter)(lead.location);
  const seniority = (config.seniority_preference || []).filter((keyword) =>
    String(lead.title || "").toLowerCase().includes(String(keyword).toLowerCase()),
  );
  const reasons = [];
  const weakSignals = [];

  if (title.positives.length > 0) reasons.push(`title: ${title.positives.join(", ")}`);
  if (seniority.length > 0) reasons.push(`seniority: ${seniority.join(", ")}`);
  if (location.allowed.length > 0) reasons.push(`location: ${location.allowed.join(", ")}`);
  if (lead.sourceQuery) reasons.push(`query: ${lead.sourceQuery}`);
  if (title.negatives.length > 0) weakSignals.push(`blocked title: ${title.negatives.join(", ")}`);
  if (location.blocked.length > 0) weakSignals.push(`blocked location: ${location.blocked.join(", ")}`);
  if (title.positives.length === 0) weakSignals.push("no positive title keyword");
  if (!location.passes) weakSignals.push("location outside target");

  const rejected = title.negatives.length > 0 || !location.passes;
  const high = !rejected && title.positives.length > 0 && (seniority.length > 0 || location.allowed.length > 0);

  return {
    ...lead,
    bucket: rejected ? "Rejected" : high ? "High Fit" : "Maybe",
    matchReasons: reasons,
    weakSignals,
    nextAction: rejected ? "skip" : "process URL manually",
  };
}

export function filterDedupAndRank(leads, config, seen) {
  const unique = uniqueBy(leads, (lead) => lead.url);
  return unique.map((lead) => {
    const key = `${String(lead.company || "").toLowerCase()}::${String(lead.title || "").toLowerCase()}`;
    if (seen.urls.has(lead.url) || seen.companyRoles.has(key)) {
      const duplicateSources = [
        ...(seen.urlSources?.get(lead.url) || []),
        ...(seen.companyRoleSources?.get(key) || []),
      ];
      return {
        ...rankLead(lead, config),
        bucket: "Rejected",
        duplicate: true,
        duplicateSources,
        weakSignals: [
          `duplicate from ${duplicateSources.length > 0 ? [...new Set(duplicateSources)].join(", ") : "history or applications"}`,
        ],
        nextAction: "skip",
      };
    }
    return rankLead(lead, config);
  });
}

function markdownLink(url) {
  return url ? `[open](${url})` : "";
}

export function renderReport(leads, { date = new Date().toISOString().slice(0, 10), manualSources = [] } = {}) {
  const buckets = ["High Fit", "Maybe", "Rejected"];
  const lines = [
    `# Job Discovery Report - ${date}`,
    "",
    "Manual review only. No applications were submitted, no forms were filled, and `applications.md` was not changed.",
    "",
  ];

  for (const bucket of buckets) {
    const items = leads.filter((lead) => lead.bucket === bucket);
    lines.push(`## ${bucket}`, "");
    if (items.length === 0) {
      lines.push("- None", "");
      continue;
    }
    for (const lead of items) {
      lines.push(`### ${lead.company || "Unknown company"} - ${lead.title || "Unknown role"}`);
      lines.push("");
      lines.push(`- URL: ${markdownLink(lead.url)}`);
      lines.push(`- Location: ${lead.location || "Unknown"}`);
      lines.push(`- Source: ${lead.source || "Unknown"}`);
      lines.push(`- Deadline: ${lead.deadline || "Unknown"}`);
      lines.push(`- Safe automatic refresh: ${lead.supportsSafeAutoRefresh ? "yes" : "no"}`);
      lines.push(`- Matched signals: ${lead.matchReasons?.length ? lead.matchReasons.join("; ") : "none"}`);
      lines.push(`- Weak or blocked signals: ${lead.weakSignals?.length ? lead.weakSignals.join("; ") : "none"}`);
      lines.push(`- Next action: ${lead.nextAction}`);
      lines.push("");
    }
  }

  if (manualSources.length > 0) {
    lines.push("## Manual Restricted Sources", "");
    for (const url of manualSources) {
      lines.push(`- ${url}`);
    }
    lines.push("");
  }

  return `${lines.join("\n").trim()}\n`;
}

export function appendHistory(leads, { historyPath = HISTORY_PATH, date = new Date().toISOString().slice(0, 10) } = {}) {
  mkdirSync(path.dirname(historyPath), { recursive: true });
  if (!existsSync(historyPath)) {
    writeFileSync(historyPath, "url\tfirst_seen\tsource\ttitle\tcompany\tstatus\tlocation\n", "utf8");
  }
  const lines = leads
    .filter((lead) => !lead.duplicate)
    .map((lead) =>
      [
        lead.url,
        date,
        lead.source,
        lead.title,
        lead.company,
        lead.bucket === "Rejected" ? "skipped" : "reported",
        lead.location,
      ]
        .map((value) => cleanText(value).replace(/\t/g, " "))
        .join("\t"),
    )
    .join("\n");
  if (lines) appendFileSync(historyPath, `${lines}\n`, "utf8");
}

function discoveryStats(ranked) {
  return {
    high: ranked.filter((lead) => lead.bucket === "High Fit").length,
    maybe: ranked.filter((lead) => lead.bucket === "Maybe").length,
    rejected: ranked.filter((lead) => lead.bucket === "Rejected").length,
    duplicates: ranked.filter((lead) => lead.duplicate).length,
    saved: ranked.filter((lead) => !lead.duplicate).length,
  };
}

function writeReport(markdown, { reportsDir = REPORTS_DIR, date = new Date().toISOString().slice(0, 10) } = {}) {
  mkdirSync(reportsDir, { recursive: true });
  const reportPath = path.join(reportsDir, `${date}.md`);
  writeFileSync(reportPath, markdown, "utf8");
  return reportPath;
}

function parseArgs(argv) {
  const args = { dryRun: false, source: "all", limit: DEFAULT_LIMIT, configPath: DEFAULT_CONFIG_PATH };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--source") args.source = argv[++i] || args.source;
    else if (arg === "--limit") args.limit = Number(argv[++i] || DEFAULT_LIMIT);
    else if (arg === "--config") args.configPath = argv[++i] || args.configPath;
  }
  return args;
}

async function runCli() {
  const args = parseArgs(process.argv.slice(2));
  const config = parseSimpleYaml(readFileSync(args.configPath, "utf8"));
  const date = new Date().toISOString().slice(0, 10);
  const leads = [];
  const errors = [];

  if ((args.source === "all" || args.source === "platsbanken") && config.sources?.platsbanken?.enabled !== false) {
    try {
      leads.push(...(await fetchPlatsbankenJobs(config, { limit: args.limit })));
    } catch (error) {
      errors.push(`platsbanken: ${error.message}`);
    }
  }

  if ((args.source === "all" || args.source === "ats") && config.sources?.ats?.enabled !== false) {
    try {
      leads.push(...(await fetchAtsJobs(config, { limit: args.limit })));
    } catch (error) {
      errors.push(`ats: ${error.message}`);
    }
  }

  const seen = loadSeen();
  const ranked = filterDedupAndRank(leads, config, seen);
  const manualSources =
    config.sources?.restricted_boards?.enabled === true ? config.sources.restricted_boards.manual_links || [] : [];
  const report = renderReport(ranked, { date, manualSources });

  if (!args.dryRun) {
    appendHistory(ranked, { date });
    const reportPath = writeReport(report, { date });
    console.log(`Report written: ${reportPath}`);
    console.log(`History updated: ${HISTORY_PATH}`);
  } else {
    console.log(report);
  }

  const stats = discoveryStats(ranked);
  console.log(
    `Summary: ${stats.high} high fit, ${stats.maybe} maybe, ${stats.rejected} rejected, ${stats.duplicates} duplicates, ${stats.saved} new reportable`,
  );
  if (errors.length > 0) {
    console.log("Errors:");
    for (const error of errors) console.log(`- ${error}`);
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  runCli().catch((error) => {
    console.error(`Fatal: ${error.message}`);
    process.exit(1);
  });
}
