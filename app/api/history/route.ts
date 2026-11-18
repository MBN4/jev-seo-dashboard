import { handle, json } from "@/lib/server/http";
import { listAudits } from "@/lib/server/audits";
import { scoreHistory } from "@/lib/server/results";

export const dynamic = "force-dynamic";

/** GET /api/history?domain= : score history from saved, completed audits only. */
export const GET = handle(async (req: Request) => {
  const domain = new URL(req.url).searchParams.get("domain") ?? undefined;
  const all = listAudits();
  return json({ domains: [...new Set(all.map((a) => a.domain))], points: scoreHistory(all, domain) });
});
