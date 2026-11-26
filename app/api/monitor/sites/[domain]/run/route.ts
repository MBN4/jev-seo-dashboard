import { handle, json, problem, type RouteCtx } from "@/lib/server/http";
import { runNow, tick } from "@/lib/server/monitor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /api/monitor/sites/{domain}/run -> audit this site now (queued if another audit is running). */
export const POST = handle(async (_req: Request, ctx: RouteCtx<{ domain: string }>) => {
  const { domain } = await ctx.params;
  if (!(await runNow(domain))) return problem(404, "Site is not monitored.");
  void tick().catch(() => undefined);
  return json({ queued: true }, 202);
});
