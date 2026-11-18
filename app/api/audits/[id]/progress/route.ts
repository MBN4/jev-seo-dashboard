import { handle, json, problem, type RouteCtx } from "@/lib/server/http";
import { progressSnapshot } from "@/lib/server/progress";

export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  const snap = progressSnapshot(id);
  return snap ? json(snap) : problem(404, "Audit not found.");
});
