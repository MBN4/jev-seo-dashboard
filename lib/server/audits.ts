import "server-only";
import fs from "node:fs";
import path from "node:path";
import { dataDir, reportsDir } from "./config";
import { auditFolder, isValidAuditId, REPORT_FILES } from "./paths";
import { listJobIds, readJob, refreshJob, type Job } from "./jobs";
import { readState, writeAtomic } from "./state";
import { redactPaths } from "./redact";
import { normalizeAudit } from "./engine-adapter";
import { brandedFile, brandedReady, type BrandedType } from "./branding";
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
const g = globalThis as unknown as { __auditpilotAuditCache?: Map<string, CacheEntry> };
const cache: Map<string, CacheEntry> = (g.__auditpilotAuditCache ??= new Map());
/** Keep parsed audits in memory up to this much source JSON (large crawls can be 100+ MB each). */
const CACHE_BYTES = Number(process.env.AUDITPILOT_AUDIT_CACHE_MB ?? process.env.RANKORA_AUDIT_CACHE_MB ?? 350) * 1024 * 1024;

export class AuditLoadError extends Error {}

/** Parse audit.json once per file version; small LRU so large audits are not re-read per request. */
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
    audit = normalizeAudit(JSON.parse(fs.readFileSync(file, "utf8")));
  } catch {
    throw new AuditLoadError(`audit.json in ${id} could not be read as JSON (it may be incomplete).`);
  }
  if (!audit || typeof audit !== "object" || !audit.scores || !Array.isArray(audit.pages) || !Array.isArray(audit.findings)) {
    throw new AuditLoadError(`audit.json in ${id} does not look like an audit file.`);
  }
  cache.set(id, { mtimeMs: st.mtimeMs, size: st.size, audit });
  // Evict least-recently-used audits until the budget fits (always keep the one just loaded).
  let total = [...cache.values()].reduce((n, e) => n + e.size, 0);
  for (const key of [...cache.keys()]) {
    if (total <= CACHE_BYTES || key === id) break;
    total -= cache.get(key)!.size;
    cache.delete(key);
  }
  return audit;
}

interface SummaryCacheEntry {
  mtimeMs: number;
  summary: Omit<AuditSummary, "status" | "origin" | "error" | "reports">;
}
const gs = globalThis as unknown as { __auditpilotSummaryCache?: Map<string, SummaryCacheEntry> };
const summaryCache: Map<string, SummaryCacheEntry> = (gs.__auditpilotSummaryCache ??= loadSummaryFile());

/**
 * Summaries are also kept on disk (data/summaries.json), so listing audits after a restart never
 * has to parse large audit files again; an entry is reused only while audit.json is unchanged.
 */
function summaryFile() {
  return path.join(dataDir(), "summaries.json");
}
function loadSummaryFile(): Map<string, SummaryCacheEntry> {
  try {
    return new Map(Object.entries(JSON.parse(fs.readFileSync(summaryFile(), "utf8")) as Record<string, SummaryCacheEntry>));
  } catch {
    return new Map();
  }
}
let saveTimer: NodeJS.Timeout | null = null;
function persistSummaries() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      writeAtomic(summaryFile(), JSON.stringify(Object.fromEntries(summaryCache)));
    } catch {
      /* cache only */
    }
  }, 500);
  saveTimer.unref?.();
}

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
      if (!st.isFile()) continue;
      // Report sizes are those of the branded copies users download, once they exist.
      const branded = type !== "json" && brandedReady(id) ? brandedFile(id, type as BrandedType) : null;
      const shown = branded ? fs.statSync(branded) : st;
      out.push({ type, label: spec.label, filename: spec.filename, size: shown.size, modifiedAt: st.mtime.toISOString() });
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
      ai: opts.ai === undefined ? undefined : Boolean(opts.ai),
      psi: opts.no_psi === undefined ? undefined : !opts.no_psi,
      full: opts.full as boolean,
      render: opts.render as "auto" | "always" | "never",
    },
    hasResults: true,
  };
  summaryCache.set(id, { mtimeMs, summary });
  persistSummaries();
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
