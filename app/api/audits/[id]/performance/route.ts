import { handle, json, type RouteCtx } from "@/lib/server/http";
import { performance } from "@/lib/server/results";

export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  return json(performance(id));
});
