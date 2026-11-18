import { z } from "zod";
import { handle, json, readJson } from "@/lib/server/http";
import { verifyDataforseo, verifyPagespeed } from "@/lib/server/verify";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const body = z.object({ service: z.enum(["pagespeed", "dataforseo"]) });

/** POST /api/settings/verify { service } -> live credential check; never returns the key. */
export const POST = handle(async (req: Request) => {
  const { service } = body.parse(await readJson(req));
  return json(service === "pagespeed" ? await verifyPagespeed() : await verifyDataforseo());
});
