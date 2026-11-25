import fs from "node:fs";
import { Readable } from "node:stream";
import { problem, type RouteCtx } from "@/lib/server/http";
import { REPORT_FILES, reportPath } from "@/lib/server/paths";
import { readJob, isTerminal } from "@/lib/server/jobs";
import { loadAudit } from "@/lib/server/audits";
import { brandedErrors, brandedFile, ensureBranded, type BrandedType } from "@/lib/server/branding";
import { BRAND } from "@/lib/brand";
import type { ReportType } from "@/types/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * GET /api/audits/{id}/reports/{type}[?inline=1]
 * Serves Rankora-branded copies of the engine's reports (built on first request if needed) and
 * Rankora's own JSON export. Only fixed file names inside registered folders are ever read.
 */
export async function GET(req: Request, ctx: RouteCtx<{ id: string; type: string }>) {
  const { id, type } = await ctx.params;
  if (!(type in REPORT_FILES)) return problem(404, "Unknown report type.");
  const job = readJob(id);
  if (job && !isTerminal(job.status)) return problem(409, "Reports are still being generated.");
  if (!reportPath(id, type as ReportType)) return problem(404, "This report was not generated for this audit.");
  const spec = REPORT_FILES[type as ReportType];
  const slug = BRAND.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const inline = new URL(req.url).searchParams.get("inline") === "1" && (type === "pdf" || type === "md" || type === "digest");
  const headers = (size: number, name: string) => ({
    "Content-Type": spec.mime,
    "Content-Length": String(size),
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${`${slug}-${id}-${name}`.replace(/[^A-Za-z0-9._-]/g, "_")}"`,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store",
    ...(type === "md" || type === "digest" ? { "Content-Security-Policy": "default-src 'none'" } : {}),
  });

  if (type === "json") {
    // Rankora's own export: the audit after translation to Rankora's model (no engine branding).
    const audit = loadAudit(id);
    if (!audit) return problem(404, "Audit not found.");
    const body = Buffer.from(JSON.stringify({ exported_by: BRAND.name, ...audit }, null, 1));
    return new Response(body, { headers: headers(body.length, "audit.json") });
  }

  try {
    await ensureBranded(id);
  } catch (e) {
    console.error("[rankora] branding failed", id, (e as Error).message);
    return problem(500, "The branded report could not be prepared. Check Settings > Diagnostics (engine Python and WeasyPrint).");
  }
  const file = brandedFile(id, type as BrandedType);
  if (!file) {
    const why = brandedErrors(id)[type as BrandedType];
    if (why) return problem(500, `The branded ${type.toUpperCase()} could not be prepared (${why.split(":")[0]}). Check Settings > Diagnostics.`);
    return problem(404, "This report was not generated for this audit.");
  }
  const stat = fs.statSync(file);
  return new Response(Readable.toWeb(fs.createReadStream(file)) as ReadableStream, { headers: headers(stat.size, spec.filename) });
}
