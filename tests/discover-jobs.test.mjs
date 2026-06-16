import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  appendHistory,
  buildKeywordFilter,
  buildLocationFilter,
  filterDedupAndRank,
  loadSeen,
  parseTeamtailorRss,
  parseSimpleYaml,
  renderReport,
} from "../scripts/discover-jobs.mjs";

const fixtureConfig = parseSimpleYaml(`
seniority_preference:
  - Junior
title_filter:
  positive:
    - software developer
    - medtech
  negative:
    - sales
location_filter:
  allow:
    - Sweden
    - Malmö
  block:
    - United States
sources:
  platsbanken:
    enabled: true
    queries:
      - software developer
`);

test("parseSimpleYaml parses nested maps and lists", () => {
  assert.equal(fixtureConfig.sources.platsbanken.enabled, true);
  assert.deepEqual(fixtureConfig.sources.platsbanken.queries, ["software developer"]);
});

test("parseSimpleYaml parses list maps with continuation fields", () => {
  const config = parseSimpleYaml(`
sources:
  ats:
    tracked_companies:
      - name: Example AB
        provider: greenhouse
        careers_url: https://job-boards.eu.greenhouse.io/example
`);

  assert.deepEqual(config.sources.ats.tracked_companies[0], {
    name: "Example AB",
    provider: "greenhouse",
    careers_url: "https://job-boards.eu.greenhouse.io/example",
  });
});

test("parseSimpleYaml parses company notes without affecting provider fields", () => {
  const config = parseSimpleYaml(`
sources:
  ats:
    tracked_companies:
      - name: Neko Health
        provider: ashby
        careers_url: https://jobs.ashbyhq.com/neko-health
        location_note: Stockholm HQ and hardware development.
        company_note: Preventative healthcare scans.
        fit_note: Strong fit for firmware/software.
`);

  assert.equal(config.sources.ats.tracked_companies[0].provider, "ashby");
  assert.match(config.sources.ats.tracked_companies[0].company_note, /Preventative/);
});

test("keyword filter returns positive and negative matches", () => {
  const filter = buildKeywordFilter(fixtureConfig.title_filter);
  assert.deepEqual(filter("Junior Software Developer").positives, ["software developer"]);
  assert.equal(filter("Sales Engineer").passes, false);
});

test("location filter blocks outside target locations", () => {
  const filter = buildLocationFilter(fixtureConfig.location_filter);
  assert.equal(filter("Malmö").passes, true);
  assert.equal(filter("United States").passes, false);
});

test("filterDedupAndRank ranks high fit and rejects duplicates", () => {
  const ranked = filterDedupAndRank(
    [
      {
        title: "Junior Software Developer",
        company: "Example AB",
        location: "Malmö",
        url: "https://example.test/jobs/1",
        source: "fixture",
        supportsSafeAutoRefresh: true,
      },
      {
        title: "Junior Software Developer",
        company: "Duplicate AB",
        location: "Malmö",
        url: "https://example.test/jobs/2",
        source: "fixture",
        supportsSafeAutoRefresh: true,
      },
    ],
    fixtureConfig,
    {
      urls: new Set(["https://example.test/jobs/2"]),
      companyRoles: new Set(),
      urlSources: new Map([["https://example.test/jobs/2", ["history"]]]),
      companyRoleSources: new Map(),
    },
  );

  assert.equal(ranked[0].bucket, "High Fit");
  assert.equal(ranked[0].nextAction, "process URL manually");
  assert.equal(ranked[1].bucket, "Rejected");
  assert.match(ranked[1].weakSignals.join(" "), /duplicate/);
});

test("loadSeen reads unprocessed URLs and processed company-role rows", () => {
  const dir = mkdtempSync(join("/tmp", "discover-seen-"));
  const applicationsPath = join(dir, "applications.md");
  const historyPath = join(dir, "history.tsv");
  writeFileSync(
    applicationsPath,
    `# Applications

## Unprocessed URLs

- https://example.test/unprocessed | yes

## Processed Applications

| Applied | Company | Role | URL | Language | Folder | Notes |
|---|---|---|---|---|---|---|
| [x] | Example AB | Junior Software Developer | \`https://example.test/processed\` | Swedish | \`applications/example/\` | Done |
`,
  );
  writeFileSync(historyPath, "url\tfirst_seen\tsource\ttitle\tcompany\tstatus\tlocation\nhttps://example.test/history\t2026-06-09\tfixture\tRole\tCompany\treported\tStockholm\n");

  const seen = loadSeen({ historyPath, applicationsPath });
  assert.equal(seen.urls.has("https://example.test/unprocessed"), true);
  assert.equal(seen.urls.has("https://example.test/processed"), true);
  assert.equal(seen.urls.has("https://example.test/history"), true);
  assert.equal(seen.companyRoles.has("example ab::junior software developer"), true);
});

test("appendHistory skips duplicates", () => {
  const dir = mkdtempSync(join("/tmp", "discover-history-"));
  const historyPath = join(dir, "history.tsv");

  appendHistory(
    [
      {
        title: "Junior Software Developer",
        company: "New AB",
        location: "Malmö",
        url: "https://example.test/new",
        source: "fixture",
        bucket: "High Fit",
      },
      {
        title: "Junior Software Developer",
        company: "Old AB",
        location: "Malmö",
        url: "https://example.test/old",
        source: "fixture",
        bucket: "Rejected",
        duplicate: true,
      },
    ],
    { historyPath, date: "2026-06-09" },
  );

  const history = readFileSync(historyPath, "utf8");
  assert.match(history, /https:\/\/example\.test\/new/);
  assert.doesNotMatch(history, /https:\/\/example\.test\/old/);
});

test("parseTeamtailorRss normalizes fixture XML", () => {
  const jobs = parseTeamtailorRss(
    `<?xml version="1.0"?>
<rss><channel><title>Example Careers</title>
<item>
  <title>Junior Platform Engineer</title>
  <link>https://example.test/jobs/123</link>
  <description>&lt;p&gt;Location: Stockholm&lt;/p&gt;</description>
  <tt:location>Stockholm</tt:location>
</item>
</channel></rss>`,
    { name: "Example Health" },
  );

  assert.deepEqual(jobs[0], {
    title: "Junior Platform Engineer",
    company: "Example Health",
    location: "Stockholm",
    url: "https://example.test/jobs/123",
    deadline: "",
    source: "teamtailor-rss",
    supportsSafeAutoRefresh: true,
  });
});

test("parseTeamtailorRss extracts nested Teamtailor location XML", () => {
  const jobs = parseTeamtailorRss(
    `<rss><channel><title>Example Careers</title>
<item>
  <title>Backend Developer</title>
  <link>https://example.test/jobs/456</link>
  <description>&lt;p&gt;Software role&lt;/p&gt;</description>
  <tt:location>
    <tt:name>Stockholm office</tt:name>
    <tt:city>Stockholm</tt:city>
    <tt:country>Sweden</tt:country>
  </tt:location>
</item>
</channel></rss>`,
    { name: "Example Health" },
  );

  assert.equal(jobs[0].location, "Stockholm, Sweden");
});

test("renderReport includes buckets and lead fields", () => {
  const report = renderReport(
    [
      {
        title: "Junior Software Developer",
        company: "Example AB",
        location: "Malmö",
        url: "https://example.test/jobs/1",
        source: "fixture",
        deadline: "2026-07-01",
        supportsSafeAutoRefresh: true,
        bucket: "High Fit",
        matchReasons: ["title: software developer"],
        weakSignals: [],
        nextAction: "process URL manually",
      },
    ],
    { date: "2026-06-09", manualSources: ["https://www.linkedin.com/jobs/search/"] },
  );

  assert.match(report, /## High Fit/);
  assert.match(report, /Example AB - Junior Software Developer/);
  assert.match(report, /Manual Restricted Sources/);
});
