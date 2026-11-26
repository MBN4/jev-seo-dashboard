/**
 * Search Console analysis: totals, comparisons, opportunities, indexing summary and alerts.
 * Pure functions over a stored snapshot, so they run the same on the server and in tests.
 * Benchmarks (expected CTR by position) are labelled as estimates wherever they are shown.
 */

export interface MetricRow {
  key: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  prevClicks?: number;
  prevImpressions?: number;
  prevPosition?: number | null;
}

export interface Inspection {
  url: string;
  verdict: string;
  coverageState: string | null;
  indexingState: string | null;
  robotsTxtState: string | null;
  pageFetchState: string | null;
  lastCrawlTime: string | null;
  crawledAs: string | null;
  googleCanonical: string | null;
  userCanonical: string | null;
  inSitemap: boolean;
  referringUrls: number;
  richResults: { verdict: string | null; items: Array<{ type: string; issues: Array<{ message: string; severity: string }> }> } | null;
  link: string | null;
  inspectedAt: string;
  prevVerdict?: string | null;
}

export interface SitemapInfo {
  path: string;
  lastSubmitted: string | null;
  lastDownloaded: string | null;
  isPending: boolean;
  isIndex: boolean;
  errors: number;
  warnings: number;
  submitted: number;
}

export interface RangeData {
  current: { start: string; end: string };
  previous: { start: string; end: string };
  queries: MetricRow[];
  lostQueries: MetricRow[];
  pages: MetricRow[];
  lostPages: MetricRow[];
}

export type Priority = "P0" | "P1" | "P2";

export interface GscAlert {
  id: string;
  priority: Priority;
  owner: "Dev" | "SEO" | "Content";
  title: string;
  detail: string;
  urls: string[];
}

export interface GscSnapshot {
  version: 1;
  domain: string;
  property: string | null;
  fetchedAt: string;
  error: string | null;
  errorAt?: string;
  endDate: string | null;
  daily: MetricRow[];
  ranges: Record<string, RangeData>;
  countries: MetricRow[];
  devices: MetricRow[];
  appearance: MetricRow[];
  searchTypes: MetricRow[];
  queryPages: Array<{ query: string; page: string; clicks: number; impressions: number; position: number }>;
  sitemaps: SitemapInfo[];
  inspections: Record<string, Inspection>;
  alerts: GscAlert[];
}

export interface Totals {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number | null;
}

export function sum(rows: MetricRow[]): Totals {
  const clicks = rows.reduce((a, r) => a + r.clicks, 0);
  const impressions = rows.reduce((a, r) => a + r.impressions, 0);
  const posW = rows.reduce((a, r) => a + r.position * r.impressions, 0);
  return { clicks, impressions, ctr: impressions ? clicks / impressions : 0, position: impressions ? posW / impressions : null };
}

const DAY = 86_400_000;
const d = (s: string) => Date.parse(`${s}T00:00:00Z`);
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

export function periodWindow(snap: GscSnapshot, days: number) {
  if (!snap.endDate) return null;
  const end = d(snap.endDate);
  const start = end - (days - 1) * DAY;
  const pEnd = start - DAY;
  const pStart = pEnd - (days - 1) * DAY;
  return { start: iso(start), end: iso(end), pStart: iso(pStart), pEnd: iso(pEnd) };
}

const between = (rows: MetricRow[], a: string, b: string) => rows.filter((r) => r.key >= a && r.key <= b);

export function kpis(snap: GscSnapshot, days: number) {
  const w = periodWindow(snap, days);
  if (!w) return null;
  const cur = sum(between(snap.daily, w.start, w.end));
  const prev = sum(between(snap.daily, w.pStart, w.pEnd));
  const pct = (a: number, b: number) => (b ? (a - b) / b : null);
  return {
    period: { start: w.start, end: w.end },
    previous: { start: w.pStart, end: w.pEnd },
    current: cur,
    prev,
    change: {
      clicks: pct(cur.clicks, prev.clicks),
      impressions: pct(cur.impressions, prev.impressions),
      ctr: prev.ctr ? cur.ctr - prev.ctr : null,
      /** Negative = moved up (better) */
      position: cur.position != null && prev.position != null ? cur.position - prev.position : null,
    },
  };
}

export function series(snap: GscSnapshot, days: number | "all") {
  if (days === "all" || !snap.endDate) return snap.daily;
  const w = periodWindow(snap, days)!;
  return between(snap.daily, w.start, w.end);
}

/** Rough industry benchmark for organic CTR by position; used only to flag outliers. */
export function expectedCtr(position: number): number {
  const curve = [0.28, 0.15, 0.1, 0.07, 0.05, 0.04, 0.03, 0.025, 0.02, 0.018];
  const p = Math.max(1, Math.round(position));
  return p <= 10 ? curve[p - 1] : 0.01;
}

export function opportunities(snap: GscSnapshot, days: number) {
  const r = snap.ranges[String(days)] ?? snap.ranges["28"];
  if (!r) return null;
  const q = r.queries;
  const striking = q
    .filter((x) => x.position >= 4 && x.position <= 20 && x.impressions >= Math.max(20, days * 2))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 50);
  const lowCtr = [...q.map((x) => ({ ...x, kind: "query" as const })), ...r.pages.map((x) => ({ ...x, kind: "page" as const }))]
    .filter((x) => x.position <= 10 && x.impressions >= Math.max(50, days * 4) && x.ctr < expectedCtr(x.position) * 0.5)
    .map((x) => ({ ...x, expectedCtr: expectedCtr(x.position), missedClicks: Math.round(x.impressions * expectedCtr(x.position) - x.clicks) }))
    .sort((a, b) => b.missedClicks - a.missedClicks)
    .slice(0, 50);
  const delta = (x: MetricRow) => x.clicks - (x.prevClicks ?? 0);
  const losingQueries = [...q, ...r.lostQueries].filter((x) => delta(x) <= -3).sort((a, b) => delta(a) - delta(b)).slice(0, 50);
  const losingPages = [...r.pages, ...r.lostPages].filter((x) => delta(x) <= -3).sort((a, b) => delta(a) - delta(b)).slice(0, 50);
  const risingQueries = q.filter((x) => delta(x) >= 3).sort((a, b) => delta(b) - delta(a)).slice(0, 50);
  const newQueries = q.filter((x) => !x.prevImpressions && x.impressions >= Math.max(10, days)).sort((a, b) => b.impressions - a.impressions).slice(0, 50);

  // Keyword cannibalisation: several pages share a query's impressions (last 28 days)
  const byQuery = new Map<string, Array<{ page: string; clicks: number; impressions: number; position: number }>>();
  for (const x of snap.queryPages) (byQuery.get(x.query) ?? byQuery.set(x.query, []).get(x.query)!).push(x);
  const cannibal = [...byQuery.entries()]
    .map(([query, pages]) => {
      const total = pages.reduce((a, p) => a + p.impressions, 0);
      const strong = pages.filter((p) => p.impressions >= total * 0.15).sort((a, b) => b.impressions - a.impressions);
      return { query, total, pages: strong };
    })
    .filter((x) => x.total >= 50 && x.pages.length >= 2)
    .sort((a, b) => b.total - a.total)
    .slice(0, 30);
  return { striking, lowCtr, losingQueries, losingPages, risingQueries, newQueries, cannibal };
}

const COVERAGE_HELP: Record<string, string> = {
  "Submitted and indexed": "In Google.",
  "Indexed, not submitted in sitemap": "In Google, but missing from your sitemap.",
  "Crawled - currently not indexed": "Google read the page and chose not to index it. Usually a quality or duplication signal: improve the content or merge it.",
  "Discovered - currently not indexed": "Google knows the URL but has not crawled it yet. Link to it more and keep it in the sitemap.",
  "Duplicate without user-selected canonical": "Google treats it as a copy of another page. Add a canonical or make the page distinct.",
  "Duplicate, Google chose different canonical than user": "Google ignored your canonical and picked another page.",
  "Alternate page with proper canonical tag": "A deliberate duplicate pointing to its main version. Fine.",
  "Excluded by 'noindex' tag": "The page asks not to be indexed.",
  "Blocked by robots.txt": "robots.txt stops Google from crawling it.",
  "Not found (404)": "The page returns 404.",
  "Page with redirect": "The URL redirects; the target is what gets indexed.",
  "Soft 404": "Google thinks the page is an empty or error page.",
  "Server error (5xx)": "The server failed when Google crawled it.",
  "URL is unknown to Google": "Google has never seen this URL.",
};
export const coverageHelp = (s: string | null) => (s ? (COVERAGE_HELP[s] ?? null) : null);

const norm = (u: string | null) => (u ?? "").replace(/\/$/, "").toLowerCase();

export function indexing(snap: GscSnapshot) {
  const list = Object.values(snap.inspections).sort((a, b) => Number(a.verdict === "PASS") - Number(b.verdict === "PASS") || a.url.localeCompare(b.url));
  const indexed = list.filter((i) => i.verdict === "PASS");
  const notIndexed = list.filter((i) => i.verdict !== "PASS");
  const byState = new Map<string, number>();
  for (const i of list) byState.set(i.coverageState ?? "Unknown", (byState.get(i.coverageState ?? "Unknown") ?? 0) + 1);
  const canonicalMismatch = list.filter((i) => i.googleCanonical && i.userCanonical && norm(i.googleCanonical) !== norm(i.userCanonical));
  const dropped = list.filter((i) => i.prevVerdict === "PASS" && i.verdict !== "PASS");
  const recovered = list.filter((i) => i.prevVerdict && i.prevVerdict !== "PASS" && i.verdict === "PASS");
  const richIssues = list.filter((i) => i.richResults?.items.some((x) => x.issues.some((y) => /error/i.test(y.severity))));
  const staleCrawl = indexed.filter((i) => i.lastCrawlTime && Date.parse(snap.fetchedAt) - Date.parse(i.lastCrawlTime) > 60 * DAY);
  return {
    inspected: list.length,
    indexed: indexed.length,
    notIndexed: notIndexed.length,
    states: [...byState.entries()].map(([state, count]) => ({ state, count, help: coverageHelp(state) })).sort((a, b) => b.count - a.count),
    canonicalMismatch,
    dropped,
    recovered,
    richIssues,
    staleCrawl,
    list,
  };
}

/** Problems worth a task, each with a stable ID so monitoring reports it once. */
export function computeAlerts(snap: GscSnapshot): GscAlert[] {
  const out: GscAlert[] = [];
  const k7 = kpis(snap, 7);
  if (k7 && k7.prev.clicks >= 50 && k7.change.clicks != null && k7.change.clicks <= -0.2) {
    const pct = Math.round(-k7.change.clicks * 100);
    out.push({
      id: `gsc_clicks_drop:${k7.period.end}`,
      priority: pct >= 50 ? "P0" : "P1",
      owner: "SEO",
      title: `Search clicks down ${pct}% this week`,
      detail: `${k7.current.clicks.toLocaleString()} clicks in the last 7 days, against ${k7.prev.clicks.toLocaleString()} the 7 days before. Check the losing pages and queries in Search Console.`,
      urls: [],
    });
  }
  if (k7 && k7.prev.impressions >= 500 && k7.change.impressions != null && k7.change.impressions <= -0.3) {
    out.push({
      id: `gsc_impressions_drop:${k7.period.end}`,
      priority: "P1",
      owner: "SEO",
      title: `Search impressions down ${Math.round(-k7.change.impressions * 100)}% this week`,
      detail: "Fewer searches are showing your pages. This often comes before a fall in clicks.",
      urls: [],
    });
  }
  const ix = indexing(snap);
  if (ix.dropped.length)
    out.push({
      id: `gsc_deindexed:${ix.dropped.map((i) => i.url).sort().join("|")}`,
      priority: "P0",
      owner: "SEO",
      title: `${ix.dropped.length} page${ix.dropped.length === 1 ? "" : "s"} dropped out of Google's index`,
      detail: ix.dropped.map((i) => `${i.url}: ${i.coverageState ?? i.verdict}`).join("; "),
      urls: ix.dropped.map((i) => i.url),
    });
  const homeOrTop = ix.list.filter((i) => i.verdict !== "PASS" && !ix.dropped.includes(i));
  if (homeOrTop.length)
    out.push({
      id: `gsc_not_indexed:${homeOrTop.map((i) => i.url).sort().join("|")}`,
      priority: "P1",
      owner: "SEO",
      title: `${homeOrTop.length} important page${homeOrTop.length === 1 ? " is" : "s are"} not indexed`,
      detail: homeOrTop.map((i) => `${i.url}: ${i.coverageState ?? i.verdict}`).join("; "),
      urls: homeOrTop.map((i) => i.url),
    });
  const smErr = snap.sitemaps.filter((s) => s.errors > 0);
  if (smErr.length)
    out.push({
      id: `gsc_sitemap_errors:${smErr.map((s) => `${s.path}#${s.errors}`).join("|")}`,
      priority: "P1",
      owner: "Dev",
      title: `Sitemap errors in Search Console (${smErr.reduce((a, s) => a + s.errors, 0)})`,
      detail: smErr.map((s) => `${s.path}: ${s.errors} error(s)`).join("; "),
      urls: smErr.map((s) => s.path),
    });
  if (ix.canonicalMismatch.length)
    out.push({
      id: `gsc_canonical_mismatch:${ix.canonicalMismatch.map((i) => i.url).sort().join("|")}`,
      priority: "P2",
      owner: "SEO",
      title: `Google chose a different canonical on ${ix.canonicalMismatch.length} page${ix.canonicalMismatch.length === 1 ? "" : "s"}`,
      detail: ix.canonicalMismatch.map((i) => `${i.url} → Google uses ${i.googleCanonical}`).join("; "),
      urls: ix.canonicalMismatch.map((i) => i.url),
    });
  if (ix.richIssues.length)
    out.push({
      id: `gsc_rich_errors:${ix.richIssues.map((i) => i.url).sort().join("|")}`,
      priority: "P2",
      owner: "Dev",
      title: `Rich result errors on ${ix.richIssues.length} page${ix.richIssues.length === 1 ? "" : "s"}`,
      detail: "Structured data on these pages has errors that stop rich results. Open them in the URL Inspection tool.",
      urls: ix.richIssues.map((i) => i.url),
    });
  return out;
}
