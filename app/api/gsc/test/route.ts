import { handle, json } from "@/lib/server/http";
import { GscError, gscCredentialStatus, listProperties, matchProperty, readSnapshot } from "@/lib/server/gsc";
import { readMonitor, syncSearchConsole } from "@/lib/server/monitor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /api/gsc/test -> live check: which properties the service account can read, matched to your sites. */
export const POST = handle(async () => {
  try {
    const props = await listProperties();
    const sites = readMonitor().sites.map((s) => ({ domain: s.domain, property: matchProperty(s.domain, props) }));
    // Access may have just been granted: re-sync, in the background, sites whose last sync failed
    // or that were never synced, now that their property is readable.
    const retry = sites.filter((s) => s.property && (!readSnapshot(s.domain)?.endDate || readSnapshot(s.domain)?.error)).map((s) => s.domain);
    if (retry.length) void (async () => { for (const d of retry) await syncSearchConsole(d).catch(() => undefined); })();
    return json({ ok: true, clientEmail: gscCredentialStatus().clientEmail, properties: props, sites, resyncing: retry });
  } catch (e) {
    if (e instanceof GscError) return json({ ok: false, clientEmail: gscCredentialStatus().clientEmail, error: e.message, properties: [], sites: [] });
    throw e;
  }
});
