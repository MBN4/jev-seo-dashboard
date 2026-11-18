import "server-only";
import { loadAudit } from "./audits";
import { readState, type RecommendationState } from "./state";
import type { EngineAudit, EngineFinding, EnginePage, JevAnswer, JevQuestion, PsiRun, Severity } from "@/types/engine";
import type { Paginated } from "@/types/api";

/**
 * Read-only projections of one audit.json for the UI. Each endpoint returns only what its
 * view needs, paginated where the data can be large. No values are invented: missing data
 * stays null and the UI says so.
 */

export const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];

function paginate<T>(items: T[], page: number, pageSize: number): Paginated<T> {
  const size = Math.min(Math.max(1, pageSize || 25), 200);
  const p = Math.max(1, page || 1);
  return { items: items.slice((p - 1) * size, p * size), total: items.length, page: p, pageSize: size };
}

export function requireAudit(id: string): EngineAudit {
  const a = loadAudit(id);
  if (!a) throw Object.assign(new Error("Audit results not found."), { status: 404 });
  return a;
}

// ---------------------------------------------------------------- overview

export function overview(id: string) {
  const a = requireAudit(id);
  const bySeverity = Object.fromEntries(SEVERITY_ORDER.map((s) => [s, 0])) as Record<Severity, number>;
  const byCategory: Record<string, { total: number } & Record<Severity, number>> = {};
  for (const f of a.findings) {
    bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;
    const c = (byCategory[f.category] ??= { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 });
    c.total++;
    c[f.severity]++;
  }
  const statusBuckets: Record<string, number> = {};
  for (const p of a.pages) {
    const k = p.status == null ? "error" : `${Math.floor(p.status / 100)}xx`;
    statusBuckets[k] = (statusBuckets[k] ?? 0) + 1;
  }
  const top = [...a.actions].sort((x, y) => x.priority.localeCompare(y.priority) || y.impact - x.impact).slice(0, 6);
  return {
    site: {
      domain: a.site.domain,
      inputUrl: a.site.input_url,
      finalUrl: a.site.final_url,
      https: a.site.https ?? null,
      robotsPresent: a.site.robots?.present ?? null,
      sitemapUrls: a.site.sitemaps?.total_urls ?? null,
      sitemapFiles: a.site.sitemaps?.files?.length ?? 0,
      requests: a.site.requests ?? null,
      limits: a.site.limits ?? null,
      render: a.site.render ?? null,
      aiBots: a.site.robots?.ai_bots ?? {},
      searchBots: a.site.robots?.search_bots ?? {},
      llmsTxt: (a.site.probes as Record<string, unknown> | undefined)?.llms_txt ?? null,
    },
    run: { startedAt: a.run.started_at, finishedAt: a.run.finished_at, rescoredAt: a.run.rescored_at ?? null, timings: a.run.timings_s ?? {}, engineVersion: a.tool?.version },
    scores: a.scores,
    counts: {
      pages: a.pages.length,
      htmlPages: a.pages.filter((p) => p.kind === "page" && p.status === 200).length,
      findings: a.findings.length,
      actions: a.actions.length,
      passedRules: a.passed_rules.length,
      quickWins: a.actions.filter((x) => x.quick_win).length,
    },
    bySeverity,
    byCategory: Object.entries(byCategory).map(([key, v]) => ({ key, name: a.scores.category_names?.[key] ?? key, ...v })),
    statusBuckets,
    topActions: top,
    jev: { available: Boolean(a.jev?.available), skipped: a.jev?.skipped ?? null, judged: Object.values(a.jev?.pages ?? {}).filter(Boolean).length, notJudged: a.jev?.not_judged?.length ?? 0, cost: (a.jev?.ledger as Record<string, unknown>)?.cost_usd ?? null },
    psi: a.performance ? { runs: a.performance.runs.length, ok: a.performance.runs.filter((r) => !r.error).length, keyed: a.performance.keyed } : null,
    dataforseo: a.dataforseo ? { available: Boolean((a.dataforseo as Record<string, unknown>).available) } : null,
  };
}

// ---------------------------------------------------------------- findings

export interface FindingQuery {
  severity?: string[];
  category?: string[];
  origin?: string[];
  q?: string;
  sort?: "severity" | "count" | "title" | "category";
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export function findings(id: string, query: FindingQuery) {
  const a = requireAudit(id);
  let items = a.findings.map((f, index) => ({ ...f, key: `${f.id}`, index, categoryName: a.scores.category_names?.[f.category] ?? f.category }));
  if (query.severity?.length) items = items.filter((f) => query.severity!.includes(f.severity));
  if (query.category?.length) items = items.filter((f) => query.category!.includes(f.category));
  if (query.origin?.length) items = items.filter((f) => query.origin!.includes(f.origin));
  if (query.q) {
    const q = query.q.toLowerCase();
    items = items.filter((f) => [f.title, f.evidence, f.fix, f.id, ...f.urls.slice(0, 50)].some((s) => s?.toLowerCase().includes(q)));
  }
  const dir = query.dir === "asc" ? 1 : -1;
  const sev = (s: string) => SEVERITY_ORDER.length - SEVERITY_ORDER.indexOf(s as Severity);
  const sorters: Record<string, (x: EngineFinding, y: EngineFinding) => number> = {
    severity: (x, y) => sev(x.severity) - sev(y.severity) || x.count - y.count,
    count: (x, y) => x.count - y.count,
    title: (x, y) => y.title.localeCompare(x.title),
    category: (x, y) => y.category.localeCompare(x.category),
  };
  items.sort((x, y) => dir * (sorters[query.sort ?? "severity"] ?? sorters.severity)(x, y));
  const facets = {
    severity: Object.fromEntries(SEVERITY_ORDER.map((s) => [s, a.findings.filter((f) => f.severity === s).length])),
    category: Object.entries(
      a.findings.reduce<Record<string, number>>((acc, f) => ((acc[f.category] = (acc[f.category] ?? 0) + 1), acc), {}),
    ).map(([key, count]) => ({ key, name: a.scores.category_names?.[key] ?? key, count })),
    origin: [...new Set(a.findings.map((f) => f.origin))],
  };
  // Trim URL lists in list view; the detail drawer requests the full finding.
  const result = paginate(items, query.page ?? 1, query.pageSize ?? 25);
  return { ...result, items: result.items.map((f) => ({ ...f, urls: f.urls.slice(0, 5), urlCount: f.urls.length, detail: undefined })), facets, passedRules: a.passed_rules };
}

export function finding(id: string, findingId: string) {
  const a = requireAudit(id);
  const f = a.findings.find((x) => x.id === findingId);
  if (!f) return null;
  const action = a.actions.find((x) => x.id === findingId) ?? null;
  return { ...f, categoryName: a.scores.category_names?.[f.category] ?? f.category, action };
}

// ---------------------------------------------------------------- pages

export interface PageRow {
  url: string;
  status: number | null;
  error: string | null;
  kind: string | null;
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  h1: string | null;
  h1Count: number;
  wordCount: number | null;
  indexable: boolean | null;
  indexabilityNote: string | null;
  depth: number | null;
  inlinks: number | null;
  internalLinks: number | null;
  externalLinks: number | null;
  issueCount: number;
  inSitemap: boolean | null;
  ttfbMs: number | null;
  rendered: boolean;
  jevJudged: boolean;
}

function indexability(p: EnginePage): { ok: boolean | null; note: string | null } {
  if (p.status == null) return { ok: null, note: p.error ?? "Not fetched" };
  if (p.status !== 200) return { ok: false, note: `HTTP ${p.status}` };
  if (p.kind && p.kind !== "page") return { ok: null, note: `Not an HTML page (${p.kind})` };
  const robots = `${p.meta_robots ?? ""} ${p.x_robots ?? ""}`.toLowerCase();
  if (robots.includes("noindex")) return { ok: false, note: "noindex" };
  const norm = (u: string) => u.replace(/\/$/, "");
  if (p.canonical && norm(p.canonical) !== norm(p.final_url ?? p.url)) return { ok: false, note: "Canonicalised elsewhere" };
  return { ok: true, note: null };
}

function issueIndex(a: EngineAudit): Map<string, number> {
  const m = new Map<string, number>();
  for (const f of a.findings) for (const u of f.urls) m.set(u, (m.get(u) ?? 0) + 1);
  return m;
}

export interface PageQuery {
  q?: string;
  status?: string; // "2xx" | "3xx" | "4xx" | "5xx" | "error"
  indexable?: "yes" | "no";
  issues?: "with" | "without";
  sort?: keyof PageRow;
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export function pages(id: string, query: PageQuery) {
  const a = requireAudit(id);
  const issues = issueIndex(a);
  const judged = a.jev?.pages ?? {};
  let rows: PageRow[] = a.pages.map((p) => {
    const ix = indexability(p);
    return {
      url: p.url,
      status: p.status ?? null,
      error: p.error ?? null,
      kind: p.kind ?? null,
      title: p.title ?? null,
      metaDescription: p.meta_description ?? null,
      canonical: p.canonical ?? null,
      h1: p.h1?.[0] ?? null,
      h1Count: p.h1?.length ?? 0,
      wordCount: p.word_count ?? null,
      indexable: ix.ok,
      indexabilityNote: ix.note,
      depth: p.depth ?? null,
      inlinks: p.inlinks ?? null,
      internalLinks: p.links_internal ? p.links_internal.length : null,
      externalLinks: p.links_external ? p.links_external.length : null,
      issueCount: issues.get(p.url) ?? 0,
      inSitemap: p.in_sitemap ?? null,
      ttfbMs: p.ttfb_ms ?? null,
      rendered: Boolean(p.rendered),
      jevJudged: Boolean(judged[p.url]),
    };
  });
  if (query.q) {
    const q = query.q.toLowerCase();
    rows = rows.filter((r) => [r.url, r.title, r.h1, r.metaDescription].some((s) => s?.toLowerCase().includes(q)));
  }
  if (query.status) rows = rows.filter((r) => (r.status == null ? "error" : `${Math.floor(r.status / 100)}xx`) === query.status);
  if (query.indexable) rows = rows.filter((r) => r.indexable === (query.indexable === "yes"));
  if (query.issues) rows = rows.filter((r) => (query.issues === "with" ? r.issueCount > 0 : r.issueCount === 0));
  const key = query.sort ?? "depth";
  const dir = query.dir === "desc" ? -1 : 1;
  rows.sort((x, y) => {
    const a1 = x[key], b1 = y[key];
    if (a1 == null && b1 == null) return 0;
    if (a1 == null) return 1;
    if (b1 == null) return -1;
    return dir * (typeof a1 === "number" && typeof b1 === "number" ? a1 - b1 : String(a1).localeCompare(String(b1)));
  });
  return paginate(rows, query.page ?? 1, query.pageSize ?? 25);
}

export function pageDetail(id: string, url: string) {
  const a = requireAudit(id);
  const p = a.pages.find((x) => x.url === url);
  if (!p) return null;
  const related = a.findings
    .filter((f) => f.urls.includes(url))
    .map((f) => ({ id: f.id, title: f.title, severity: f.severity, category: f.category, origin: f.origin, fix: f.fix, evidence: f.evidence }));
  const jev = a.jev?.pages?.[url] ?? null;
  const ix = indexability(p);
  return {
    url: p.url,
    finalUrl: p.final_url ?? p.url,
    status: p.status ?? null,
    error: p.error ?? null,
    kind: p.kind ?? null,
    fetchedAt: p.fetched_at ?? null,
    ttfbMs: p.ttfb_ms ?? null,
    bytes: p.bytes ?? null,
    contentType: p.content_type ?? null,
    redirectChain: p.redirect_chain ?? [],
    rendered: Boolean(p.rendered),
    jsDependent: Boolean(p.js_dependent),
    depth: p.depth ?? null,
    inlinks: p.inlinks ?? null,
    inSitemap: p.in_sitemap ?? null,
    indexable: ix.ok,
    indexabilityNote: ix.note,
    meta: {
      title: p.title ?? null,
      titleLength: p.title?.length ?? null,
      titleCount: p.title_count ?? null,
      description: p.meta_description ?? null,
      descriptionLength: p.meta_description?.length ?? null,
      canonical: p.canonical ?? null,
      robots: p.meta_robots ?? null,
      xRobots: p.x_robots ?? null,
      lang: p.lang ?? null,
      viewport: p.viewport ?? null,
      og: p.og ?? {},
      twitterCard: p.twitter_card ?? null,
      hreflang: p.hreflang ?? [],
    },
    headings: { h1: p.h1 ?? [], outline: p.outline ?? [], skips: p.heading_skips ?? 0 },
    content: {
      wordCount: p.word_count ?? null,
      rawWordCount: p.raw_word_count ?? null,
      excerpt: (p.text_excerpt ?? "").slice(0, 1200),
      callsToAction: p.calls_to_action ?? [],
      images: p.images ?? null,
    },
    links: {
      internal: (p.links_internal ?? []).slice(0, 200),
      internalTotal: p.links_internal?.length ?? 0,
      external: (p.links_external ?? []).slice(0, 200),
      externalTotal: p.links_external?.length ?? 0,
      nofollow: p.nofollow_links ?? 0,
      linkStatus: Object.fromEntries((p.links_internal ?? []).slice(0, 200).map((l) => [l.url, a.site.link_status?.[l.url] ?? null])),
    },
    structured: { types: p.schema_types ?? [], errors: p.schema_errors ?? [] },
    mixedContent: p.mixed_content ?? [],
    findings: related,
    jev,
  };
}

// ---------------------------------------------------------------- Jev AI content

const DIMENSION_LABELS: Record<string, string> = {
  page_type: "Page type",
  intent: "Search intent",
  importance: "Business importance",
  action: "Recommended handling",
  helpfulness: "Helpfulness",
  specificity: "Specificity",
  answer_first: "Answers first",
  citable: "Citability",
  trust: "Trustworthiness",
  clear_next_step: "Clear next step",
  title_fit: "Title relevance",
  h1_fit: "H1 relevance",
  meta_fit: "Meta description relevance",
  value_prop: "Value proposition",
  entity_clarity: "Entity clarity",
  topical_focus: "Topical focus",
  business_model: "Business model",
  serves_local_area: "Serves a local area",
};

export function dimensionLabel(key: string) {
  return DIMENSION_LABELS[key] ?? key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export function aiContent(id: string) {
  const a = requireAudit(id);
  const j = a.jev;
  const pages = Object.entries(j?.pages ?? {});
  const dims = new Set<string>();
  for (const [, ans] of pages) if (ans) Object.keys(ans).forEach((k) => dims.add(k));
  const questions: Record<string, JevQuestion> = { ...(j?.questions?.site ?? {}), ...(j?.questions?.page_example ?? {}) };
  const jevFindings = a.findings.filter((f) => f.origin === "jev");
  const titles = new Map(a.pages.map((p) => [p.url, p.title ?? null]));
  return {
    available: Boolean(j?.available),
    skipped: j?.skipped ?? null,
    ledger: j?.ledger ?? {},
    site: j?.site ? Object.entries(j.site).map(([key, ans]) => ({ key, label: dimensionLabel(key), answer: ans as JevAnswer, question: questions[key] ?? null })) : [],
    dimensions: [...dims].map((key) => ({ key, label: dimensionLabel(key), question: questions[key] ?? null })),
    pages: pages.map(([url, ans]) => ({
      url,
      title: titles.get(url) ?? null,
      judged: Boolean(ans),
      answers: ans ?? {},
      findings: jevFindings.filter((f) => f.urls.includes(url)).map((f) => ({ id: f.id, title: f.title, severity: f.severity, fix: f.fix, evidence: f.evidence })),
    })),
    notJudged: j?.not_judged ?? [],
    pairs: (j?.pairs ?? []).filter((p) => p.judgment),
    findings: jevFindings,
    contentScore: a.scores.categories?.content ?? null,
    contentNote: a.scores.notes?.content ?? null,
  };
}

// ---------------------------------------------------------------- performance

export function performance(id: string) {
  const a = requireAudit(id);
  const perf = a.performance;
  const opts = (a.run.options ?? {}) as Record<string, unknown>;
  const classify = (r: PsiRun) => {
    if (!r.error) return "ok";
    if (/429/.test(r.error)) return "rate_limited";
    return "failed";
  };
  return {
    skipped: !perf,
    skippedReason: !perf ? (opts.no_psi ? "PageSpeed was turned off for this audit." : "No PageSpeed data in this audit.") : null,
    keyed: perf?.keyed ?? null,
    source: perf?.source ?? null,
    runs: (perf?.runs ?? []).map((r) => ({ ...r, outcome: classify(r) })),
    score: a.scores.categories?.performance ?? null,
    note: a.scores.notes?.performance ?? null,
    perfFindings: a.findings.filter((f) => f.category === "performance"),
    ttfb: a.pages
      .filter((p) => p.ttfb_ms != null && p.kind === "page")
      .map((p) => ({ url: p.url, ttfbMs: p.ttfb_ms as number }))
      .sort((x, y) => y.ttfbMs - x.ttfbMs)
      .slice(0, 10),
  };
}

// ---------------------------------------------------------------- recommendations

export function recommendations(id: string) {
  const a = requireAudit(id);
  const state = readState().recommendations[id] ?? {};
  const seen = new Map<string, number>();
  return a.actions.map((x) => {
    // Finding ids are unique per audit in practice; suffix defensively if not.
    const n = (seen.get(x.id) ?? 0) + 1;
    seen.set(x.id, n);
    const key = n === 1 ? x.id : `${x.id}~${n}`;
    const s: RecommendationState | undefined = state[key];
    return {
      key,
      actionId: x.action_id,
      priority: x.priority,
      impact: x.impact,
      effort: x.effort,
      quickWin: x.quick_win,
      importance: x.importance,
      origin: x.origin,
      category: x.category,
      categoryName: a.scores.category_names?.[x.category] ?? x.category,
      severity: x.severity,
      title: x.title,
      fix: x.fix,
      source: x.source ?? null,
      evidence: x.evidence,
      count: x.count,
      urls: x.urls,
      needsReview: x.needs_review,
      heuristic: Boolean(x.heuristic),
      status: s?.status ?? "pending",
      notes: s?.notes ?? "",
      updatedAt: (s?.updatedAt ?? null) as string | null,
    };
  });
}

// ---------------------------------------------------------------- score history

export function scoreHistory(summaries: Array<{ id: string; domain: string; finishedAt: string | null; score: number | null; grade: string | null; status: string }>, domain?: string) {
  return summaries
    .filter((s) => s.status === "completed" && s.score != null && (!domain || s.domain === domain))
    .map((s) => ({ id: s.id, domain: s.domain, date: s.finishedAt, score: s.score as number, grade: s.grade }))
    .sort((x, y) => String(x.date).localeCompare(String(y.date)));
}
