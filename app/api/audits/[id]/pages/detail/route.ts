import { handle, json, problem, type RouteCtx } from "@/lib/server/http";
import { pageDetail } from "@/lib/server/results";

export const dynamic = "force-dynamic";

/** GET /api/audits/{id}/pages/detail?url=<page url> (lazy-loaded per page) */
export const GET = handle(async (req: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  const url = new URL(req.url).searchParams.get("url");
  if (!url) return problem(400, "Missing url parameter.");
  const d = pageDetail(id, url);
  return d ? json(d) : problem(404, "Page not found in this audit.");
});
