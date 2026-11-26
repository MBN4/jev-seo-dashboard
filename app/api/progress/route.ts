import { handle, json } from "@/lib/server/http";
import { readMonitor } from "@/lib/server/monitor";
import { readGscRecords, readRecords } from "@/lib/server/history";
import { buildProgress } from "@/lib/issue-progress";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/progress -> per site: latest report, open issues by priority, fixed and new since the last report. */
export const GET = handle(async () => {
  const sites = readMonitor().sites.map((s) => {
    const p = buildProgress(s.domain, readRecords(s.domain), readGscRecords(s.domain));
    return {
      domain: s.domain,
      url: s.url,
      reports: p.reports,
      latest: p.latest,
      previous: p.previous,
      open: p.open.length,
      openByTier: p.openByTier,
      fixedSinceLast: p.sinceLast?.fixed.length ?? null,
      newSinceLast: p.sinceLast?.newIssues.length ?? null,
      fixedEver: p.totals.fixedEver,
    };
  });
  return json({ sites });
});
