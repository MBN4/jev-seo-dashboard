import "server-only";
import type { EngineAudit, EnginePage, Severity } from "@/types/engine";

/**
 * Extra checks layer.
 *
 * Runs in the dashboard on the page data the audit engine already saved in audit.json, so the
 * engine stays untouched. These checks never change the engine's score; they are reported
 * separately. Each check states its source: a Google Search Central page, or "heuristic" when
 * it is a common SEO-plugin convention that Google does not use directly (e.g. keyword density).
 */

export type ExtraGroup = "keywords" | "urls" | "eeat" | "schema" | "links" | "content" | "images" | "social";

export interface ExtraFinding {
  id: string;
  group: ExtraGroup;
  severity: Severity;
  title: string;
  fix: string;
  /** Google documentation URL, or null for heuristics */
  source: string | null;
  heuristic: boolean;
  urls: string[];
  count: number;
  evidence: string;
}

export interface ExtraCheckDef {
  id: string;
  group: ExtraGroup;
  severity: Severity;
  title: string;
  fix: string;
  source: string | null;
  heuristic: boolean;
  needsKeywords?: boolean;
}

const G = {
  title: "https://developers.google.com/search/docs/appearance/title-link",
  snippet: "https://developers.google.com/search/docs/appearance/snippet",
  url: "https://developers.google.com/search/docs/crawling-indexing/url-structure",
  helpful: "https://developers.google.com/search/docs/fundamentals/creating-helpful-content",
  spam: "https://developers.google.com/search/docs/essentials/spam-policies#keyword-stuffing",
  breadcrumb: "https://developers.google.com/search/docs/appearance/structured-data/breadcrumb",
  article: "https://developers.google.com/search/docs/appearance/structured-data/article",
  org: "https://developers.google.com/search/docs/appearance/structured-data/organization",
  links: "https://developers.google.com/search/docs/crawling-indexing/links-crawlable",
  lazy: "https://developers.google.com/search/docs/crawling-indexing/javascript/lazy-loading",
  dates: "https://developers.google.com/search/docs/appearance/publication-dates",
  starter: "https://developers.google.com/search/docs/fundamentals/seo-starter-guide",
  x: "https://developer.x.com/en/docs/x-for-websites/cards/overview/abouts-cards",
};

export const EXTRA_CHECKS: ExtraCheckDef[] = [
  // Focus keywords (Rank Math style; need keywords)
  { id: "kw_no_page", group: "keywords", severity: "high", title: "No page mentions this focus keyword", fix: "Create a page for the keyword (or add it to the closest existing page) with the keyword in its title, H1 and URL.", source: G.helpful, heuristic: true, needsKeywords: true },
  { id: "kw_title", group: "keywords", severity: "medium", title: "Focus keyword missing from the page title", fix: "Name the topic in the title in the words searchers use, near the start.", source: G.title, heuristic: false, needsKeywords: true },
  { id: "kw_h1", group: "keywords", severity: "medium", title: "Focus keyword missing from the H1", fix: "Make the main heading say what the page is about using the keyword or a close variant.", source: G.starter, heuristic: true, needsKeywords: true },
  { id: "kw_url", group: "keywords", severity: "low", title: "Focus keyword missing from the URL", fix: "Use a short, descriptive slug that contains the keyword (only for new pages; do not change live URLs without a redirect).", source: G.url, heuristic: true, needsKeywords: true },
  { id: "kw_meta", group: "keywords", severity: "low", title: "Focus keyword missing from the meta description", fix: "Write a specific summary that mentions the keyword; Google may show it as the snippet.", source: G.snippet, heuristic: true, needsKeywords: true },
  { id: "kw_intro", group: "keywords", severity: "low", title: "Focus keyword not in the opening text", fix: "Mention the topic in the first paragraph so readers know they are in the right place.", source: null, heuristic: true, needsKeywords: true },
  { id: "kw_density_high", group: "keywords", severity: "medium", title: "Focus keyword repeated too often (possible stuffing)", fix: "Write naturally; replace repetitions with synonyms and useful detail. Keyword stuffing is against Google's spam policies.", source: G.spam, heuristic: true, needsKeywords: true },
  { id: "kw_thin", group: "keywords", severity: "low", title: "Keyword target page has little content", fix: "Cover the topic fully: questions, specifics, examples. Length itself is not a ranking factor; completeness is.", source: G.helpful, heuristic: true, needsKeywords: true },
  // Without keywords
  { id: "title_h1_mismatch", group: "keywords", severity: "low", title: "Title and H1 describe different topics", fix: "Align the title and the main heading so both name the page's topic.", source: G.title, heuristic: true },
  { id: "keyword_stuffing", group: "content", severity: "low", title: "One word dominates the text (possible keyword stuffing)", fix: "Rewrite repetitive passages naturally. Repeating keywords unnaturally is a spam signal.", source: G.spam, heuristic: true },
  // URLs
  { id: "url_uppercase", group: "urls", severity: "low", title: "URLs with uppercase letters", fix: "Use lowercase URLs and redirect old variants; URLs are case-sensitive and can create duplicates.", source: G.url, heuristic: false },
  { id: "url_underscores", group: "urls", severity: "low", title: "URLs use underscores instead of hyphens", fix: "Google recommends hyphens to separate words in URLs.", source: G.url, heuristic: false },
  { id: "url_long", group: "urls", severity: "low", title: "Very long URLs", fix: "Keep URLs short and readable; remove dates, IDs and filler words from new slugs.", source: G.url, heuristic: true },
  { id: "url_params", group: "urls", severity: "low", title: "Indexable URLs with query parameters", fix: "Prefer clean paths; canonicalise parameter variants to the clean URL.", source: G.url, heuristic: false },
  // E-E-A-T and trust
  { id: "eeat_about", group: "eeat", severity: "medium", title: "No About page found", fix: "Publish an About page (who you are, history, team, credentials) and link it from the navigation or footer.", source: G.helpful, heuristic: true },
  { id: "eeat_contact", group: "eeat", severity: "medium", title: "No Contact page found", fix: "Publish a Contact page with real contact details and link it site-wide.", source: G.helpful, heuristic: true },
  { id: "eeat_contact_details", group: "eeat", severity: "low", title: "No email, phone or address visible", fix: "Show at least one direct contact method (email, phone or address) on the homepage or Contact page.", source: G.helpful, heuristic: true },
  { id: "eeat_privacy", group: "eeat", severity: "low", title: "No privacy policy found", fix: "Publish a privacy policy and link it from the footer.", source: null, heuristic: true },
  { id: "eeat_terms", group: "eeat", severity: "info", title: "No terms page found", fix: "Publish terms of service if you sell or offer accounts.", source: null, heuristic: true },
  { id: "eeat_author", group: "eeat", severity: "medium", title: "Articles without a visible or structured author", fix: "Add a byline linking to an author page, and an author property in Article structured data.", source: G.helpful, heuristic: false },
  { id: "eeat_dates", group: "eeat", severity: "low", title: "Articles without a publish or update date", fix: "Show the date visibly and add datePublished / dateModified to Article structured data.", source: G.dates, heuristic: false },
  { id: "eeat_org_schema", group: "eeat", severity: "low", title: "No Organization structured data", fix: "Add Organization (or LocalBusiness) JSON-LD on the homepage with name, logo, url and contact point.", source: G.org, heuristic: false },
  { id: "eeat_sameas", group: "eeat", severity: "low", title: "Organization markup without sameAs profiles", fix: "Add sameAs links to your official social and business profiles so Google can connect your entity.", source: G.org, heuristic: false },
  // Schema coverage
  { id: "schema_breadcrumb", group: "schema", severity: "low", title: "Deeper pages without BreadcrumbList markup", fix: "Add BreadcrumbList JSON-LD (and visible breadcrumbs) on pages below the top level.", source: G.breadcrumb, heuristic: false },
  { id: "schema_article", group: "schema", severity: "low", title: "Articles without Article markup", fix: "Add Article or BlogPosting JSON-LD with headline, author, image and dates.", source: G.article, heuristic: false },
  // Links
  { id: "links_internal_low", group: "links", severity: "low", title: "Pages with very few internal links", fix: "Link to related pages with descriptive anchors so visitors and crawlers can continue.", source: G.links, heuristic: true },
  { id: "links_weak_inlinks", group: "links", severity: "low", title: "Pages linked from only one other page", fix: "Add contextual links to important pages from related content.", source: G.links, heuristic: true },
  { id: "links_no_outbound", group: "links", severity: "info", title: "Articles that cite no external sources", fix: "Link to authoritative sources that support your claims; it helps readers trust the content.", source: G.helpful, heuristic: true },
  // Content
  { id: "readability_hard", group: "content", severity: "low", title: "Text that is hard to read", fix: "Shorten sentences and paragraphs and prefer common words. (Readability is not a ranking factor; it affects whether visitors stay.)", source: null, heuristic: true },
  // Images
  { id: "images_lazy", group: "images", severity: "low", title: "Image-heavy pages without lazy loading", fix: "Add loading=\"lazy\" to images below the first screen (never to the main above-the-fold image).", source: G.lazy, heuristic: false },
  // Social
  { id: "social_twitter_card", group: "social", severity: "info", title: "No X (Twitter) card markup", fix: "Add twitter:card (summary_large_image) so shared links show a preview.", source: G.x, heuristic: true },
];

/** Things users often expect but that cannot be checked from the data the engine saves. */
export const NOT_CHECKABLE: Array<{ topic: string; why: string }> = [
  { topic: "Image formats and file sizes (WebP/AVIF)", why: "The engine records image counts, not image files; PageSpeed opportunities cover this when a key is set." },
  { topic: "Keyword in image alt text", why: "Alt text values are not saved, only whether alt is missing." },
  { topic: "Compression and cache headers", why: "Only security headers are saved from responses." },
  { topic: "Content freshness (how old dates are)", why: "Structured data dates are saved as present/absent, not their values." },
  { topic: "Intrusive pop-ups, ads above the fold, hidden text, cloaking", why: "Needs a rendered visual check and comparison with what Googlebot sees." },
  { topic: "Real rankings, clicks, impressions, indexing status", why: "Needs Google Search Console (or DataForSEO for rankings)." },
  { topic: "Backlink quality and brand mentions", why: "Needs DataForSEO full mode." },
  { topic: "Google Business Profile, reviews, NAP consistency", why: "External listings are not crawled." },
];

// ------------------------------------------------------------------ text helpers

const STOP = new Set(
  "a an and are as at be by for from has have how in is it its of on or our that the this to was we what when where which who will with you your i me my us they them their he she his her not no can do does".split(" "),
);

export function normalize(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function tokens(s: string | null | undefined): string[] {
  return normalize(s).split(" ").filter((t) => t && !STOP.has(t));
}

/** Light English stemming so "jobs" matches "job" and "services" matches "service". */
function stem(w: string): string {
  if (w.length <= 3 || /\d/.test(w)) return w;
  if (w.endsWith("ies") && w.length > 4) return `${w.slice(0, -3)}y`;
  if (/(ches|shes|sses|xes|zes)$/.test(w)) return w.slice(0, -2);
  if (w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us") && !w.endsWith("is")) return w.slice(0, -1);
  return w;
}

function stemmed(s: string | null | undefined): string {
  return normalize(s)
    .split(" ")
    .filter(Boolean)
    .map(stem)
    .join(" ");
}

/** Whole-phrase match on normalized, lightly stemmed text (word boundaries). */
export function containsPhrase(text: string | null | undefined, phrase: string): boolean {
  const t = ` ${stemmed(text)} `;
  const p = stemmed(phrase);
  return p.length > 0 && t.includes(` ${p} `);
}

function countPhrase(text: string, phrase: string): number {
  const t = ` ${stemmed(text)} `;
  const p = ` ${stemmed(phrase)} `;
  if (p.trim() === "") return 0;
  let n = 0;
  let i = t.indexOf(p);
  while (i !== -1) {
    n++;
    i = t.indexOf(p, i + p.length - 1);
  }
  return n;
}

function slugText(url: string): string {
  try {
    return normalize(decodeURIComponent(new URL(url).pathname).replace(/[-_/.]+/g, " "));
  } catch {
    return "";
  }
}

function words(text: string): string[] {
  return normalize(text).split(" ").filter(Boolean);
}

function syllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length <= 3) return 1;
  const m = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "").match(/[aeiouy]{1,2}/g);
  return Math.max(1, m ? m.length : 1);
}

/** Flesch Reading Ease (English). Higher is easier; below 30 is "very difficult". */
export function fleschReadingEase(text: string): number | null {
  const sentences = text.split(/[.!?]+(?:\s|$)/).filter((s) => s.trim().split(/\s+/).length >= 3);
  const w = text.split(/\s+/).filter((x) => /[a-z]/i.test(x));
  if (sentences.length < 3 || w.length < 100) return null;
  const syl = w.reduce((a, x) => a + syllables(x), 0);
  return Math.round(206.835 - 1.015 * (w.length / sentences.length) - 84.6 * (syl / w.length));
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function segments(url: string): string[] {
  return pathOf(url).split("/").filter(Boolean);
}

function hasType(p: EnginePage, re: RegExp): boolean {
  return (p.schema_types ?? []).some((t) => re.test(t));
}

function nodesWith(p: EnginePage, typeRe: RegExp) {
  return (p.schema_nodes ?? []).filter((n) => n.types.some((t) => typeRe.test(t)));
}

const ARTICLE_TYPE = /^(Article|BlogPosting|NewsArticle|TechArticle|Report|ScholarlyArticle)$/;
const ARTICLE_PATH = /\/(blog|news|articles?|insights?|posts?|guides?|stories|journal|magazine|resources)\/[^/]+/i;

export function isArticle(p: EnginePage): boolean {
  if (hasType(p, ARTICLE_TYPE)) return true;
  return ARTICLE_PATH.test(pathOf(p.url)) && (p.word_count ?? 0) >= 250;
}

function htmlPages(a: EngineAudit): EnginePage[] {
  return a.pages.filter((p) => p.status === 200 && (p.kind ?? "page") === "page");
}

function indexable(p: EnginePage): boolean {
  const robots = `${p.meta_robots ?? ""} ${p.x_robots ?? ""}`.toLowerCase();
  if (robots.includes("noindex")) return false;
  if (p.canonical && p.canonical.replace(/\/$/, "") !== (p.final_url ?? p.url).replace(/\/$/, "")) return false;
  return true;
}

// ------------------------------------------------------------------ keyword report

export interface KeywordRow {
  keyword: string;
  targetUrl: string | null;
  targetTitle: string | null;
  checks: Record<"title" | "h1" | "url" | "meta" | "intro", boolean> | null;
  occurrences: number | null;
  densityPct: number | null;
  wordCount: number | null;
}

function pageKeywordScore(p: EnginePage, kw: string): number {
  let s = 0;
  if (containsPhrase(p.title, kw)) s += 3;
  if ((p.h1 ?? []).some((h) => containsPhrase(h, kw))) s += 3;
  if (containsPhrase(slugText(p.url), kw)) s += 2;
  if (containsPhrase(p.meta_description, kw)) s += 1;
  s += Math.min(countPhrase(p.text_excerpt ?? "", kw), 5) * 0.2;
  return s;
}

function keywordReport(pages: EnginePage[], keywords: string[]): KeywordRow[] {
  return keywords.map((keyword) => {
    let best: EnginePage | null = null;
    let bestScore = 0;
    for (const p of pages) {
      const sc = pageKeywordScore(p, keyword);
      if (sc > bestScore || (sc === bestScore && sc > 0 && best && (p.depth ?? 99) < (best.depth ?? 99))) {
        best = p;
        bestScore = sc;
      }
    }
    // Any mention counts: a page that only mentions the keyword in its text is the best candidate to optimise.
    if (!best || bestScore <= 0) {
      return { keyword, targetUrl: null, targetTitle: null, checks: null, occurrences: null, densityPct: null, wordCount: null };
    }
    const text = best.text_excerpt ?? "";
    const w = words(text);
    const occ = countPhrase(text, keyword);
    const kwLen = Math.max(1, normalize(keyword).split(" ").length);
    const intro = w.slice(0, 100).join(" ");
    return {
      keyword,
      targetUrl: best.url,
      targetTitle: best.title ?? null,
      checks: {
        title: containsPhrase(best.title, keyword),
        h1: (best.h1 ?? []).some((h) => containsPhrase(h, keyword)),
        url: containsPhrase(slugText(best.url), keyword) || normalize(keyword).split(" ").every((t) => slugText(best!.url).split(" ").includes(t)),
        meta: containsPhrase(best.meta_description, keyword),
        intro: containsPhrase(intro, keyword),
      },
      occurrences: occ,
      densityPct: w.length ? Math.round(((occ * kwLen) / w.length) * 1000) / 10 : null,
      wordCount: best.word_count ?? w.length,
    };
  });
}

// ------------------------------------------------------------------ main

export interface ExtraResult {
  findings: ExtraFinding[];
  passed: string[];
  skipped: Array<{ id: string; reason: string }>;
  keywords: string[];
  keywordReport: KeywordRow[];
  readability: Array<{ url: string; score: number }>;
  notCheckable: typeof NOT_CHECKABLE;
  checksTotal: number;
}

const SEV_ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];

const memo = new WeakMap<EngineAudit, Map<string, ExtraResult>>();

/** Cached per parsed audit and keyword set (the parsed audit is itself cached per file version). */
export function runExtraChecks(audit: EngineAudit, keywordsIn: string[] = []): ExtraResult {
  const key = keywordsIn.map((k) => k.trim().toLowerCase()).sort().join("\u0000");
  let byKey = memo.get(audit);
  if (!byKey) memo.set(audit, (byKey = new Map()));
  const hit = byKey.get(key);
  if (hit) return hit;
  const result = computeExtraChecks(audit, keywordsIn);
  byKey.set(key, result);
  return result;
}

function computeExtraChecks(audit: EngineAudit, keywordsIn: string[] = []): ExtraResult {
  const keywords = [...new Set(keywordsIn.map((k) => k.trim()).filter(Boolean))].slice(0, 10);
  const all = htmlPages(audit);
  const pages = all.filter(indexable);
  const home = all.find((p) => p.url === audit.site.final_url) ?? all[0];
  const hits = new Map<string, { urls: Set<string>; evidence: string[] }>();
  const add = (id: string, url: string, evidence?: string) => {
    const h = hits.get(id) ?? { urls: new Set<string>(), evidence: [] };
    h.urls.add(url);
    if (evidence && h.evidence.length < 6) h.evidence.push(evidence);
    hits.set(id, h);
  };
  const skipped: ExtraResult["skipped"] = [];
  const readability: ExtraResult["readability"] = [];

  // ---- keywords
  const kwRows = keywordReport(pages, keywords);
  if (!keywords.length) {
    for (const c of EXTRA_CHECKS.filter((c) => c.needsKeywords)) skipped.push({ id: c.id, reason: "No focus keywords set for this audit." });
  } else {
    for (const r of kwRows) {
      if (!r.targetUrl || !r.checks) {
        add("kw_no_page", audit.site.final_url, `"${r.keyword}": no crawled page mentions it in its title, H1, URL or text`);
        continue;
      }
      const map: Array<[keyof NonNullable<KeywordRow["checks"]>, string]> = [["title", "kw_title"], ["h1", "kw_h1"], ["url", "kw_url"], ["meta", "kw_meta"], ["intro", "kw_intro"]];
      for (const [k, id] of map) if (!r.checks[k]) add(id, r.targetUrl, `"${r.keyword}" → ${pathOf(r.targetUrl)}`);
      if ((r.densityPct ?? 0) > 3 && (r.occurrences ?? 0) >= 6) add("kw_density_high", r.targetUrl, `"${r.keyword}" ${r.occurrences}× (${r.densityPct}% of words)`);
      if ((r.wordCount ?? 0) < 300) add("kw_thin", r.targetUrl, `"${r.keyword}" target has ${r.wordCount ?? 0} words`);
    }
  }

  for (const p of pages) {
    const path = pathOf(p.url);
    // ---- title vs H1 topic
    const titleCore = (p.title ?? "").split(/\s[|\-–—:·]\s/)[0];
    const tt = new Set(tokens(titleCore));
    const ht = new Set(tokens(p.h1?.[0]));
    if (tt.size >= 2 && ht.size >= 2) {
      const inter = [...tt].filter((x) => ht.has(x)).length;
      const jac = inter / new Set([...tt, ...ht]).size;
      if (jac < 0.15) add("title_h1_mismatch", p.url, `title "${titleCore.slice(0, 60)}" vs H1 "${(p.h1?.[0] ?? "").slice(0, 60)}"`);
    }
    // ---- stuffing (no keyword needed)
    const w = words(p.text_excerpt ?? "").filter((x) => !STOP.has(x) && x.length > 2);
    if (w.length >= 300) {
      const freq = new Map<string, number>();
      for (const x of w) freq.set(x, (freq.get(x) ?? 0) + 1);
      const [topWord, topN] = [...freq.entries()].sort((a, b) => b[1] - a[1])[0];
      const brandTokens = new Set(tokens(audit.site.domain.split(".")[0]));
      if (topN / w.length > 0.07 && !brandTokens.has(topWord)) add("keyword_stuffing", p.url, `"${topWord}" is ${Math.round((topN / w.length) * 100)}% of content words`);
    }
    // ---- URLs
    if (/[A-Z]/.test(path)) add("url_uppercase", p.url, path);
    if (path.includes("_")) add("url_underscores", p.url, path);
    if (p.url.length > 115) add("url_long", p.url, `${p.url.length} characters`);
    try {
      if (new URL(p.url).search) add("url_params", p.url, new URL(p.url).search.slice(0, 60));
    } catch {
      /* ignore */
    }
    // ---- schema coverage
    if (segments(p.url).length >= 2 && !hasType(p, /^BreadcrumbList$/)) add("schema_breadcrumb", p.url, path);
    const article = isArticle(p);
    if (article) {
      if (!hasType(p, ARTICLE_TYPE)) add("schema_article", p.url, path);
      const artNodes = nodesWith(p, ARTICLE_TYPE);
      const hasAuthorSchema = artNodes.some((n) => n.keys.includes("author"));
      const byline = /\b(by|written by|author:?)\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)?/.test((p.text_excerpt ?? "").slice(0, 600));
      if (!hasAuthorSchema && !byline) add("eeat_author", p.url, path);
      const hasDateSchema = artNodes.some((n) => n.keys.includes("datePublished") || n.keys.includes("dateModified"));
      const visibleDate = /\b(19|20)\d{2}-\d{2}-\d{2}\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2},?\s+(19|20)\d{2}\b|\b\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(19|20)\d{2}\b/i.test(
        (p.text_excerpt ?? "").slice(0, 1500),
      );
      if (!hasDateSchema && !visibleDate) add("eeat_dates", p.url, path);
      if ((p.links_external ?? []).length === 0) add("links_no_outbound", p.url, path);
    }
    // ---- links
    const isHome = p.url === home?.url;
    if (!isHome && (p.links_internal ?? []).length < 3) add("links_internal_low", p.url, `${(p.links_internal ?? []).length} internal links`);
    if (!isHome && (p.inlinks ?? 0) === 1 && (p.depth ?? 0) >= 2) add("links_weak_inlinks", p.url, path);
    // ---- images
    const img = p.images;
    if (img && img.total >= 6 && (img.lazy ?? 0) === 0) add("images_lazy", p.url, `${img.total} images, none lazy-loaded`);
    // ---- readability (English pages only)
    if ((p.lang ?? "en").toLowerCase().startsWith("en") && (p.word_count ?? 0) >= 150) {
      const fre = fleschReadingEase(p.text_excerpt ?? "");
      if (fre != null) {
        readability.push({ url: p.url, score: fre });
        if (fre < 30) add("readability_hard", p.url, `Flesch reading ease ${fre}`);
      }
    }
    // ---- social
    if (!p.twitter_card) add("social_twitter_card", p.url, path);
  }

  // ---- site-level E-E-A-T / trust pages
  // Trust pages may live on a sister domain (e.g. policies.example.org), so external links count too.
  const linkPool = all.flatMap((p) => [...(p.links_internal ?? []), ...(p.links_external ?? [])].map((l) => ({ url: l.url, anchor: l.anchor ?? "" })));
  const pageUrls = all.map((p) => ({ url: p.url, anchor: p.title ?? "" }));
  const find = (re: RegExp) => [...pageUrls, ...linkPool].some((l) => re.test(pathOf(l.url)) || re.test(l.anchor));
  if (!find(/\babout(-us)?\b|who-we-are|our-story|\bcompany\b|\bteam\b|about us|who we are/i)) add("eeat_about", audit.site.final_url, "No page or internal link named About, Company, Team or Who we are");
  if (!find(/\bcontact(-us)?\b|get-in-touch|contact us|get in touch/i)) add("eeat_contact", audit.site.final_url, "No page or internal link named Contact or Get in touch");
  if (!find(/privacy/i)) add("eeat_privacy", audit.site.final_url, "No page or internal link mentioning privacy");
  if (!find(/\bterms\b|terms-of|conditions/i)) add("eeat_terms", audit.site.final_url, "No page or internal link mentioning terms");
  const contactPages = all.filter((p) => p.url === home?.url || /contact/i.test(pathOf(p.url)));
  const contactText = contactPages.map((p) => `${p.text_excerpt ?? ""} ${(p.links_internal ?? []).map((l) => l.url).join(" ")} ${(p.links_external ?? []).map((l) => l.url).join(" ")}`).join(" ");
  const hasEmail = /[\w.+-]+@[\w-]+\.[\w.]+/.test(contactText) || /mailto:/i.test(contactText);
  const hasPhone = /(\+?\d[\d\s().-]{7,}\d)/.test(contactText) || /tel:/i.test(contactText);
  const hasAddress = /\b\d{1,5}\s+[A-Z][a-z]+(\s[A-Z][a-z]+)*\s+(street|st|road|rd|avenue|ave|boulevard|blvd|lane|ln|drive|dr|suite)\b/i.test(contactText);
  if (!hasEmail && !hasPhone && !hasAddress) add("eeat_contact_details", contactPages[0]?.url ?? audit.site.final_url, `Checked ${contactPages.length} page(s): homepage and contact pages`);
  const orgNodes = all.flatMap((p) => nodesWith(p, /^(Organization|Corporation|LocalBusiness|ProfessionalService|.*Business|.*Store|Restaurant|NGO|EducationalOrganization)$/));
  if (!orgNodes.length) add("eeat_org_schema", home?.url ?? audit.site.final_url, "No Organization-type JSON-LD on any crawled page");
  else if (!orgNodes.some((n) => n.keys.includes("sameAs"))) add("eeat_sameas", home?.url ?? audit.site.final_url, `${orgNodes.length} Organization node(s), none with sameAs`);

  // ---- assemble
  const defs = new Map(EXTRA_CHECKS.map((c) => [c.id, c]));
  const findings: ExtraFinding[] = [...hits.entries()].map(([id, h]) => {
    const d = defs.get(id)!;
    return {
      id,
      group: d.group,
      severity: d.severity,
      title: d.title,
      fix: d.fix,
      source: d.source,
      heuristic: d.heuristic,
      urls: [...h.urls],
      count: h.urls.size,
      evidence: h.evidence.join("; ") + (h.urls.size > h.evidence.length && h.evidence.length ? ` (+${h.urls.size - h.evidence.length} more)` : ""),
    };
  });
  findings.sort((a, b) => SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity) || b.count - a.count);
  const skippedIds = new Set(skipped.map((s) => s.id));
  const passed = EXTRA_CHECKS.filter((c) => !hits.has(c.id) && !skippedIds.has(c.id)).map((c) => c.id);
  return {
    findings,
    passed,
    skipped,
    keywords,
    keywordReport: kwRows,
    readability: readability.sort((a, b) => a.score - b.score),
    notCheckable: NOT_CHECKABLE,
    checksTotal: EXTRA_CHECKS.length,
  };
}
