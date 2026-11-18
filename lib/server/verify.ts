import "server-only";
import { resolveSecret } from "./secrets";

export interface VerifyResult {
  service: "pagespeed" | "dataforseo";
  ok: boolean;
  status: "valid" | "missing" | "invalid" | "api_disabled" | "rate_limited" | "unreachable" | "error";
  message: string;
}

async function timedFetch(url: string, init: RequestInit = {}, ms = 90000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ac.signal, cache: "no-store" });
  } finally {
    clearTimeout(t);
  }
}

/**
 * One real PageSpeed request with the configured key (one call against the key's daily
 * quota of 25,000). Distinguishes a bad key, a disabled API and rate limits.
 */
export async function verifyPagespeed(): Promise<VerifyResult> {
  const key = resolveSecret("PAGESPEED_API_KEY");
  if (!key) {
    return {
      service: "pagespeed",
      ok: false,
      status: "missing",
      message: "No PAGESPEED_API_KEY is configured. Without it PageSpeed uses Google's shared unkeyed quota and is often rate limited (HTTP 429).",
    };
  }
  const url =
    "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=" +
    encodeURIComponent("https://www.google.com/") +
    "&strategy=mobile&category=performance&key=" +
    encodeURIComponent(key);
  let res: Response;
  try {
    res = await timedFetch(url);
  } catch (e) {
    return { service: "pagespeed", ok: false, status: "unreachable", message: `Could not reach Google (${(e as Error).name}). Check this machine's internet connection or proxy.` };
  }
  if (res.ok) {
    return { service: "pagespeed", ok: true, status: "valid", message: "Key works: Google returned a PageSpeed result. Re-run your audit to get Core Web Vitals." };
  }
  const body = (await res.json().catch(() => null)) as { error?: { message?: string; details?: Array<{ reason?: string }> } } | null;
  const msg = body?.error?.message ?? `HTTP ${res.status}`;
  const reason = body?.error?.details?.map((d) => d.reason).join(",") ?? "";
  if (res.status === 400 && /API key not valid|API_KEY_INVALID/i.test(msg + reason)) {
    return { service: "pagespeed", ok: false, status: "invalid", message: "Google rejected the key (API key not valid). Copy it again from Google Cloud Console > APIs & Services > Credentials." };
  }
  if (res.status === 403) {
    return {
      service: "pagespeed",
      ok: false,
      status: "api_disabled",
      message: `Google refused the key: ${msg} Enable "PageSpeed Insights API" for the key's project and check the key's API restrictions allow it.`,
    };
  }
  if (res.status === 429) {
    return { service: "pagespeed", ok: false, status: "rate_limited", message: "This key's own quota is exhausted. Wait a minute, or check the quota page in Google Cloud Console." };
  }
  return { service: "pagespeed", ok: false, status: "error", message: `Unexpected response from Google: ${msg}` };
}

/** DataForSEO's account endpoint is free: it validates the login and returns the balance. */
export async function verifyDataforseo(): Promise<VerifyResult> {
  const user = resolveSecret("DATAFORSEO_USERNAME");
  const pass = resolveSecret("DATAFORSEO_PASSWORD");
  if (!user || !pass) return { service: "dataforseo", ok: false, status: "missing", message: "DATAFORSEO_USERNAME and DATAFORSEO_PASSWORD are both needed." };
  let res: Response;
  try {
    res = await timedFetch(
      "https://api.dataforseo.com/v3/appendix/user_data",
      { headers: { Authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}` } },
      30000,
    );
  } catch (e) {
    return { service: "dataforseo", ok: false, status: "unreachable", message: `Could not reach DataForSEO (${(e as Error).name}).` };
  }
  if (res.status === 401) {
    return { service: "dataforseo", ok: false, status: "invalid", message: "DataForSEO rejected the login (HTTP 401). Use the API login and password from the DataForSEO dashboard." };
  }
  const body = (await res.json().catch(() => null)) as {
    status_code?: number;
    status_message?: string;
    tasks?: Array<{ result?: Array<{ money?: { balance?: number } }> }>;
  } | null;
  if (!res.ok || !body || body.status_code !== 20000) {
    return { service: "dataforseo", ok: false, status: "error", message: `DataForSEO answered: ${body?.status_message ?? `HTTP ${res.status}`}` };
  }
  const balance = body.tasks?.[0]?.result?.[0]?.money?.balance;
  return { service: "dataforseo", ok: true, status: "valid", message: `Login works.${balance != null ? ` Account balance: $${balance.toFixed(2)}.` : ""}` };
}
