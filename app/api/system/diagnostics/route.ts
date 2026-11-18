import { handle, json } from "@/lib/server/http";
import { diagnostics } from "@/lib/server/diagnostics";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = handle(async (req: Request) => {
  const force = new URL(req.url).searchParams.get("refresh") === "1";
  return json(await diagnostics(force));
});
