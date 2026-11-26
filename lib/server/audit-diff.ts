/**
 * What changed between two audits of the same site: score, issues that appeared, were fixed,
 * got worse or better, and page-level changes (status, title, description, noindex, content).
 * Every item comes from the two saved audit.json files; nothing is inferred.
 */
import type { EngineAudit, EnginePage, Severity } from "@/types/engine";

const LIST = 50;
const SEV_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

export interface IssueChange {
  id: string;
  title: string;
  severity: Severity;
  before: number;
  after: number;
  /** URLs affected now that were not affected before (sample) */
  newUrls: string[];
}

export interface ValueChange {
  url: string;
  before: string | null;
  after: string | null;
}

export interface AuditDiff {
  fromId: string;
  toId: string;
  score: { before: number | null; after: number | null; delta: number | null };
  grade: { before: string | null; after: string | null };
  pages: { before: number; after: number };
  newIssues: IssueChange[];
  resolved: IssueChange[];
  worse: IssueChange[];
  better: IssueChange[];
  pageChanges: {
    found: string[];
    notReached: string[];
    broke: ValueChange[];
    recovered: ValueChange[];
    title: ValueChange[];
    description: ValueChange[];
    noindexAdded: string[];
    noindexRemoved: string[];
    content: string[];
    counts: Record<"found" | "notReached" | "broke" | "recovered" | "title" | "description" | "noindexAdded" | "noindexRemoved" | "content", number>;
  };
  /** The current audit's most important open actions */
  todo: Array<{ id: string; title: string; severity: Severity; priority: string; count: number; fix: string; verdict?: { tone: string; title: string } }>;
  /** True when nothing meaningful changed */
  quiet: boolean;
}

const isNoindex = (p: EnginePage) => `${p.meta_robots ?? ""} ${p.x_robots ?? ""}`.toLowerCase().includes("noindex");
const ok = (p: EnginePage | undefined) => p?.status === 200 && p.kind === "page";

function bySeverity<T extends { severity: Severity }>(a: T, b: T) {
  return (SEV_RANK[a.severity] ?? 9) - (SEV_RANK[b.severity] ?? 9);
}

export function diffAudits(fromId: string, prev: EngineAudit, toId: string, curr: EngineAudit): AuditDiff {
  const pf = new Map(prev.findings.map((f) => [f.id, f]));
  const cf = new Map(curr.findings.map((f) => [f.id, f]));
  const newIssues: IssueChange[] = [];
  const worse: IssueChange[] = [];
  const better: IssueChange[] = [];
  const resolved: IssueChange[] = [];
  for (const f of curr.findings) {
    const p = pf.get(f.id);
    const before = p?.urls.length ?? 0;
    const prevUrls = new Set(p?.urls ?? []);
    const change: IssueChange = { id: f.id, title: f.title, severity: f.severity, before, after: f.urls.length, newUrls: f.urls.filter((u) => !prevUrls.has(u)).slice(0, 10) };
    if (!p) newIssues.push(change);
    else if (f.urls.length > before) worse.push(change);
    else if (f.urls.length < before) better.push(change);
  }
  for (const p of prev.findings) if (!cf.has(p.id)) resolved.push({ id: p.id, title: p.title, severity: p.severity, before: p.urls.length, after: 0, newUrls: [] });

  const pp = new Map(prev.pages.map((p) => [p.url, p]));
  const cp = new Map(curr.pages.map((p) => [p.url, p]));
  const found: string[] = [];
  const notReached: string[] = [];
  const broke: ValueChange[] = [];
  const recovered: ValueChange[] = [];
  const title: ValueChange[] = [];
  const description: ValueChange[] = [];
  const noindexAdded: string[] = [];
  const noindexRemoved: string[] = [];
  const content: string[] = [];
  const st = (p: EnginePage | undefined) => (p ? (p.status == null ? (p.error ?? "unreachable") : String(p.status)) : null);
  for (const [url, c] of cp) {
    const p = pp.get(url);
    if (!p) {
      if (c.kind === "page") found.push(url);
      continue;
    }
    const wasOk = (p.status ?? 0) > 0 && (p.status ?? 0) < 400;
    const isOk = (c.status ?? 0) > 0 && (c.status ?? 0) < 400;
    if (wasOk && !isOk) broke.push({ url, before: st(p), after: st(c) });
    if (!wasOk && isOk) recovered.push({ url, before: st(p), after: st(c) });
    if (ok(p) && ok(c)) {
      if ((p.title ?? "") !== (c.title ?? "")) title.push({ url, before: p.title ?? null, after: c.title ?? null });
      if ((p.meta_description ?? "") !== (c.meta_description ?? "")) description.push({ url, before: p.meta_description ?? null, after: c.meta_description ?? null });
      if (!isNoindex(p) && isNoindex(c)) noindexAdded.push(url);
      if (isNoindex(p) && !isNoindex(c)) noindexRemoved.push(url);
      if (p.text_hash && c.text_hash && p.text_hash !== c.text_hash) content.push(url);
    }
  }
  for (const [url, p] of pp) if (!cp.has(url) && p.kind === "page") notReached.push(url);

  const counts = {
    found: found.length, notReached: notReached.length, broke: broke.length, recovered: recovered.length, title: title.length,
    description: description.length, noindexAdded: noindexAdded.length, noindexRemoved: noindexRemoved.length, content: content.length,
  };
  const before = prev.scores?.overall ?? null;
  const after = curr.scores?.overall ?? null;
  const todo = [...curr.actions]
    .sort((a, b) => a.priority.localeCompare(b.priority) || b.impact - a.impact)
    .slice(0, 6)
    .map((a) => ({ id: a.id, title: a.title, severity: a.severity, priority: a.priority, count: a.count, fix: a.fix }));
  const quiet =
    !newIssues.length && !resolved.length && !worse.length && !better.length && !broke.length && !recovered.length && !title.length && !description.length && !noindexAdded.length && !noindexRemoved.length && before === after;
  return {
    fromId,
    toId,
    score: { before, after, delta: before != null && after != null ? after - before : null },
    grade: { before: prev.scores?.grade ?? null, after: curr.scores?.grade ?? null },
    pages: { before: prev.pages.length, after: curr.pages.length },
    newIssues: newIssues.sort(bySeverity),
    resolved: resolved.sort(bySeverity),
    worse: worse.sort(bySeverity),
    better: better.sort(bySeverity),
    pageChanges: {
      found: found.slice(0, LIST), notReached: notReached.slice(0, LIST), broke: broke.slice(0, LIST), recovered: recovered.slice(0, LIST),
      title: title.slice(0, LIST), description: description.slice(0, LIST), noindexAdded: noindexAdded.slice(0, LIST), noindexRemoved: noindexRemoved.slice(0, LIST), content: content.slice(0, LIST), counts,
    },
    todo,
    quiet,
  };
}

/** One-line summary for notifications. */
export function diffHeadline(d: AuditDiff): string {
  const parts: string[] = [];
  if (d.score.delta) parts.push(`score ${d.score.delta > 0 ? "up" : "down"} ${Math.abs(d.score.delta)} to ${d.score.after}`);
  if (d.newIssues.length) parts.push(`${d.newIssues.length} new issue${d.newIssues.length === 1 ? "" : "s"}`);
  if (d.worse.length) parts.push(`${d.worse.length} got worse`);
  if (d.resolved.length) parts.push(`${d.resolved.length} fixed`);
  if (d.pageChanges.counts.broke) parts.push(`${d.pageChanges.counts.broke} page${d.pageChanges.counts.broke === 1 ? "" : "s"} now broken`);
  const edits = d.pageChanges.counts.title + d.pageChanges.counts.description;
  if (edits) parts.push(`${edits} title/description edit${edits === 1 ? "" : "s"}`);
  if (!parts.length) return "No SEO changes since the last audit";
  const s = parts.join(", ");
  return s[0].toUpperCase() + s.slice(1);
}
