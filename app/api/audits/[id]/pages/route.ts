import { handle, json, type RouteCtx } from "@/lib/server/http";
import { pages, type PageQuery, type PageRow } from "@/lib/server/results";

export const dynamic = "force-dynamic";

const SORTABLE = new Set<keyof PageRow>(["url", "status", "title", "wordCount", "indexable", "depth", "inlinks", "internalLinks", "issueCount", "ttfbMs"]);

/** GET /api/audits/{id}/pages?q=&status=2xx&indexable=yes&issues=with&sort=&dir=&page=&pageSize= */
export const GET = handle(async (req: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  const sp = new URL(req.url).searchParams;
  const sort = sp.get("sort") as keyof PageRow | null;
  const q: PageQuery = {
    q: sp.get("q") ?? undefined,
    status: sp.get("status") ?? undefined,
    indexable: (sp.get("indexable") as PageQuery["indexable"]) ?? undefined,
    issues: (sp.get("issues") as PageQuery["issues"]) ?? undefined,
    sort: sort && SORTABLE.has(sort) ? sort : undefined,
    dir: sp.get("dir") === "desc" ? "desc" : "asc",
    page: Number(sp.get("page")) || 1,
    pageSize: Number(sp.get("pageSize")) || 25,
  };
  return json(pages(id, q));
});
