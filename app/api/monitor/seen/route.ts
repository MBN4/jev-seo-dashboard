import { z } from "zod";
import { handle, json, readJson } from "@/lib/server/http";
import { markSeen } from "@/lib/server/monitor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /api/monitor/seen { ids?: string[] } -> mark change events as read (all when ids is omitted). */
export const POST = handle(async (req: Request) => {
  const { ids } = z.object({ ids: z.array(z.string().max(64)).max(300).optional() }).parse(await readJson(req));
  await markSeen(ids);
  return json({ ok: true });
});
