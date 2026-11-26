import { z } from "zod";
import { handle, json, readJson } from "@/lib/server/http";
import { addSite } from "@/lib/server/monitor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /api/monitor/sites { url } -> start monitoring a site (daily by default). */
export const POST = handle(async (req: Request) => {
  const { url } = z.object({ url: z.string().min(1).max(2048) }).parse(await readJson(req));
  return json(await addSite(url), 201);
});
