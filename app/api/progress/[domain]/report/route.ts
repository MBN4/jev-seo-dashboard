import { handle, problem, type RouteCtx } from "@/lib/server/http";
import { readMonitor } from "@/lib/server/monitor";
import { readGscRecords, readRecords } from "@/lib/server/history";
import { buildProgress, progressMarkdown } from "@/lib/issue-progress";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/progress/{domain}/report -> Markdown progress report (download). */
export const GET = handle(async (_req: Request, ctx: RouteCtx<{ domain: string }>) => {
  const { domain } = await ctx.params;
  if (!readMonitor().sites.some((s) => s.domain === domain)) return problem(404, "Site is not monitored.");
  const p = buildProgress(domain, readRecords(domain), readGscRecords(domain));
  const name = `rankora-progress-${domain.replace(/[^a-z0-9.-]/gi, "_")}-${p.latest?.date ?? "empty"}.md`;
  return new Response(progressMarkdown(p), {
    headers: { "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
  });
});
