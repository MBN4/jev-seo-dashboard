import "server-only";
import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { dataDir, maxConcurrentAudits, setting } from "./config";
import { readState, writeAtomic } from "./state";
import { listAudits, loadAudit } from "./audits";
import { runningJobs } from "./jobs";
import { createAudit } from "./audit-service";
import { countSitePages, type HomepageSignals, type SiteSizeDeps } from "./site-size";
import { isConfigured } from "./secrets";
import { diffAudits, diffHeadline, type AuditDiff } from "./audit-diff";
import { SAMPLE_SITES } from "@/lib/brand";
import { findingBreakdown } from "./finding-breakdown";
import { gscCredentialStatus, readSnapshot, syncSite, type GscDeps } from "./gsc";
import { kpis, type GscAlert } from "@/lib/gsc-insights";
import { checkUrlSyntax } from "@/lib/url";
import type { AuditSummary } from "@/types/api";

/**
 * Site monitoring: re-audits each monitored site on a fixed interval (24 h by default), checks
 * the homepage and sitemaps between audits for changes, and records a "what changed" event
 * for every new audit (issues that appeared, got worse, were fixed, and page-level changes).
 *
 * Runs inside the Rankora server process. When Rankora was not running at the due time, the
 * missed audit starts shortly after the next start. Audits use the normal job runner, so the
 * concurrency limit and duplicate checks apply; a manual audit is never interrupted.
 */

export const INTERVALS = [6, 12, 24, 48, 168] as const;
const MAX_PAGES = 2000;
const CHECK_EVERY_H = 3;
/** An audit triggered by a detected change waits at least this long after the previous audit. */
const CHANGE_MIN_GAP_H = 3;
const RETRY_AFTER_H = 1;
const MAX_EVENTS = 300;
const H = 3_600_000;

export interface MonitoredSite {
  url: string;
  domain: string;
  enabled: boolean;
  intervalHours: number;
  /** The four bundled sites cannot be removed, only paused. */
  builtIn: boolean;
  addedAt: string;
  lastAttemptAt: string | null;
  lastAttemptError: string | null;
  lastCheckAt: string | null;
  changeDetectedAt: string | null;
  /** Set by "Run now": due immediately */
  runRequestedAt?: string | null;
  lastReportedAuditId: string | null;
  /** Page count from the last sitemap check, used as the crawl limit */
  pagesCounted: number | null;
  snapshot: { homepage: HomepageSignals; sitemapCount: number; sitemapHash: string } | null;
}

export interface ChangeDetails {
  homepage: Array<{ field: string; before: string | null; after: string | null }>;
  sitemap: { before: number; after: number; added: string[]; removed: string[]; addedCount: number; removedCount: number } | null;
}

export interface MonitorEvent {
  id: string;
  at: string;
  domain: string;
  url: string;
  kind: "baseline" | "audit" | "change" | "error" | "search";
  title: string;
  auditId: string | null;
  prevAuditId: string | null;
  score: number | null;
  grade: string | null;
  diff: AuditDiff | null;
  change: ChangeDetails | null;
  /** Search Console alert (kind "search") */
  search?: GscAlert | null;
  seen: boolean;
}

interface MonitorState {
  version: 1;
  sites: MonitoredSite[];
  events: MonitorEvent[];
  /** IDs of audits started by the scheduler */
  scheduled: string[];
}

const file = () => path.join(dataDir(), "monitor.json");
const urlsFile = (domain: string) => path.join(dataDir(), "monitor", `${domain.replace(/[^a-z0-9.-]/gi, "_")}.sitemap.json`);
export const domainOf = (url: string) => new URL(url).hostname.toLowerCase().replace(/^www\./, "");

function newSite(url: string, builtIn: boolean): MonitoredSite {
  return {
    url, domain: domainOf(url), enabled: true, intervalHours: 24, builtIn, addedAt: new Date().toISOString(),
    lastAttemptAt: null, lastAttemptError: null, lastCheckAt: null, changeDetectedAt: null, lastReportedAuditId: null, pagesCounted: null, snapshot: null,
  };
}

export function readMonitor(): MonitorState {
  let s: MonitorState = { version: 1, sites: [], events: [], scheduled: [] };
  try {
    const raw = JSON.parse(fs.readFileSync(file(), "utf8"));
    s = { version: 1, sites: Array.isArray(raw.sites) ? raw.sites : [], events: Array.isArray(raw.events) ? raw.events : [], scheduled: Array.isArray(raw.scheduled) ? raw.scheduled : [] };
  } catch {
    /* first run */
  }
  // The bundled sites are always monitored (they can be paused, not removed).
  for (const url of SAMPLE_SITES) {
    const d = domainOf(url);
    const existing = s.sites.find((x) => x.domain === d);
    if (!existing) s.sites.push(newSite(url, true));
    else existing.builtIn = true;
  }
  return s;
}

let chain: Promise<unknown> = Promise.resolve();
export function updateMonitor<T>(fn: (s: MonitorState) => T): Promise<T> {
  const next = chain.then(() => {
    const s = readMonitor();
    const r = fn(s);
    s.events = s.events.slice(0, MAX_EVENTS);
    writeAtomic(file(), JSON.stringify(s, null, 2));
    return r;
  });
  chain = next.catch(() => undefined);
  return next;
}

function pushEvent(s: MonitorState, e: Omit<MonitorEvent, "id" | "at" | "seen">) {
  s.events.unshift({ id: randomUUID(), at: new Date().toISOString(), seen: false, ...e });
}

// ------------------------------------------------------------------ audits per site

function auditsFor(all: AuditSummary[], domain: string) {
  const mine = all.filter((a) => a.domain === domain);
  const completed = mine.filter((a) => a.status === "completed" && a.hasResults).sort((a, b) => (a.finishedAt ?? a.createdAt).localeCompare(b.finishedAt ?? b.createdAt));
  const running = mine.find((a) => a.status === "running" || a.status === "queued") ?? null;
  const lastStart = mine.map((a) => a.startedAt ?? a.createdAt).sort().at(-1) ?? null;
  return { completed, running, lastStart };
}

export function nextRunAt(site: MonitoredSite, lastStart: string | null): string | null {
  if (!site.enabled) return null;
  if (site.runRequestedAt && (!lastStart || Date.parse(site.runRequestedAt) > Date.parse(lastStart))) return site.runRequestedAt;
  if (!lastStart) return new Date().toISOString();
  const due = Date.parse(lastStart) + site.intervalHours * H;
  if (site.changeDetectedAt && Date.parse(site.changeDetectedAt) > Date.parse(lastStart)) {
    return new Date(Math.min(due, Date.parse(lastStart) + CHANGE_MIN_GAP_H * H)).toISOString();
  }
  return new Date(due).toISOString();
}

// ------------------------------------------------------------------ change check (no crawl)

const hashList = (xs: string[]) => createHash("sha1").update([...xs].sort().join("\n")).digest("hex");
const FIELDS: Array<[keyof HomepageSignals, string]> = [
  ["status", "HTTP status"], ["title", "Title"], ["description", "Meta description"], ["h1", "H1 heading"], ["canonical", "Canonical"], ["robots", "Meta robots"],
];

/** Light check: homepage SEO tags and the sitemap URL list. Returns the changes, if any. */
export async function checkSite(site: MonitoredSite, deps: SiteSizeDeps = {}): Promise<{ changes: ChangeDetails | null; pages: number; snapshot: NonNullable<MonitoredSite["snapshot"]> }> {
  const r = await countSitePages(site.url, { ...deps, collectUrls: true });
  const urls = r.urls ?? [];
  const snapshot = { homepage: r.homepage, sitemapCount: r.sitemapUrlCount, sitemapHash: hashList(urls) };
  let prevUrls: string[] = [];
  try {
    prevUrls = JSON.parse(fs.readFileSync(urlsFile(site.domain), "utf8"));
  } catch {
    /* none yet */
  }
  fs.mkdirSync(path.dirname(urlsFile(site.domain)), { recursive: true, mode: 0o700 });
  writeAtomic(urlsFile(site.domain), JSON.stringify(urls));
  const prev = site.snapshot;
  if (!prev) return { changes: null, pages: r.estimate, snapshot };
  const homepage = FIELDS.filter(([k]) => String(prev.homepage[k] ?? "") !== String(r.homepage[k] ?? "")).map(([k, label]) => ({
    field: label, before: prev.homepage[k] == null ? null : String(prev.homepage[k]), after: r.homepage[k] == null ? null : String(r.homepage[k]),
  }));
  let sitemap: ChangeDetails["sitemap"] = null;
  // A failed sitemap fetch (0 URLs now, many before) is not reported as "every page removed".
  const fetchFailed = urls.length === 0 && prev.sitemapCount > 0;
  if (!fetchFailed && prev.sitemapHash !== snapshot.sitemapHash) {
    const before = new Set(prevUrls);
    const now = new Set(urls);
    const added = urls.filter((u) => !before.has(u));
    const removed = prevUrls.filter((u) => !now.has(u));
    sitemap = { before: prev.sitemapCount, after: r.sitemapUrlCount, added: added.slice(0, 50), removed: removed.slice(0, 50), addedCount: added.length, removedCount: removed.length };
  }
  const changes = homepage.length || sitemap ? { homepage, sitemap } : null;
  return { changes, pages: r.estimate, snapshot: fetchFailed ? { ...snapshot, sitemapCount: prev.sitemapCount, sitemapHash: prev.sitemapHash } : snapshot };
}

function changeTitle(c: ChangeDetails): string {
  const parts: string[] = [];
  if (c.sitemap?.addedCount) parts.push(`${c.sitemap.addedCount} new page${c.sitemap.addedCount === 1 ? "" : "s"} in the sitemap`);
  if (c.sitemap?.removedCount) parts.push(`${c.sitemap.removedCount} page${c.sitemap.removedCount === 1 ? "" : "s"} removed from the sitemap`);
  if (c.homepage.length) parts.push(`homepage ${c.homepage.map((h) => h.field.toLowerCase()).join(", ")} changed`);
  const s = parts.join("; ") || "Site changed";
  return s[0].toUpperCase() + s.slice(1);
}

// ------------------------------------------------------------------ scheduler tick

export interface TickDeps extends SiteSizeDeps {
  now?: () => number;
  gsc?: GscDeps;
  startAudit?: (url: string, options: Record<string, unknown>, keywords: string[]) => Promise<{ id: string }>;
}

async function defaultStart(url: string, options: Record<string, unknown>, keywords: string[]) {
  const { job } = await createAudit({ url, options, keywords });
  return { id: job.id };
}

/** Report each new completed audit of a monitored site as a "what changed" event. */
async function reportNewAudits(all: AuditSummary[]) {
  const s = readMonitor();
  const todo: Array<{ domain: string; url: string; id: string; prevId: string | null; baseline: boolean }> = [];
  for (const site of s.sites) {
    const { completed } = auditsFor(all, site.domain);
    const latest = completed.at(-1);
    if (!latest || latest.id === site.lastReportedAuditId) continue;
    const prev = completed.at(-2) ?? null;
    todo.push({ domain: site.domain, url: site.url, id: latest.id, prevId: prev?.id ?? null, baseline: !prev });
  }
  if (!todo.length) return;
  const events: Array<Omit<MonitorEvent, "id" | "at" | "seen"> & { domain: string; reported: string }> = [];
  for (const t of todo) {
    const curr = loadAudit(t.id);
    if (!curr) continue;
    const prev = t.prevId ? loadAudit(t.prevId) : null;
    const rawDiff = prev ? diffAudits(t.prevId!, prev, t.id, curr) : diffAudits(t.id, { ...curr, findings: [], pages: [], actions: [] } as typeof curr, t.id, curr);
    // Mark actions the data shows are probably intended, and list them last.
    const todo = [...curr.actions]
      .sort((a, b) => a.priority.localeCompare(b.priority) || b.impact - a.impact)
      .map((a) => {
        const f = curr.findings.find((x) => x.id === a.id);
        const v = f ? findingBreakdown(curr, f).verdict : null;
        return { id: a.id, title: a.title, severity: a.severity, priority: a.priority, count: a.count, fix: a.fix, verdict: v ? { tone: v.tone, title: v.title } : undefined };
      })
      .sort((a, b) => Number(a.verdict?.tone === "good") - Number(b.verdict?.tone === "good"))
      .slice(0, 8);
    const diff = { ...rawDiff, todo };
    events.push({
      domain: t.domain, reported: t.id, url: t.url, kind: prev ? "audit" : "baseline", auditId: t.id, prevAuditId: t.prevId, score: curr.scores?.overall ?? null, grade: curr.scores?.grade ?? null,
      title: prev ? diffHeadline(diff) : `First audit: score ${curr.scores?.overall ?? "–"}, ${curr.actions.length} things to fix`,
      diff: prev ? diff : { ...diff, newIssues: [], score: { before: null, after: curr.scores?.overall ?? null, delta: null }, pageChanges: { ...diff.pageChanges, found: [], counts: { ...diff.pageChanges.counts, found: 0 } } },
      change: null,
    });
  }
  await updateMonitor((m) => {
    for (const e of events) {
      const site = m.sites.find((x) => x.domain === e.domain);
      if (!site || site.lastReportedAuditId === e.reported) continue;
      site.lastReportedAuditId = e.reported;
      const { reported: _r, ...ev } = e;
      void _r;
      pushEvent(m, ev);
    }
  });
}

/**
 * Sync one site's Search Console data and post each new problem to the change feed once.
 * A connection error is posted once too (not again while it stays the same).
 */
export async function syncSearchConsole(domain: string, deps: GscDeps = {}) {
  const site = readMonitor().sites.find((x) => x.domain === domain);
  if (!site) throw Object.assign(new Error("Site is not monitored."), { status: 404 });
  const before = readSnapshot(domain);
  try {
    const r = await syncSite(domain, site.url, deps);
    if (r.newAlerts.length)
      await updateMonitor((m) => {
        for (const a of r.newAlerts.slice().reverse())
          pushEvent(m, { domain, url: site.url, kind: "search", title: a.title, auditId: null, prevAuditId: null, score: null, grade: null, diff: null, change: null, search: a });
      });
    return r;
  } catch (e) {
    const msg = (e as Error).message;
    if (before?.error !== msg)
      await updateMonitor((m) => pushEvent(m, { domain, url: site.url, kind: "error", title: `Search Console: ${msg}`, auditId: null, prevAuditId: null, score: null, grade: null, diff: null, change: null }));
    throw e;
  }
}

let ticking = false;

/** One scheduler pass: report finished audits, run due change checks, start at most one due audit. */
export async function tick(deps: TickDeps = {}): Promise<{ started: string | null; checked: string[]; synced: string | null }> {
  if (ticking) return { started: null, checked: [], synced: null };
  ticking = true;
  const now = deps.now ?? Date.now;
  const out = { started: null as string | null, checked: [] as string[], synced: null as string | null };
  try {
    await reportNewAudits(listAudits({ includeHidden: true }));

    // Light change checks
    for (const site of readMonitor().sites.filter((x) => x.enabled)) {
      if (site.lastCheckAt && now() - Date.parse(site.lastCheckAt) < CHECK_EVERY_H * H) continue;
      try {
        const r = await checkSite(site, deps);
        out.checked.push(site.domain);
        await updateMonitor((m) => {
          const x = m.sites.find((y) => y.domain === site.domain);
          if (!x) return;
          x.lastCheckAt = new Date(now()).toISOString();
          x.snapshot = r.snapshot;
          x.pagesCounted = r.pages;
          if (r.changes) {
            x.changeDetectedAt = x.lastCheckAt;
            pushEvent(m, { domain: x.domain, url: x.url, kind: "change", title: changeTitle(r.changes), auditId: null, prevAuditId: null, score: null, grade: null, diff: null, change: r.changes });
          }
        });
      } catch (e) {
        await updateMonitor((m) => {
          const x = m.sites.find((y) => y.domain === site.domain);
          if (x) x.lastCheckAt = new Date(now()).toISOString();
          void e;
        });
      }
    }

    // Search Console: one site per pass, once a day (failed syncs retry after 6 hours)
    if (gscCredentialStatus().configured || deps.gsc?.sa) {
      const due = readMonitor().sites.filter((x) => x.enabled).find((x) => {
        const snap = readSnapshot(x.domain);
        if (!snap) return true;
        const last = Date.parse(snap.errorAt ?? snap.fetchedAt);
        return now() - last >= (snap.error ? 6 : 24) * H;
      });
      if (due) {
        await syncSearchConsole(due.domain, { ...deps.gsc, now: deps.gsc?.now ?? now }).catch(() => undefined);
        out.synced = due.domain;
      }
    }

    // Start one due audit, if there is room
    if (runningJobs().length >= maxConcurrentAudits()) return out;
    const all = listAudits({ includeHidden: true });
    const m = readMonitor();
    const due = m.sites
      .filter((x) => x.enabled)
      .map((x) => ({ site: x, a: auditsFor(all, x.domain) }))
      .filter(({ site, a }) => !a.running && (!site.lastAttemptAt || now() - Date.parse(site.lastAttemptAt) >= RETRY_AFTER_H * H))
      .map(({ site, a }) => ({ site, a, next: nextRunAt(site, a.lastStart) }))
      .filter((x) => x.next && Date.parse(x.next) <= now())
      .sort((x, y) => Date.parse(x.next!) - Date.parse(y.next!));
    const pick = due[0];
    if (!pick) return out;
    const { site, a } = pick;
    const defaults = readState().defaults;
    const pages = Math.min(MAX_PAGES, Math.max(1, site.pagesCounted ?? a.completed.at(-1)?.pagesCrawled ?? defaults.maxPages));
    const options = {
      maxPages: pages,
      timeBudget: Math.min(5400, Math.max(defaults.timeBudget, Math.ceil((pages * 2) / 60) * 60)),
      psi: isConfigured("PAGESPEED_API_KEY") && defaults.psi,
      ai: isConfigured("TYPESAFE_API_KEY") && defaults.ai,
      full: false,
    };
    const keywords = a.completed.length ? (readState().keywords[a.completed.at(-1)!.id] ?? []) : [];
    try {
      const job = await (deps.startAudit ?? defaultStart)(site.url, options, keywords);
      out.started = job.id;
      await updateMonitor((mm) => {
        const x = mm.sites.find((y) => y.domain === site.domain);
        if (x) {
          x.lastAttemptAt = new Date(now()).toISOString();
          x.lastAttemptError = null;
        }
        mm.scheduled = [job.id, ...mm.scheduled].slice(0, 500);
      });
    } catch (e) {
      const status = (e as { status?: number }).status;
      // 409/429: something else is running; try again on the next pass without recording a failure.
      if (status === 409 || status === 429) return out;
      const msg = (e as Error).message;
      await updateMonitor((mm) => {
        const x = mm.sites.find((y) => y.domain === site.domain);
        if (!x) return;
        x.lastAttemptAt = new Date(now()).toISOString();
        x.lastAttemptError = msg;
        pushEvent(mm, { domain: x.domain, url: x.url, kind: "error", title: `Scheduled audit could not start: ${msg}`, auditId: null, prevAuditId: null, score: null, grade: null, diff: null, change: null });
      });
    }
    return out;
  } finally {
    ticking = false;
  }
}

// ------------------------------------------------------------------ public view

export function monitorOverview() {
  const m = readMonitor();
  const all = listAudits({ includeHidden: true });
  const sites = m.sites.map((site) => {
    const a = auditsFor(all, site.domain);
    const last = a.completed.at(-1) ?? null;
    const history = a.completed.slice(-12).map((x) => ({ id: x.id, score: x.score, at: x.finishedAt ?? x.createdAt }));
    return {
      url: site.url, domain: site.domain, enabled: site.enabled, intervalHours: site.intervalHours, builtIn: site.builtIn,
      pagesCounted: site.pagesCounted, lastCheckAt: site.lastCheckAt, lastAttemptError: site.lastAttemptError,
      changeDetectedAt: site.changeDetectedAt,
      running: a.running ? { id: a.running.id, startedAt: a.running.startedAt } : null,
      lastAudit: last ? { id: last.id, score: last.score, grade: last.grade, finishedAt: last.finishedAt, pagesCrawled: last.pagesCrawled, findingsTotal: last.findingsTotal, severity: last.severity } : null,
      nextRunAt: nextRunAt(site, a.lastStart),
      history,
      search: searchSummary(site.domain),
    };
  });
  return { enabled: monitorEnabled(), sites, events: m.events.slice(0, 100), unseen: m.events.filter((e) => !e.seen).length, scheduled: m.scheduled };
}

function searchSummary(domain: string) {
  const snap = readSnapshot(domain);
  if (!snap) return null;
  const k = snap.endDate ? kpis(snap, 28) : null;
  return {
    property: snap.property, fetchedAt: snap.fetchedAt, error: snap.error,
    clicks: k?.current.clicks ?? null, impressions: k?.current.impressions ?? null, position: k?.current.position ?? null,
    clicksChange: k?.change.clicks ?? null, alerts: snap.alerts.length,
  };
}

export function monitorEnabled() {
  return setting("MONITOR") !== "0";
}

export async function updateSite(domain: string, patch: { enabled?: boolean; intervalHours?: number }) {
  return updateMonitor((m) => {
    const x = m.sites.find((y) => y.domain === domain);
    if (!x) return null;
    if (patch.enabled !== undefined) x.enabled = patch.enabled;
    if (patch.intervalHours !== undefined) x.intervalHours = patch.intervalHours;
    return x;
  });
}

export async function addSite(url: string) {
  const c = checkUrlSyntax(url);
  if (!c.ok || !c.url) throw Object.assign(new Error(c.error ?? "Invalid URL."), { status: 422 });
  const site = newSite(c.url, false);
  return updateMonitor((m) => {
    if (m.sites.some((y) => y.domain === site.domain)) throw Object.assign(new Error(`${site.domain} is already monitored.`), { status: 409 });
    if (m.sites.length >= 25) throw Object.assign(new Error("At most 25 sites can be monitored."), { status: 422 });
    m.sites.push(site);
    return site;
  });
}

export async function removeSite(domain: string) {
  return updateMonitor((m) => {
    const x = m.sites.find((y) => y.domain === domain);
    if (!x) return false;
    if (x.builtIn) throw Object.assign(new Error("Built-in sites can be paused but not removed."), { status: 422 });
    m.sites = m.sites.filter((y) => y.domain !== domain);
    return true;
  });
}

/** Make a site due now; the scheduler starts it on its next pass (within a minute). */
export async function runNow(domain: string) {
  return updateMonitor((m) => {
    const x = m.sites.find((y) => y.domain === domain);
    if (!x) return false;
    x.enabled = true;
    x.lastAttemptAt = null;
    x.runRequestedAt = new Date().toISOString();
    return true;
  });
}

export async function markSeen(ids?: string[]) {
  return updateMonitor((m) => {
    for (const e of m.events) if (!ids || ids.includes(e.id)) e.seen = true;
  });
}

// ------------------------------------------------------------------ lifecycle

const g = globalThis as unknown as { __rankoraMonitor?: NodeJS.Timeout };

/** Start the background scheduler (once per server process). RANKORA_MONITOR=0 disables it. */
export function startMonitor() {
  if (!monitorEnabled() || g.__rankoraMonitor) return;
  const run = () => void tick().catch((e) => console.error("[monitor]", (e as Error).message));
  setTimeout(run, 20_000).unref?.();
  g.__rankoraMonitor = setInterval(run, 60_000);
  g.__rankoraMonitor.unref?.();
}
