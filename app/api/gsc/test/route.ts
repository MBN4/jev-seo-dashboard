import { handle, json } from "@/lib/server/http";
import { GscError, gscCredentialStatus, listProperties, matchProperty } from "@/lib/server/gsc";
import { readMonitor } from "@/lib/server/monitor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /api/gsc/test -> live check: which properties the service account can read, matched to your sites. */
export const POST = handle(async () => {
  try {
    const props = await listProperties();
    const sites = readMonitor().sites.map((s) => ({ domain: s.domain, property: matchProperty(s.domain, props) }));
    return json({ ok: true, clientEmail: gscCredentialStatus().clientEmail, properties: props, sites });
  } catch (e) {
    if (e instanceof GscError) return json({ ok: false, clientEmail: gscCredentialStatus().clientEmail, error: e.message, properties: [], sites: [] });
    throw e;
  }
});
