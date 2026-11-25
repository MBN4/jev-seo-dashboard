import { handle, json, type RouteCtx } from "@/lib/server/http";
import { explorerCsv, explorerRows } from "@/lib/server/explorer";
import { BRAND } from "@/lib/brand";

export const dynamic = "force-dynamic";

/** GET /api/audits/{id}/explorer/{tab}?filter=&q=&sort=&dir=&page=&pageSize=[&format=csv] */
export const GET = handle(async (req: Request, ctx: RouteCtx<{ id: string; tab: string }>) => {
  const { id, tab } = await ctx.params;
  const sp = new URL(req.url).searchParams;
  const query = {
    tab,
    filter: sp.get("filter") || undefined,
    q: sp.get("q") || undefined,
    sort: sp.get("sort") || undefined,
    dir: (sp.get("dir") === "desc" ? "desc" : "asc") as "asc" | "desc",
    page: Number(sp.get("page")) || 1,
    pageSize: Number(sp.get("pageSize")) || 50,
  };
  if (sp.get("format") === "csv") {
    const body = explorerCsv(id, query);
    const name = `${BRAND.name.toLowerCase()}-${id}-${tab}${query.filter ? `-${query.filter}` : ""}.csv`.replace(/[^A-Za-z0-9._-]/g, "_");
    return new Response(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  }
  const { all: _all, ...res } = explorerRows(id, query);
  void _all;
  return json(res);
});
