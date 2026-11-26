import { handle, json } from "@/lib/server/http";
import { monitorOverview } from "@/lib/server/monitor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/monitor -> monitored sites (last audit, next run, history) and the change feed. */
export const GET = handle(async () => json(monitorOverview()));
