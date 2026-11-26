import { z } from "zod";
import { handle, json, readJson } from "@/lib/server/http";
import { setRetention } from "@/lib/server/monitor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * PATCH /api/monitor/settings { keepAuditDays: null | 14 | 30 | 90 | 180 | 365 }
 * How long to keep the full files of scheduled audits. Daily history records are always kept.
 */
export const PATCH = handle(async (req: Request) => {
  const { keepAuditDays } = z.object({ keepAuditDays: z.union([z.null(), z.literal(14), z.literal(30), z.literal(90), z.literal(180), z.literal(365)]) }).parse(await readJson(req));
  return json({ keepAuditDays: await setRetention(keepAuditDays) });
});
