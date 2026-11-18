import fs from "node:fs";
import { Readable } from "node:stream";
import { problem, type RouteCtx } from "@/lib/server/http";
import { REPORT_FILES, reportPath } from "@/lib/server/paths";
import { readJob, isTerminal } from "@/lib/server/jobs";
import type { ReportType } from "@/types/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/audits/{id}/reports/{type}[?inline=1]
 * Serves only fixed report filenames inside a registered audit folder (no user paths).
 */
export async function GET(req: Request, ctx: RouteCtx<{ id: string; type: string }>) {
  const { id, type } = await ctx.params;
  if (!(type in REPORT_FILES)) return problem(404, "Unknown report type.");
  const job = readJob(id);
  if (job && !isTerminal(job.status)) return problem(409, "Reports are still being generated.");
  const file = reportPath(id, type as ReportType);
  if (!file) return problem(404, "This report was not generated for this audit.");
  const spec = REPORT_FILES[type as ReportType];
  const stat = fs.statSync(file);
  const inline = new URL(req.url).searchParams.get("inline") === "1" && (type === "pdf" || type === "md" || type === "digest");
  const downloadName = `${id}-${spec.filename}`.replace(/[^A-Za-z0-9._-]/g, "_");
  const body = Readable.toWeb(fs.createReadStream(file)) as ReadableStream;
  return new Response(body, {
    headers: {
      "Content-Type": spec.mime,
      "Content-Length": String(stat.size),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${downloadName}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
      ...(type === "md" || type === "digest" ? { "Content-Security-Policy": "default-src 'none'" } : {}),
    },
  });
}
