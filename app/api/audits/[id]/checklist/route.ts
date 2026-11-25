import { handle, json, type RouteCtx } from "@/lib/server/http";
import { checklistFor } from "@/lib/server/checklist";

export const dynamic = "force-dynamic";

/** GET /api/audits/{id}/checklist -> Google guidelines checklist graded from this audit's real results */
export const GET = handle(async (_req: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  return json(checklistFor(id));
});
