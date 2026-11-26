import { handle, json, problem, type RouteCtx } from "@/lib/server/http";
import { readSnapshot } from "@/lib/server/gsc";
import { readMonitor } from "@/lib/server/monitor";
import { indexing, kpis, opportunities, series } from "@/lib/gsc-insights";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/gsc/sites/{domain}?days=7|28|90 -> everything the Search Console page shows for one site. */
export const GET = handle(async (req: Request, ctx: RouteCtx<{ domain: string }>) => {
  const { domain } = await ctx.params;
  if (!readMonitor().sites.some((s) => s.domain === domain)) return problem(404, "Site is not monitored.");
  const days = [7, 28, 90].includes(Number(new URL(req.url).searchParams.get("days"))) ? Number(new URL(req.url).searchParams.get("days")) : 28;
  const snap = readSnapshot(domain);
  if (!snap || !snap.endDate) return json({ domain, synced: false, error: snap?.error ?? null, fetchedAt: snap?.fetchedAt ?? null, property: snap?.property ?? null });
  const r = snap.ranges[String(days)];
  const ix = indexing(snap);
  return json({
    domain,
    synced: true,
    property: snap.property,
    fetchedAt: snap.fetchedAt,
    error: snap.error,
    endDate: snap.endDate,
    days,
    kpis: kpis(snap, days),
    series: series(snap, days),
    history: snap.daily,
    queries: r?.queries.slice(0, 500) ?? [],
    pages: r?.pages.slice(0, 500) ?? [],
    countries: snap.countries,
    devices: snap.devices,
    appearance: snap.appearance,
    searchTypes: snap.searchTypes,
    opportunities: opportunities(snap, days),
    indexing: { ...ix, list: ix.list },
    sitemaps: snap.sitemaps,
    alerts: snap.alerts,
  });
});
