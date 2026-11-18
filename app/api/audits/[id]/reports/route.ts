import { handle, json, problem, type RouteCtx } from "@/lib/server/http";
import { availableReports, getAuditSummary } from "@/lib/server/audits";

export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  if (!getAuditSummary(id)) return problem(404, "Audit not found.");
  return json({ items: availableReports(id) });
});
