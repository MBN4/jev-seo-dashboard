import "server-only";
import fs from "node:fs";
import path from "node:path";
import { dataDir, ensureDir } from "./config";
import { writeAtomic, readState } from "./state";
import { runExtraChecks } from "./extra-checks";
import { findingBreakdown, intendedNoindexReason } from "./finding-breakdown";
import { priorityOf } from "@/lib/priorities";
import { kpis, indexing, type GscSnapshot } from "@/lib/gsc-insights";
import type { DayRecord, GscDayRecord, IssueRecord } from "@/lib/issue-progress";
import type { EngineAudit } from "@/types/engine";

/**
 * Daily history: one compact record per site per day, kept forever.
 *
 * Each record lists every open issue (engine checks and extra checks) with its affected URLs,
 * plus the score. Search Console numbers get their own daily record. Records are small (tens
 * to a few hundred KB) compared with a full audit (up to 100+ MB), so the history survives
 * even when old full audit files are cleaned up.
 */

const URL_CAP = 500;
const root = () => path.join(dataDir(), "history");
const safe = (d: string) => d.replace(/[^a-z0-9.-]/gi, "_");
const siteDir = (domain: string) => path.join(root(), safe(domain));

export function auditDate(a: EngineAudit): string {
  return (a.run.finished_at ?? a.run.started_at ?? new Date().toISOString()).slice(0, 10);
}

/** Build the compact record for one audit. */
export function recordFromAudit(domain: string, auditId: string, a: EngineAudit, keywords: string[] = []): DayRecord {
  const issues: IssueRecord[] = [];
  for (const f of a.findings) {
    let p = priorityOf(f.id, f.severity);
    let intended = false;
    let verdictTitle = "";
    try {
      const v = findingBreakdown(a, f).verdict;
      intended = v.tone === "good";
      verdictTitle = v.title;
    } catch {
      intended = false;
    }
    // noindex is P0 only on the homepage; on other content pages it is P1.
    if (f.id === "noindex" && verdictTitle !== "Fix immediately") p = { ...p, tier: "P1" };
    // For noindex, count only the pages that need a decision (not pagination, archives, legal pages…).
    const urls = f.id === "noindex" && !intended ? f.urls.filter((u) => !intendedNoindexReason(u)) : f.urls;
    issues.push({ id: f.id, title: f.title, severity: f.severity, source: f.origin === "ai" ? "ai" : f.origin === "dataforseo" ? "dataforseo" : "rule", tier: p.tier, owner: p.owner, count: urls.length, urls: urls.slice(0, URL_CAP), intended });
  }
  for (const f of runExtraChecks(a, keywords).findings) {
    const p = priorityOf(f.id, f.severity);
    issues.push({ id: f.id, title: f.title, severity: f.severity, source: "extra", tier: p.tier, owner: p.owner, count: f.count, urls: f.urls.slice(0, URL_CAP), intended: false });
  }
  return {
    version: 1,
    domain,
    date: auditDate(a),
    auditId,
    finishedAt: a.run.finished_at ?? null,
    score: a.scores?.overall ?? null,
    grade: a.scores?.grade ?? null,
    pages: a.pages.length,
    issues,
  };
}

export function readRecords(domain: string): DayRecord[] {
  let files: string[] = [];
  try {
    files = fs.readdirSync(siteDir(domain)).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f));
  } catch {
    return [];
  }
  return files
    .sort()
    .map((f) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(siteDir(domain), f), "utf8")) as DayRecord;
      } catch {
        return null;
      }
    })
    .filter((r): r is DayRecord => Boolean(r));
}

export function readGscRecords(domain: string): GscDayRecord[] {
  const dir = path.join(siteDir(domain), "search-console");
  let files: string[] = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  } catch {
    return [];
  }
  return files.map((f) => {
    try {
      return JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as GscDayRecord;
    } catch {
      return null;
    }
  }).filter((r): r is GscDayRecord => Boolean(r));
}

const supersededFile = (domain: string) => path.join(siteDir(domain), "superseded.json");
function readSuperseded(domain: string): string[] {
  try {
    return JSON.parse(fs.readFileSync(supersededFile(domain), "utf8"));
  } catch {
    return [];
  }
}
function addSuperseded(domain: string, id: string) {
  const list = readSuperseded(domain);
  if (list.includes(id)) return;
  ensureDir(siteDir(domain));
  writeAtomic(supersededFile(domain), JSON.stringify([...list, id]));
}

/** Audit IDs already handled: those with a record, and same-day audits replaced by a later one. */
export function recordedAuditIds(domain: string): Set<string> {
  return new Set([...readRecords(domain).map((r) => r.auditId), ...readSuperseded(domain)]);
}

/**
 * Save the record for an audit. One record per day: a later audit on the same day replaces an
 * earlier one, an earlier one never replaces a later one.
 */
export function saveAuditRecord(domain: string, auditId: string, a: EngineAudit): DayRecord {
  const rec = recordFromAudit(domain, auditId, a, readState().keywords[auditId] ?? []);
  const file = path.join(siteDir(domain), `${rec.date}.json`);
  try {
    const existing = JSON.parse(fs.readFileSync(file, "utf8")) as DayRecord;
    if (existing.auditId !== auditId && (existing.finishedAt ?? "") > (rec.finishedAt ?? "")) {
      addSuperseded(domain, auditId);
      return existing;
    }
    if (existing.auditId !== auditId) addSuperseded(domain, existing.auditId);
  } catch {
    /* none yet */
  }
  ensureDir(siteDir(domain));
  writeAtomic(file, JSON.stringify(rec));
  return rec;
}

/** Save the day's Search Console numbers (one file per day, latest sync wins). */
export function saveGscRecord(domain: string, snap: GscSnapshot): GscDayRecord | null {
  if (!snap.endDate) return null;
  const k28 = kpis(snap, 28);
  const k7 = kpis(snap, 7);
  const ix = indexing(snap);
  const top = (snap.ranges["28"]?.queries ?? []).slice().sort((a, b) => b.clicks - a.clicks).slice(0, 50).map((q) => ({ key: q.key, clicks: q.clicks, impressions: q.impressions, position: q.position }));
  const rec: GscDayRecord = {
    version: 1,
    domain,
    date: snap.fetchedAt.slice(0, 10),
    dataUntil: snap.endDate,
    clicks28: k28?.current.clicks ?? 0,
    impressions28: k28?.current.impressions ?? 0,
    ctr28: k28?.current.ctr ?? 0,
    position28: k28?.current.position ?? null,
    clicks7: k7?.current.clicks ?? 0,
    indexed: ix.indexed,
    notIndexed: ix.notIndexed,
    notIndexedUrls: ix.list.filter((i) => i.verdict !== "PASS").map((i) => i.url),
    alerts: snap.alerts.map((a) => ({ id: a.id.split(":")[0], title: a.title, priority: a.priority })),
    topQueries: top,
  };
  const dir = path.join(siteDir(domain), "search-console");
  ensureDir(dir);
  writeAtomic(path.join(dir, `${rec.date}.json`), JSON.stringify(rec));
  return rec;
}

/** Bytes used by one site's history records. */
export function historyBytes(domain: string): number {
  let total = 0;
  const walk = (d: string) => {
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else
        try {
          total += fs.statSync(p).size;
        } catch {
          /* ignore */
        }
    }
  };
  walk(siteDir(domain));
  return total;
}
