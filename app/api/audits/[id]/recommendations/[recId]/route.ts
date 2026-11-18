import { handle, json, problem, readJson, type RouteCtx } from "@/lib/server/http";
import { recommendations } from "@/lib/server/results";
import { updateState } from "@/lib/server/state";
import { recommendationUpdateSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/audits/{id}/recommendations/{recId} { status?, notes? }
 * Stored in the dashboard's state.json, never in the immutable audit.json.
 */
export const PATCH = handle(async (req: Request, ctx: RouteCtx<{ id: string; recId: string }>) => {
  const { id, recId } = await ctx.params;
  const key = decodeURIComponent(recId);
  const patch = recommendationUpdateSchema.parse(await readJson(req));
  const rec = recommendations(id).find((r) => r.key === key);
  if (!rec) return problem(404, "Recommendation not found in this audit.");
  const saved = await updateState((s) => {
    const forAudit = (s.recommendations[id] ??= {});
    const prev = forAudit[key] ?? { status: "pending", notes: "", updatedAt: "" };
    forAudit[key] = { status: patch.status ?? prev.status, notes: patch.notes ?? prev.notes, updatedAt: new Date().toISOString() };
    return forAudit[key];
  });
  return json({ key, ...saved });
});
