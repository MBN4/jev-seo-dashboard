import { handle, json, problem, type RouteCtx } from "@/lib/server/http";
import { getAuditSummary } from "@/lib/server/audits";
import { isTerminal, readJob } from "@/lib/server/jobs";
import { updateState } from "@/lib/server/state";

export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  const s = getAuditSummary(id);
  return s ? json(s) : problem(404, "Audit not found.");
});

/**
 * DELETE /api/audits/{id}: remove the entry from dashboard history only.
 * The report folder on disk is NOT deleted; it can be restored via POST /api/audits/import.
 */
export const DELETE = handle(async (_req: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  const s = getAuditSummary(id);
  if (!s) return problem(404, "Audit not found.");
  const job = readJob(id);
  if (job && !isTerminal(job.status)) return problem(409, "Cancel the running audit before removing it from history.");
  await updateState((st) => {
    st.hidden[id] = new Date().toISOString();
  });
  return json({ id, hidden: true, filesDeleted: false });
});
