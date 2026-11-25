import "server-only";
import { requireAudit } from "./results";
import type { EngineAudit, EnginePage } from "@/types/engine";

/**
 * Site Explorer: a spreadsheet-style, "what's missing" view of every crawled URL, organised in
 * tabs (response codes, titles, meta descriptions, headings, images, canonicals, directives,
 * links, structured data, content, security, hreflang, social) with filters such as Missing,
 * Duplicate, Too long and Too short. Built only from the crawl data in audit.json.
 */

export type FilterKind = "issue" | "warning" | "opportunity" | "info";
export type ColType = "url" | "text" | "num" | "bool" | "status" | "list";

export interface Column {
  key: string;
  label: string;
  type: ColType;
}

interface FilterDef {
  key: string;
  label: string;
  kind: FilterKind;
  /** Google-facing explanation shown on hover / in the issues list */
  help: string;
  test: (r: Row) => boolean;
}

interface TabDef {
  key: string;
  label: string;
  /** Which rows the tab lists */
  scope: (r: Row) => boolean;
  columns: Column[];
  filters: FilterDef[];
}

export type Row = Record<string, string | number | boolean | null | string[]> & { url: string };

const LIMITS = { titleMax: 60, titleMin: 30, metaMax: 155, metaMin: 70, h1Max: 70, h2Max: 70, lowWords: 200, manyLinks: 100 };

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

function buildRows(a: EngineAudit): Row[] {
  const html = (p: EnginePage) => p.status === 200 && (p.kind ?? "page") === "page";
  const count = (vals: string[]) => vals.reduce((m, v) => (v ? m.set(v, (m.get(v) ?? 0) + 1) : m), new Map<string, number>());
  const pages = a.pages;
  const htmlPages = pages.filter(html);
  const titleDup = count(htmlPages.map((p) => norm(p.title)));
  const metaDup = count(htmlPages.map((p) => norm(p.meta_description)));
  const h1Dup = count(htmlPages.map((p) => norm(p.h1?.[0])));
  const h2Dup = count(htmlPages.map((p) => norm(p.h2?.[0])));
  const hashDup = count(htmlPages.map((p) => String(p.text_hash ?? "")));
  const linkStatus = a.site.link_status ?? {};
  const usesHreflang = htmlPages.some((p) => (p.hreflang ?? []).length);

  return pages.map((p) => {
    const isHtml = html(p);
    const final = p.final_url ?? p.url;
    const canonical = p.canonical ?? null;
    const robots = `${p.meta_robots ?? ""} ${p.x_robots ?? ""}`.toLowerCase();
    const canonStatus = canonical ? (linkStatus[canonical] ?? null) : null;
    const brokenOut = (p.links_internal ?? []).filter((l) => (linkStatus[l.url] ?? 0) >= 400).length;
    const chain = (p.redirect_chain as Array<{ url: string; status: number }> | undefined) ?? [];
    const hdrs = (p.headers as Record<string, string> | undefined) ?? {};
    const og = p.og ?? {};
    const title = p.title ?? null;
    const meta = p.meta_description ?? null;
    const h1 = p.h1?.[0] ?? null;
    const h2 = p.h2?.[0] ?? null;
    const status = p.status ?? null;
    return {
      url: p.url,
      html: isHtml,
      kind: p.kind ?? null,
      status,
      statusClass: status == null ? "none" : `${Math.floor(status / 100)}xx`,
      error: p.error ?? null,
      blocked: (p.error ?? "").includes("robots"),
      redirectTo: chain.length ? final : null,
      redirectHops: chain.length,
      indexable: isHtml && !robots.includes("noindex") && (!canonical || canonical.replace(/\/$/, "") === final.replace(/\/$/, "")),
      depth: p.depth ?? null,
      inlinks: p.inlinks ?? null,
      title,
      titleLen: title?.length ?? 0,
      titleCount: p.title_count ?? (title ? 1 : 0),
      titleDup: title ? (titleDup.get(norm(title)) ?? 0) > 1 : false,
      titleSameAsH1: Boolean(title && h1 && norm(title) === norm(h1)),
      meta,
      metaLen: meta?.length ?? 0,
      metaDup: meta ? (metaDup.get(norm(meta)) ?? 0) > 1 : false,
      h1,
      h1Len: h1?.length ?? 0,
      h1Count: p.h1?.length ?? 0,
      h1Dup: h1 ? (h1Dup.get(norm(h1)) ?? 0) > 1 : false,
      h2,
      h2Len: h2?.length ?? 0,
      h2Count: p.h2?.length ?? 0,
      h2Dup: h2 ? (h2Dup.get(norm(h2)) ?? 0) > 1 : false,
      headingSkips: p.heading_skips ?? 0,
      images: p.images?.total ?? 0,
      imagesNoAlt: p.images?.missing_alt ?? 0,
      imagesNoSize: p.images?.no_dimensions ?? 0,
      imagesLazy: p.images?.lazy ?? 0,
      altSamples: p.images?.missing_alt_samples ?? [],
      canonical,
      canonicalStatus: canonStatus,
      canonicalSelf: Boolean(canonical && canonical.replace(/\/$/, "") === final.replace(/\/$/, "")),
      metaRobots: p.meta_robots ?? null,
      xRobots: (p.x_robots as string | null) ?? null,
      noindex: robots.includes("noindex"),
      nofollow: robots.includes("nofollow"),
      internalOut: (p.links_internal ?? []).length,
      externalOut: (p.links_external ?? []).length,
      nofollowLinks: p.nofollow_links ?? 0,
      brokenOut,
      schemaTypes: (p.schema_types ?? []).filter((t) => !t.startsWith("microdata:")),
      schemaErrors: (p.schema_errors ?? []).length,
      words: p.word_count ?? null,
      duplicateText: isHtml && Boolean(p.text_hash) && (hashDup.get(String(p.text_hash)) ?? 0) > 1,
      ttfb: p.ttfb_ms ?? null,
      sizeKb: p.bytes != null ? Math.round(Number(p.bytes) / 1024) : null,
      https: p.url.startsWith("https://"),
      hsts: Boolean(hdrs["strict-transport-security"]),
      mixed: (p.mixed_content ?? []).length,
      hreflang: (p.hreflang as Array<{ lang: string }> | undefined)?.map((h) => h.lang) ?? [],
      usesHreflangSite: usesHreflang,
      ogTitle: og.title ?? null,
      ogImage: og.image ?? null,
      twitterCard: p.twitter_card ?? null,
      inSitemap: p.in_sitemap ?? null,
    } as Row;
  });
}

const C = (key: string, label: string, type: ColType = "text"): Column => ({ key, label, type });
const URL_COL = C("url", "Address", "url");
const html = (r: Row) => r.html === true;
const f = (key: string, label: string, kind: FilterKind, help: string, test: (r: Row) => boolean): FilterDef => ({ key, label, kind, help, test });

export const TABS: TabDef[] = [
  {
    key: "internal",
    label: "Internal",
    scope: () => true,
    columns: [URL_COL, C("status", "Status", "status"), C("kind", "Type"), C("indexable", "Indexable", "bool"), C("title", "Title"), C("words", "Words", "num"), C("depth", "Depth", "num"), C("inlinks", "Inlinks", "num"), C("ttfb", "Response ms", "num"), C("sizeKb", "Size KB", "num")],
    filters: [
      f("html", "HTML pages", "info", "Pages returning HTML with status 200.", html),
      f("indexable", "Indexable", "info", "HTML pages Google may index.", (r) => r.indexable === true),
      f("non_indexable", "Non-indexable", "warning", "Not indexable: noindex, canonicalised elsewhere, redirect or error.", (r) => r.indexable === false),
      f("not_in_sitemap", "Indexable, not in sitemap", "opportunity", "Indexable pages missing from the XML sitemap.", (r) => r.indexable === true && r.inSitemap === false),
    ],
  },
  {
    key: "response",
    label: "Response codes",
    scope: () => true,
    columns: [URL_COL, C("status", "Status", "status"), C("redirectTo", "Redirects to", "url"), C("redirectHops", "Hops", "num"), C("error", "Error"), C("inlinks", "Inlinks", "num")],
    filters: [
      f("2xx", "Success (2xx)", "info", "Pages that load.", (r) => r.statusClass === "2xx"),
      f("3xx", "Redirection (3xx)", "warning", "URLs that redirect; link to the final URL instead.", (r) => r.statusClass === "3xx"),
      f("chain", "Redirect chains", "issue", "More than one hop before the final page.", (r) => Number(r.redirectHops) > 1),
      f("4xx", "Client error (4xx)", "issue", "Broken pages (e.g. 404). Fix or redirect them and update links.", (r) => r.statusClass === "4xx"),
      f("5xx", "Server error (5xx)", "issue", "The server failed. Google retries, then drops the page.", (r) => r.statusClass === "5xx"),
      f("blocked", "Blocked by robots.txt", "warning", "Google is not allowed to crawl these URLs.", (r) => r.blocked === true),
      f("none", "No response", "issue", "Timed out or unreachable.", (r) => r.statusClass === "none" && r.blocked !== true),
    ],
  },
  {
    key: "titles",
    label: "Page titles",
    scope: html,
    columns: [URL_COL, C("title", "Title"), C("titleLen", "Characters", "num"), C("titleCount", "Title tags", "num"), C("h1", "H1")],
    filters: [
      f("missing", "Missing", "issue", "No title: Google will invent one.", (r) => !r.title),
      f("duplicate", "Duplicate", "issue", "The same title on several pages.", (r) => r.titleDup === true),
      f("long", `Over ${LIMITS.titleMax} characters`, "opportunity", "Likely truncated in results.", (r) => Number(r.titleLen) > LIMITS.titleMax),
      f("short", `Below ${LIMITS.titleMin} characters`, "opportunity", "Too short to describe the page well.", (r) => Boolean(r.title) && Number(r.titleLen) < LIMITS.titleMin),
      f("same_h1", "Same as H1", "info", "Title identical to the H1 (fine, but a chance to add context).", (r) => r.titleSameAsH1 === true),
      f("multiple", "Multiple", "issue", "More than one title element.", (r) => Number(r.titleCount) > 1),
    ],
  },
  {
    key: "meta",
    label: "Meta description",
    scope: html,
    columns: [URL_COL, C("meta", "Meta description"), C("metaLen", "Characters", "num")],
    filters: [
      f("missing", "Missing", "issue", "No description: Google picks text from the page.", (r) => !r.meta),
      f("duplicate", "Duplicate", "warning", "The same description on several pages.", (r) => r.metaDup === true),
      f("long", `Over ${LIMITS.metaMax} characters`, "opportunity", "Likely truncated in results.", (r) => Number(r.metaLen) > LIMITS.metaMax),
      f("short", `Below ${LIMITS.metaMin} characters`, "opportunity", "Room to summarise the page better.", (r) => Boolean(r.meta) && Number(r.metaLen) < LIMITS.metaMin),
    ],
  },
  {
    key: "h1",
    label: "H1",
    scope: html,
    columns: [URL_COL, C("h1", "H1"), C("h1Len", "Characters", "num"), C("h1Count", "H1 count", "num")],
    filters: [
      f("missing", "Missing", "issue", "No main heading.", (r) => !r.h1),
      f("duplicate", "Duplicate", "warning", "The same H1 on several pages.", (r) => r.h1Dup === true),
      f("long", `Over ${LIMITS.h1Max} characters`, "opportunity", "Long headings are hard to scan.", (r) => Number(r.h1Len) > LIMITS.h1Max),
      f("multiple", "Multiple", "warning", "More than one H1.", (r) => Number(r.h1Count) > 1),
    ],
  },
  {
    key: "h2",
    label: "H2",
    scope: html,
    columns: [URL_COL, C("h2", "First H2"), C("h2Len", "Characters", "num"), C("h2Count", "H2 count", "num"), C("headingSkips", "Level skips", "num")],
    filters: [
      f("missing", "Missing", "opportunity", "No subheadings to structure the content.", (r) => !r.h2),
      f("duplicate", "Duplicate", "info", "The same first H2 on several pages.", (r) => r.h2Dup === true),
      f("long", `Over ${LIMITS.h2Max} characters`, "opportunity", "Long subheadings are hard to scan.", (r) => Number(r.h2Len) > LIMITS.h2Max),
      f("non_sequential", "Non-sequential", "warning", "Heading levels are skipped (e.g. H2 to H4).", (r) => Number(r.headingSkips) > 0),
    ],
  },
  {
    key: "images",
    label: "Images",
    scope: (r) => html(r) && Number(r.images) > 0,
    columns: [URL_COL, C("images", "Images", "num"), C("imagesNoAlt", "Missing alt", "num"), C("imagesNoSize", "No size", "num"), C("imagesLazy", "Lazy", "num"), C("altSamples", "Images without alt", "list")],
    filters: [
      f("missing_alt", "Missing alt text", "issue", "Google and screen readers cannot understand these images.", (r) => Number(r.imagesNoAlt) > 0),
      f("missing_size", "Missing size attributes", "opportunity", "Width/height prevent layout shift (CLS).", (r) => Number(r.imagesNoSize) > 0),
      f("not_lazy", "Many images, none lazy-loaded", "opportunity", "Lazy-load images below the first screen.", (r) => Number(r.images) >= 6 && Number(r.imagesLazy) === 0),
    ],
  },
  {
    key: "canonicals",
    label: "Canonicals",
    scope: html,
    columns: [URL_COL, C("canonical", "Canonical", "url"), C("canonicalStatus", "Canonical status", "status"), C("indexable", "Indexable", "bool")],
    filters: [
      f("missing", "Missing", "warning", "No canonical declared.", (r) => !r.canonical),
      f("self", "Self-referencing", "info", "Canonical points to the page itself (good).", (r) => r.canonicalSelf === true),
      f("canonicalised", "Canonicalised", "warning", "Canonical points to another URL, so this page is not indexed.", (r) => Boolean(r.canonical) && r.canonicalSelf === false),
      f("non_indexable_target", "Canonical target broken or redirected", "issue", "The canonical points to a URL that is not a live 200 page.", (r) => r.canonicalStatus != null && Number(r.canonicalStatus) !== 200),
    ],
  },
  {
    key: "directives",
    label: "Directives",
    scope: html,
    columns: [URL_COL, C("metaRobots", "Meta robots"), C("xRobots", "X-Robots-Tag"), C("indexable", "Indexable", "bool")],
    filters: [
      f("noindex", "Noindex", "warning", "Excluded from Google's index.", (r) => r.noindex === true),
      f("nofollow", "Nofollow", "warning", "Google is asked not to follow links on the page.", (r) => r.nofollow === true),
      f("none", "No directives", "info", "No robots meta tag or header (defaults to index, follow).", (r) => !r.metaRobots && !r.xRobots),
    ],
  },
  {
    key: "links",
    label: "Links",
    scope: html,
    columns: [URL_COL, C("inlinks", "Inlinks", "num"), C("internalOut", "Internal outlinks", "num"), C("externalOut", "External outlinks", "num"), C("brokenOut", "Broken outlinks", "num"), C("nofollowLinks", "Nofollow links", "num"), C("depth", "Depth", "num")],
    filters: [
      f("broken_out", "Links to broken pages", "issue", "This page links to URLs that return errors.", (r) => Number(r.brokenOut) > 0),
      f("no_inlinks", "No internal inlinks", "issue", "Nothing links here; Google finds it only through the sitemap.", (r) => Number(r.inlinks ?? 0) === 0 && Number(r.depth ?? 0) > 0),
      f("few_inlinks", "Only one inlink", "warning", "Weakly linked pages look unimportant.", (r) => Number(r.inlinks) === 1),
      f("no_outlinks", "No internal outlinks", "warning", "Dead end for visitors and crawlers.", (r) => Number(r.internalOut) === 0),
      f("many_outlinks", `Over ${LIMITS.manyLinks} internal outlinks`, "info", "Very link-heavy pages dilute each link.", (r) => Number(r.internalOut) > LIMITS.manyLinks),
      f("deep", "Deeper than 3 clicks", "warning", "Hard to reach from the homepage.", (r) => Number(r.depth) > 3),
    ],
  },
  {
    key: "structured",
    label: "Structured data",
    scope: html,
    columns: [URL_COL, C("schemaTypes", "Types", "list"), C("schemaErrors", "Parse errors", "num")],
    filters: [
      f("present", "Contains structured data", "info", "Pages with JSON-LD.", (r) => (r.schemaTypes as string[]).length > 0),
      f("missing", "Missing", "opportunity", "No structured data: a chance for rich results.", (r) => (r.schemaTypes as string[]).length === 0),
      f("errors", "Parse errors", "issue", "Broken JSON-LD is ignored by Google.", (r) => Number(r.schemaErrors) > 0),
    ],
  },
  {
    key: "content",
    label: "Content",
    scope: html,
    columns: [URL_COL, C("words", "Words", "num"), C("duplicateText", "Exact duplicate", "bool"), C("title", "Title")],
    filters: [
      f("low", `Low content (under ${LIMITS.lowWords} words)`, "opportunity", "Thin pages rarely satisfy a search.", (r) => Number(r.words ?? 0) < LIMITS.lowWords),
      f("duplicate", "Exact duplicates", "issue", "Identical main text on several URLs.", (r) => r.duplicateText === true),
    ],
  },
  {
    key: "security",
    label: "Security",
    scope: html,
    columns: [URL_COL, C("https", "HTTPS", "bool"), C("hsts", "HSTS", "bool"), C("mixed", "Mixed content", "num")],
    filters: [
      f("http", "HTTP URLs", "issue", "Pages served without HTTPS.", (r) => r.https === false),
      f("mixed", "Mixed content", "issue", "HTTPS pages loading insecure resources.", (r) => Number(r.mixed) > 0),
      f("no_hsts", "Missing HSTS", "warning", "No Strict-Transport-Security header.", (r) => r.https === true && r.hsts === false),
    ],
  },
  {
    key: "hreflang",
    label: "Hreflang",
    scope: html,
    columns: [URL_COL, C("hreflang", "Languages", "list")],
    filters: [
      f("present", "Contains hreflang", "info", "Pages with language alternates.", (r) => (r.hreflang as string[]).length > 0),
      f("missing", "Missing (site uses hreflang)", "warning", "Other pages declare alternates but this one does not.", (r) => r.usesHreflangSite === true && (r.hreflang as string[]).length === 0),
    ],
  },
  {
    key: "social",
    label: "Social",
    scope: html,
    columns: [URL_COL, C("ogTitle", "OG title"), C("ogImage", "OG image", "url"), C("twitterCard", "X card")],
    filters: [
      f("no_og_title", "Missing OG title", "opportunity", "Shared links fall back to page text.", (r) => !r.ogTitle),
      f("no_og_image", "Missing OG image", "opportunity", "Shared links show no image.", (r) => !r.ogImage),
      f("no_twitter", "Missing X card", "info", "No twitter:card tag.", (r) => !r.twitterCard),
    ],
  },
];

const cache = new WeakMap<EngineAudit, Row[]>();
function rowsFor(a: EngineAudit): Row[] {
  let r = cache.get(a);
  if (!r) cache.set(a, (r = buildRows(a)));
  return r;
}

export interface ExplorerOverview {
  totalUrls: number;
  tabs: Array<{ key: string; label: string; count: number; filters: Array<{ key: string; label: string; kind: FilterKind; help: string; count: number }> }>;
  issues: Array<{ tab: string; tabLabel: string; filter: string; label: string; kind: FilterKind; help: string; count: number; share: number }>;
}

export function explorerOverview(id: string): ExplorerOverview {
  const rows = rowsFor(requireAudit(id));
  const tabs = TABS.map((t) => {
    const scoped = rows.filter(t.scope);
    return { key: t.key, label: t.label, count: scoped.length, filters: t.filters.map((fl) => ({ key: fl.key, label: fl.label, kind: fl.kind, help: fl.help, count: scoped.filter(fl.test).length })) };
  });
  const rank: Record<FilterKind, number> = { issue: 0, warning: 1, opportunity: 2, info: 3 };
  const issues = tabs
    .flatMap((t) => t.filters.filter((fl) => fl.kind !== "info" && fl.count > 0).map((fl) => ({ tab: t.key, tabLabel: t.label, filter: fl.key, label: fl.label, kind: fl.kind, help: fl.help, count: fl.count, share: t.count ? Math.round((fl.count / t.count) * 1000) / 10 : 0 })))
    .sort((x, y) => rank[x.kind] - rank[y.kind] || y.count - x.count);
  return { totalUrls: rows.length, tabs, issues };
}

export interface ExplorerQuery {
  tab: string;
  filter?: string;
  q?: string;
  sort?: string;
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export function explorerRows(id: string, query: ExplorerQuery) {
  const tab = TABS.find((t) => t.key === query.tab);
  if (!tab) throw Object.assign(new Error("Unknown explorer tab."), { status: 404 });
  let rows = rowsFor(requireAudit(id)).filter(tab.scope);
  const flt = query.filter ? tab.filters.find((x) => x.key === query.filter) : null;
  if (query.filter && !flt) throw Object.assign(new Error("Unknown filter."), { status: 404 });
  if (flt) rows = rows.filter(flt.test);
  if (query.q) {
    const needle = query.q.toLowerCase();
    rows = rows.filter((r) => tab.columns.some((c) => String(r[c.key] ?? "").toLowerCase().includes(needle)));
  }
  const col = tab.columns.find((c) => c.key === query.sort);
  if (col) {
    const dir = query.dir === "desc" ? -1 : 1;
    rows = [...rows].sort((x, y) => {
      const a = x[col.key], b = y[col.key];
      if (a == null && b == null) return 0;
      if (a == null) return 1;
      if (b == null) return -1;
      if (typeof a === "number" && typeof b === "number") return dir * (a - b);
      return dir * String(a).localeCompare(String(b));
    });
  }
  const total = rows.length;
  const size = Math.min(Math.max(query.pageSize ?? 50, 1), 500);
  const page = Math.max(query.page ?? 1, 1);
  const pick = (r: Row) => Object.fromEntries(tab.columns.map((c) => [c.key, r[c.key] ?? null])) as Row;
  return { tab: tab.key, columns: tab.columns, filter: flt ? { key: flt.key, label: flt.label, help: flt.help, kind: flt.kind } : null, total, page, pageSize: size, rows: rows.slice((page - 1) * size, page * size).map(pick), all: () => rows.map(pick) };
}

/** CSV export of the current tab + filter (all rows, not just one page). */
export function explorerCsv(id: string, query: ExplorerQuery): string {
  const res = explorerRows(id, { ...query, page: 1, pageSize: 500 });
  const esc = (v: unknown) => {
    const s = Array.isArray(v) ? v.join(" | ") : v == null ? "" : String(v);
    // Neutralise spreadsheet formula injection from crawled text.
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const lines = [res.columns.map((c) => esc(c.label)).join(",")];
  for (const r of res.all()) lines.push(res.columns.map((c) => esc(r[c.key])).join(","));
  return lines.join("\n") + "\n";
}
