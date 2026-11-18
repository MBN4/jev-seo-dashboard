import { handle, json, type RouteCtx } from "@/lib/server/http";
import { findings, type FindingQuery } from "@/lib/server/results";

export const dynamic = "force-dynamic";

/** GET /api/audits/{id}/findings?severity=high&category=crawl&origin=rule&q=&sort=severity&dir=desc&page=1&pageSize=25 */
export const GET = handle(async (req: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  const sp = new URL(req.url).searchParams;
  const sort = sp.get("sort");
  const q: FindingQuery = {
    severity: sp.getAll("severity").filter(Boolean),
    category: sp.getAll("category").filter(Boolean),
    origin: sp.getAll("origin").filter(Boolean),
    q: sp.get("q") ?? undefined,
    sort: sort === "count" || sort === "title" || sort === "category" ? sort : "severity",
    dir: sp.get("dir") === "asc" ? "asc" : "desc",
    page: Number(sp.get("page")) || 1,
    pageSize: Number(sp.get("pageSize")) || 25,
  };
  return json(findings(id, q));
});
