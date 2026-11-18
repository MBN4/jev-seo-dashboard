import { handle, json, problem, type RouteCtx } from "@/lib/server/http";
import { finding } from "@/lib/server/results";

export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, ctx: RouteCtx<{ id: string; findingId: string }>) => {
  const { id, findingId } = await ctx.params;
  const f = finding(id, decodeURIComponent(findingId));
  return f ? json(f) : problem(404, "Finding not found.");
});
