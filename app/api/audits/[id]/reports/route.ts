import { handle, json, problem, type RouteCtx } from "@/lib/server/http";
import { availableReports, getAuditSummary } from "@/lib/server/audits";
import { brandedReady, isBuilding, prebuildBranded } from "@/lib/server/branding";

export const dynamic = "force-dynamic";

/** GET /api/audits/{id}/reports -> { items, branded: { ready, building } } (starts a branded build if needed) */
export const GET = handle(async (_req: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  const s = getAuditSummary(id);
  if (!s) return problem(404, "Audit not found.");
  const items = availableReports(id);
  let ready = brandedReady(id);
  if (!ready && s.hasResults && s.status !== "running" && items.some((r) => r.type !== "json")) {
    if (!isBuilding(id)) prebuildBranded(id);
    ready = brandedReady(id);
  }
  return json({ items, branded: { ready, building: isBuilding(id) } });
});
