import fs from "node:fs";
import path from "node:path";
import { handle, json, problem, type RouteCtx } from "@/lib/server/http";
import { readMonitor } from "@/lib/server/monitor";
import { historyBytes, readGscRecords, readRecords } from "@/lib/server/history";
import { listAudits } from "@/lib/server/audits";
import { auditFolder } from "@/lib/server/paths";
import { buildProgress } from "@/lib/issue-progress";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function folderBytes(dir: string): number {
  let total = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    try {
      total += e.isDirectory() ? folderBytes(p) : fs.statSync(p).size;
    } catch {
      /* ignore */
    }
  }
  return total;
}

/** GET /api/progress/{domain} -> full progress (fixed, new, still open, timeline, fix log) plus storage use. */
export const GET = handle(async (_req: Request, ctx: RouteCtx<{ domain: string }>) => {
  const { domain } = await ctx.params;
  const m = readMonitor();
  if (!m.sites.some((s) => s.domain === domain)) return problem(404, "Site is not monitored.");
  const p = buildProgress(domain, readRecords(domain), readGscRecords(domain));
  const audits = listAudits({ includeHidden: true }).filter((a) => a.domain === domain && a.hasResults);
  let auditBytes = 0;
  for (const a of audits) {
    const f = auditFolder(a.id);
    if (f) auditBytes += folderBytes(f);
  }
  // Trim URL lists in the response; the report and drawer show samples.
  const trim = <T extends { urls: string[] }>(x: T) => ({ ...x, urls: x.urls.slice(0, 50), urlCount: x.urls.length });
  return json({
    ...p,
    open: p.open.map((i) => ({ ...trim(i), pagesFixed: i.pagesFixed.slice(0, 50), pagesFixedCount: i.pagesFixed.length, pagesNew: i.pagesNew.slice(0, 50), pagesNewCount: i.pagesNew.length })),
    fixLog: p.fixLog.slice(0, 200).map(trim),
    sinceLast: p.sinceLast && { ...p.sinceLast, fixed: p.sinceLast.fixed.map(trim), newIssues: p.sinceLast.newIssues.map((i) => i.id), worse: p.sinceLast.worse.map((i) => i.id), better: p.sinceLast.better.map((i) => i.id) },
    intended: p.intended.map(trim),
    storage: { audits: audits.length, auditBytes, historyBytes: historyBytes(domain), keepAuditDays: m.keepAuditDays },
  });
});
