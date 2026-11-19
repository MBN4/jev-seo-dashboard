import { z } from "zod";
import { handle, json, problem, readJson, type RouteCtx } from "@/lib/server/http";
import { getAuditSummary } from "@/lib/server/audits";
import { readState, updateState } from "@/lib/server/state";
import { keywordsSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

/** GET /api/audits/{id}/keywords -> { keywords } */
export const GET = handle(async (_req: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  if (!getAuditSummary(id)) return problem(404, "Audit not found.");
  return json({ keywords: readState().keywords[id] ?? [] });
});

/** PUT /api/audits/{id}/keywords { keywords: string[] (max 10) } — works for imported audits too. */
export const PUT = handle(async (req: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  if (!getAuditSummary(id)) return problem(404, "Audit not found.");
  const { keywords } = z.object({ keywords: keywordsSchema }).parse(await readJson(req));
  const clean = [...new Set(keywords.map((k) => k.trim()).filter(Boolean))];
  await updateState((s) => {
    if (clean.length) s.keywords[id] = clean;
    else delete s.keywords[id];
  });
  return json({ keywords: clean });
});
