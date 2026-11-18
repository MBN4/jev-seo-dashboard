import { handle, json, type RouteCtx } from "@/lib/server/http";
import { cancelJob } from "@/lib/server/jobs";

export const dynamic = "force-dynamic";

export const POST = handle(async (_req: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  const job = cancelJob(id);
  return json({ id, status: job.status, cancelRequested: job.cancelRequested });
});
