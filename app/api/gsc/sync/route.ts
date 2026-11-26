import { z } from "zod";
import { handle, json, readJson } from "@/lib/server/http";
import { GscError } from "@/lib/server/gsc";
import { readMonitor, syncSearchConsole } from "@/lib/server/monitor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const g = globalThis as unknown as { __gscSyncAll?: boolean };

/**
 * POST /api/gsc/sync { domain? } -> refresh Search Console data now.
 * With a domain it waits for that site (usually under a minute). Without one, every site is synced
 * in the background and the response returns at once.
 */
export const POST = handle(async (req: Request) => {
  const { domain } = z.object({ domain: z.string().max(253).optional() }).parse(await readJson(req));
  if (domain) {
    try {
      const r = await syncSearchConsole(domain);
      return json({ ok: true, fetchedAt: r.snapshot.fetchedAt, newAlerts: r.newAlerts });
    } catch (e) {
      if (e instanceof GscError) return json({ ok: false, error: e.message }, 200);
      throw e;
    }
  }
  if (!g.__gscSyncAll) {
    g.__gscSyncAll = true;
    void (async () => {
      for (const s of readMonitor().sites) await syncSearchConsole(s.domain).catch(() => undefined);
    })().finally(() => (g.__gscSyncAll = false));
  }
  return json({ ok: true, started: true }, 202);
});
