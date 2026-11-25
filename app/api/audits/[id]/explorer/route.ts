import { handle, json, type RouteCtx } from "@/lib/server/http";
import { explorerOverview } from "@/lib/server/explorer";

export const dynamic = "force-dynamic";

/** GET /api/audits/{id}/explorer -> tabs with per-filter counts, plus an issues list across tabs */
export const GET = handle(async (_req: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  return json(explorerOverview(id));
});
