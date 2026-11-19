import { handle, json, type RouteCtx } from "@/lib/server/http";
import { requireAudit } from "@/lib/server/results";
import { readState } from "@/lib/server/state";
import { runExtraChecks } from "@/lib/server/extra-checks";

export const dynamic = "force-dynamic";

/**
 * GET /api/audits/{id}/extra
 * Dashboard-side checks computed from the saved audit.json (engine untouched, score unchanged).
 */
export const GET = handle(async (_req: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  const audit = requireAudit(id);
  return json(runExtraChecks(audit, readState().keywords[id] ?? []));
});
