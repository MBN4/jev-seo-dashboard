import { z } from "zod";
import { handle, json, problem, readJson, type RouteCtx } from "@/lib/server/http";
import { INTERVALS, removeSite, updateSite } from "@/lib/server/monitor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const patch = z.object({
  enabled: z.boolean().optional(),
  intervalHours: z.number().int().refine((n) => (INTERVALS as readonly number[]).includes(n), "Choose 6, 12, 24, 48 or 168 hours.").optional(),
});

/** PATCH /api/monitor/sites/{domain} { enabled?, intervalHours? } */
export const PATCH = handle(async (req: Request, ctx: RouteCtx<{ domain: string }>) => {
  const { domain } = await ctx.params;
  const site = await updateSite(domain, patch.parse(await readJson(req)));
  return site ? json(site) : problem(404, "Site is not monitored.");
});

/** DELETE /api/monitor/sites/{domain} -> stop monitoring (audits are kept). */
export const DELETE = handle(async (_req: Request, ctx: RouteCtx<{ domain: string }>) => {
  const { domain } = await ctx.params;
  return (await removeSite(domain)) ? json({ removed: true }) : problem(404, "Site is not monitored.");
});
