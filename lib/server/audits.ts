import "server-only";
import fs from "node:fs";
import path from "node:path";
import { reportsDir } from "./config";
import { auditFolder, isValidAuditId, REPORT_FILES } from "./paths";
import { listJobIds, readJob, refreshJob, type Job } from "./jobs";
import { readState } from "./state";
import { redactPaths } from "./redact";
import { neutralEngineText } from "@/lib/brand";
import type { EngineAudit, Severity } from "@/types/engine";
import type { AuditSummary, ReportFile, ReportType, SeverityCounts } from "@/types/api";

/**
 * Audit index. The engine's report folders are the source of truth for results;
 * dashboard job records add status for audits launched (or still running) from the UI.
 */

interface CacheEntry {
  mtimeMs: number;
  size: number;
  audit: EngineAudit;
}
const g = globalThis as unknown as { __jevseoAuditCache?: Map<string, CacheEntry> };
const cache: Map<string, CacheEntry> = (g.__jevseoAuditCache ??= new Map());
const CACHE_LIMIT = 6;

export class AuditLoadError extends Error {}

/** Parse audit.json once per file version; small LRU so large audits are not re-read per request. */
/**
 * Engine-written explanations name the upstream project ("Jev judgments unavailable").
 * Reword them in memory for display; audit.json on disk is never modified.
 */
function neutralizeDisplayText(a: EngineAudit) {
  const n = (t: string | undefined) => (typeof t === "string" ? neutralEngineText(t) : t);
  a.scores.partial = a.scores.partial?.map((t) => neutralEngineText(t));
  a.scores.caps = a.scores.caps?.map((t) => neutralEngineText(t));
  if (a.scores.notes) for (const k of Object.keys(a.scores.notes)) a.scores.notes[k] = neutralEngineText(a.scores.notes[k]);
  for (const f of [...a.findings, ...a.actions]) {
    f.title = n(f.title) as string;
    f.fix = n(f.fix) as string;
    f.evidence = n(f.evidence) as string;
  }
  if (a.jev?.skipped) a.jev.skipped = neutralEngineText(a.jev.skipped);
}

export function loadAudit(id: string): EngineAudit | null {
  const folder = auditFolder(id);
  if (!folder) return null;
  const file = path.join(folder, "audit.json");
  let st: fs.Stats;
  try {
    st = fs.statSync(file);
  } catch {
    return null;
  }
  const hit = cache.get(id);
  if (hit && hit.mtimeMs === st.mtimeMs && hit.size === st.size) {
    cache.delete(id);
    cache.set(id, hit);
    return hit.audit;
  }
  let audit: EngineAudit;
  try {
    audit = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    throw new AuditLoadError(`audit.json in ${id} could not be read as JSON (it may be incomplete).`);
  }
  if (!audit || typeof audit !== "object" || !audit.scores || !Array.isArray(audit.pages) || !Array.isArray(audit.findings)) {
    throw new AuditLoadError(`audit.json in ${id} does not look like a jev-seo audit.`);
  }
  neutralizeDisplayText(audit);
  cache.set(id, { mtimeMs: st.mtimeMs, size: st.size, audit });
  while (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
  return audit;
}

interface SummaryCacheEntry {
  mtimeMs: number;
  summary: Omit<AuditSummary, "status" | "origin" | "error" | "reports">;
}
const gs = globalThis as unknown as { __jevseoSummaryCache?: Map<string, SummaryCacheEntry> };
const summaryCache: Map<string, SummaryCacheEntry> = (gs.__jevseoSummaryCache ??= new Map());

function severityCounts(audit: EngineAudit): SeverityCounts {
  const c: SeverityCounts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of audit.findings) if (f.severity in c) c[f.severity as Severity]++;
  return c;
}

export function rulesEvaluated(audit: EngineAudit): number {
  const ruleIds = new Set(audit.findings.filter((f) => f.origin === "rule").map((f) => f.id));
  for (const r of audit.passed_rules ?? []) ruleIds.add(r);
  return ruleIds.size;
}

export function availableReports(id: string): ReportFile[] {
  const folder = auditFolder(id);
  if (!folder) return [];
  const out: ReportFile[] = [];
  for (const [type, spec] of Object.entries(REPORT_FILES) as Array<[ReportType, (typeof REPORT_FILES)[ReportType]]>) {
    try {
      const st = fs.statSync(path.join(folder, spec.filename));
      if (st.isFile()) out.push({ type, label: spec.label, filename: spec.filename, size: st.size, modifiedAt: st.mtime.toISOString() });
    } catch {
      /* not generated */
    }
  }
  return out;
}

function fromAudit(id: string): SummaryCacheEntry["summary"] | null {
  const folder = auditFolder(id);
  if (!folder) return null;
  let mtimeMs: number;
  try {
    mtimeMs = fs.statSync(path.join(folder, "audit.json")).mtimeMs;
  } catch {
    return null;
  }
  const hit = summaryCache.get(id);
  if (hit && hit.mtimeMs === mtimeMs) return hit.summary;
  let a: EngineAudit | null;
  try {
    a = loadAudit(id);
  } catch {
    return null;
  }
  if (!a) return null;
  const opts = (a.run.options ?? {}) as Record<string, unknown>;
  const summary: SummaryCacheEntry["summary"] = {
    id,
    url: a.site.input_url ?? a.site.final_url,
    domain: a.site.domain,
    createdAt: a.run.started_at,
    startedAt: a.run.started_at,
    finishedAt: a.run.finished_at,
    engineVersion: a.tool?.version ?? null,
    score: a.scores.overall,
    grade: a.scores.grade,
    partial: a.scores.partial ?? [],
    completeness: a.scores.completeness ? { scored: a.scores.completeness.categories_scored, total: a.scores.completeness.categories_total } : null,
    pagesCrawled: a.pages.length,
    htmlPages: a.pages.filter((p) => p.kind === "page" && p.status === 200).length,
    sitemapUrls: a.site.sitemaps?.total_urls ?? null,
    findingsTotal: a.findings.length,
    severity: severityCounts(a),
    actionsTotal: a.actions?.length ?? 0,
    passedRules: a.passed_rules?.length ?? 0,
    rulesEvaluated: rulesEvaluated(a),
    options: {
      maxPages: opts.max_pages as number,
      jev: opts.no_jev === undefined ? undefined : !opts.no_jev,
      psi: opts.no_psi === undefined ? undefined : !opts.no_psi,
      full: opts.full as boolean,
      render: opts.render as "auto" | "always" | "never",
    },
    hasResults: true,
  };
  summaryCache.set(id, { mtimeMs, summary });
  return summary;
}

function jobOnlySummary(job: Job): AuditSummary {
  return {
    id: job.id,
    url: job.url,
    domain: job.domain,
    status: job.status,
    origin: "dashboard",
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    engineVersion: null,
    score: null,
    grade: null,
    partial: [],
    completeness: null,
    pagesCrawled: null,
    htmlPages: null,
    sitemapUrls: null,
    findingsTotal: null,
    severity: null,
    actionsTotal: null,
    passedRules: null,
    rulesEvaluated: null,
    reports: availableReports(job.id).map((r) => r.type),
    error: job.error ? redactPaths(job.error) : null,
    options: job.options,
    hasResults: false,
  };
}

export function getAuditSummary(id: string): AuditSummary | null {
  if (!isValidAuditId(id)) return null;
  const job = refreshJob(id);
  // While a job runs, its folder may hold a half-written audit.json: report the job only.
  if (job && (job.status === "running" || job.status === "queued")) return jobOnlySummary(job);
  const s = fromAudit(id);
  if (!s) return job ? jobOnlySummary(job) : null;
  return {
    ...s,
    status: job ? job.status : "completed",
    origin: job ? "dashboard" : "imported",
    error: job?.error ? redactPaths(job.error) : job?.note ?? null,
    options: job ? job.options : s.options,
    reports: availableReports(id).map((r) => r.type),
    hasResults: true,
  };
}

/** Folders in the reports directory that contain an audit.json. */
export function discoverReportFolders(): string[] {
  const root = reportsDir();
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => (e.isDirectory() || e.isSymbolicLink()) && isValidAuditId(e.name))
    .filter((e) => auditFolder(e.name) && fs.existsSync(path.join(root, e.name, "audit.json")))
    .map((e) => e.name);
}

export function listAudits(opts: { includeHidden?: boolean } = {}): AuditSummary[] {
  const hidden = readState().hidden;
  const ids = new Set<string>([...discoverReportFolders(), ...listJobIds()]);
  const out: AuditSummary[] = [];
  for (const id of ids) {
    if (!opts.includeHidden && hidden[id]) continue;
    const s = getAuditSummary(id);
    if (s) out.push(s);
  }
  return out.sort((a, b) => (b.startedAt ?? b.createdAt).localeCompare(a.startedAt ?? a.createdAt));
}

export function hiddenAuditIds(): string[] {
  return Object.keys(readState().hidden);
}

export { readJob };
