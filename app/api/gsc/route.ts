import { handle, json } from "@/lib/server/http";
import { gscCredentialStatus, readSnapshot } from "@/lib/server/gsc";
import { readMonitor } from "@/lib/server/monitor";
import { kpis } from "@/lib/gsc-insights";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/gsc -> connection status and a 28-day summary per monitored site. Never returns the key. */
export const GET = handle(async () => {
  const sites = readMonitor().sites.map((s) => {
    const snap = readSnapshot(s.domain);
    const k = snap?.endDate ? kpis(snap, 28) : null;
    return { domain: s.domain, url: s.url, property: snap?.property ?? null, fetchedAt: snap?.fetchedAt ?? null, error: snap?.error ?? null, alerts: snap?.alerts.length ?? 0, kpis: k };
  });
  return json({ connection: gscCredentialStatus(), sites });
});
