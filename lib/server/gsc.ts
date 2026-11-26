import "server-only";
import fs from "node:fs";
import path from "node:path";
import { createPrivateKey, createSign } from "node:crypto";
import { dataDir, ensureDir, setting } from "./config";
import { writeAtomic } from "./state";
import { computeAlerts, type GscAlert, type GscSnapshot, type Inspection, type MetricRow } from "@/lib/gsc-insights";

/**
 * Google Search Console, read-only, through a Google Cloud service account.
 *
 * The service account's JSON key is stored in data/gsc/service-account.json (mode 600) and is
 * never returned by any API route. The account must be added as a user on each Search Console
 * property. Requests go only to Google's fixed endpoints below; the key's own token_uri is
 * ignored so a modified key file cannot send a signed token anywhere else.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://www.googleapis.com/webmasters/v3";
const INSPECT_URL = "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect";
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const DAY = 86_400_000;

export const RANGES = [7, 28, 90] as const;
export type RangeDays = (typeof RANGES)[number];
const HISTORY_DAYS = 486; // ~16 months, Search Console's maximum
const INSPECT_LIMIT = 50; // URL Inspection quota is 2,000 per property per day

export class GscError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// ------------------------------------------------------------------ credentials

export interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id?: string;
}

const dashboardKeyFile = () => path.join(dataDir(), "gsc", "service-account.json");
const keyFile = () => setting("GSC_KEY_FILE") ?? dashboardKeyFile();

export function parseServiceAccount(text: string): ServiceAccount {
  let j: Record<string, unknown>;
  try {
    j = JSON.parse(text);
  } catch {
    throw new GscError(422, "That is not valid JSON. Paste the whole key file you downloaded from Google Cloud.");
  }
  if (j.type !== "service_account") throw new GscError(422, 'This is not a service account key (its "type" must be "service_account"). OAuth client files do not work here.');
  const email = String(j.client_email ?? "");
  const key = String(j.private_key ?? "");
  if (!/^[^@\s]+@[^@\s]+\.iam\.gserviceaccount\.com$/.test(email)) throw new GscError(422, "The key has no valid client_email.");
  if (!key.includes("PRIVATE KEY")) throw new GscError(422, "The key has no private_key.");
  try {
    createPrivateKey(key);
  } catch {
    throw new GscError(422, "The private_key in this file could not be read.");
  }
  return { client_email: email, private_key: key, project_id: typeof j.project_id === "string" ? j.project_id : undefined };
}

export function readServiceAccount(): ServiceAccount | null {
  try {
    return parseServiceAccount(fs.readFileSync(keyFile(), "utf8"));
  } catch {
    return null;
  }
}

export function saveServiceAccount(text: string): ServiceAccount {
  const sa = parseServiceAccount(text);
  if (setting("GSC_KEY_FILE")) throw new GscError(409, "The key is set by AUDITPILOT_GSC_KEY_FILE on the server. Change that file instead.");
  ensureDir(path.dirname(dashboardKeyFile()));
  writeAtomic(dashboardKeyFile(), JSON.stringify({ type: "service_account", ...sa }));
  fs.chmodSync(dashboardKeyFile(), 0o600);
  tokens.clear();
  return sa;
}

export function deleteServiceAccount() {
  if (setting("GSC_KEY_FILE")) throw new GscError(409, "The key is set by AUDITPILOT_GSC_KEY_FILE on the server; remove it there.");
  fs.rmSync(dashboardKeyFile(), { force: true });
  tokens.clear();
}

export function gscCredentialStatus() {
  const sa = readServiceAccount();
  return { configured: Boolean(sa), clientEmail: sa?.client_email ?? null, projectId: sa?.project_id ?? null, source: sa ? (setting("GSC_KEY_FILE") ? "server-file" : "dashboard") : null };
}

// ------------------------------------------------------------------ HTTP

export interface GscDeps {
  fetcher?: typeof fetch;
  now?: () => number;
  sa?: ServiceAccount | null;
}

const tokens = new Map<string, { token: string; exp: number }>();
const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

async function accessToken(sa: ServiceAccount, deps: GscDeps): Promise<string> {
  const now = (deps.now ?? Date.now)();
  const cached = tokens.get(sa.client_email);
  if (cached && cached.exp - 60_000 > now) return cached.token;
  const iat = Math.floor(now / 1000);
  const unsigned = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(JSON.stringify({ iss: sa.client_email, scope: SCOPE, aud: TOKEN_URL, iat, exp: iat + 3600 }))}`;
  const sig = createSign("RSA-SHA256").update(unsigned).sign(sa.private_key);
  const res = await (deps.fetcher ?? fetch)(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${b64url(sig)}` }).toString(),
  });
  const j = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!res.ok || !j.access_token) throw new GscError(401, `Google refused the service account key${j.error_description ? `: ${j.error_description}` : ""}. Create a new key in Google Cloud and paste it again.`);
  tokens.set(sa.client_email, { token: j.access_token, exp: now + (j.expires_in ?? 3600) * 1000 });
  return j.access_token;
}

async function call<T>(url: string, deps: GscDeps, body?: unknown): Promise<T> {
  const sa = deps.sa === undefined ? readServiceAccount() : deps.sa;
  if (!sa) throw new GscError(412, "Search Console is not connected. Add the service account key in Settings → Search Console.");
  const token = await accessToken(sa, deps);
  const res = await (deps.fetcher ?? fetch)(url, {
    method: body === undefined ? "GET" : "POST",
    headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.ok) return (await res.json()) as T;
  const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
  const msg = err.error?.message ?? `HTTP ${res.status}`;
  if (res.status === 403 && /not enabled|has not been used|disabled/i.test(msg)) throw new GscError(403, "The Search Console API is not enabled in your Google Cloud project. Enable \"Google Search Console API\" and try again.");
  if (res.status === 403) throw new GscError(403, `The service account (${sa.client_email}) has no access to this property. Add it as a user in Search Console.`);
  if (res.status === 429) throw new GscError(429, "Search Console quota reached. AuditPilot will try again later.");
  throw new GscError(res.status >= 400 && res.status < 600 ? res.status : 502, `Search Console error: ${msg}`);
}

// ------------------------------------------------------------------ API wrappers

export interface Property {
  siteUrl: string;
  permissionLevel: string;
}

export async function listProperties(deps: GscDeps = {}): Promise<Property[]> {
  const r = await call<{ siteEntry?: Property[] }>(`${API}/sites`, deps);
  return (r.siteEntry ?? []).filter((p) => p.permissionLevel !== "siteUnverifiedUser");
}

/** Best property for a domain: a Domain property first, then the https URL-prefix property for the root. */
export function matchProperty(domain: string, props: Property[]): string | null {
  const d = domain.toLowerCase().replace(/^www\./, "");
  const domainProps = props.filter((p) => p.siteUrl.startsWith("sc-domain:")).map((p) => p.siteUrl.slice(10).toLowerCase());
  // Exact domain, or a parent domain property (sc-domain:example.com covers www.example.com)
  const dp = domainProps.find((x) => x === d) ?? domainProps.find((x) => d.endsWith(`.${x}`));
  if (dp) return `sc-domain:${dp}`;
  const prefix = props
    .filter((p) => !p.siteUrl.startsWith("sc-domain:"))
    .filter((p) => {
      try {
        return new URL(p.siteUrl).hostname.toLowerCase().replace(/^www\./, "") === d;
      } catch {
        return false;
      }
    })
    .sort((a, b) => Number(b.siteUrl.startsWith("https:")) - Number(a.siteUrl.startsWith("https:")) || a.siteUrl.length - b.siteUrl.length);
  return prefix[0]?.siteUrl ?? null;
}

interface SaRow {
  keys?: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

async function query(site: string, body: Record<string, unknown>, deps: GscDeps): Promise<SaRow[]> {
  const r = await call<{ rows?: SaRow[] }>(`${API}/sites/${encodeURIComponent(site)}/searchAnalytics/query`, deps, { dataState: "all", ...body });
  return r.rows ?? [];
}

const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

export function periods(endMs: number, days: number) {
  const end = endMs;
  const start = end - (days - 1) * DAY;
  const pEnd = start - DAY;
  const pStart = pEnd - (days - 1) * DAY;
  return { current: { start: iso(start), end: iso(end) }, previous: { start: iso(pStart), end: iso(pEnd) } };
}

const row = (r: SaRow, key?: string): MetricRow => ({ key: key ?? r.keys?.[0] ?? "", clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position });

/** Current period rows with the previous period merged in; plus rows that disappeared. */
async function compared(site: string, dim: string, days: number, endMs: number, deps: GscDeps, rowLimit = 500) {
  const p = periods(endMs, days);
  const [cur, prev] = await Promise.all([
    query(site, { startDate: p.current.start, endDate: p.current.end, dimensions: [dim], rowLimit }, deps),
    query(site, { startDate: p.previous.start, endDate: p.previous.end, dimensions: [dim], rowLimit }, deps),
  ]);
  const pm = new Map(prev.map((r) => [r.keys?.[0] ?? "", r]));
  const rows: MetricRow[] = cur.map((r) => {
    const k = r.keys?.[0] ?? "";
    const pr = pm.get(k);
    return { ...row(r), prevClicks: pr?.clicks ?? 0, prevImpressions: pr?.impressions ?? 0, prevPosition: pr?.position ?? null };
  });
  const seen = new Set(rows.map((r) => r.key));
  const lost: MetricRow[] = prev
    .filter((r) => !seen.has(r.keys?.[0] ?? "") && r.clicks > 0)
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 100)
    .map((r) => ({ key: r.keys?.[0] ?? "", clicks: 0, impressions: 0, ctr: 0, position: 0, prevClicks: r.clicks, prevImpressions: r.impressions, prevPosition: r.position }));
  return { rows, lost };
}

interface InspectionResponse {
  inspectionResult?: {
    inspectionResultLink?: string;
    indexStatusResult?: {
      verdict?: string;
      coverageState?: string;
      robotsTxtState?: string;
      indexingState?: string;
      lastCrawlTime?: string;
      pageFetchState?: string;
      googleCanonical?: string;
      userCanonical?: string;
      crawledAs?: string;
      sitemap?: string[];
      referringUrls?: string[];
    };
    richResultsResult?: { verdict?: string; detectedItems?: Array<{ richResultType?: string; items?: Array<{ issues?: Array<{ issueMessage?: string; severity?: string }> }> }> };
  };
}

export async function inspectUrl(site: string, url: string, deps: GscDeps = {}): Promise<Inspection> {
  const r = await call<InspectionResponse>(INSPECT_URL, deps, { inspectionUrl: url, siteUrl: site });
  const s = r.inspectionResult?.indexStatusResult ?? {};
  const rich = r.inspectionResult?.richResultsResult;
  return {
    url,
    verdict: s.verdict ?? "VERDICT_UNSPECIFIED",
    coverageState: s.coverageState ?? null,
    indexingState: s.indexingState ?? null,
    robotsTxtState: s.robotsTxtState ?? null,
    pageFetchState: s.pageFetchState ?? null,
    lastCrawlTime: s.lastCrawlTime ?? null,
    crawledAs: s.crawledAs ?? null,
    googleCanonical: s.googleCanonical ?? null,
    userCanonical: s.userCanonical ?? null,
    inSitemap: (s.sitemap ?? []).length > 0,
    referringUrls: (s.referringUrls ?? []).length,
    richResults: rich
      ? {
          verdict: rich.verdict ?? null,
          items: (rich.detectedItems ?? []).map((d) => ({
            type: d.richResultType ?? "Unknown",
            issues: (d.items ?? []).flatMap((i) => i.issues ?? []).map((x) => ({ message: x.issueMessage ?? "", severity: x.severity ?? "" })),
          })),
        }
      : null,
    link: r.inspectionResult?.inspectionResultLink ?? null,
    inspectedAt: new Date().toISOString(),
  };
}

// ------------------------------------------------------------------ snapshot storage

const snapFile = (domain: string) => path.join(dataDir(), "gsc", `${domain.replace(/[^a-z0-9.-]/gi, "_")}.json`);

export function readSnapshot(domain: string): GscSnapshot | null {
  try {
    return JSON.parse(fs.readFileSync(snapFile(domain), "utf8")) as GscSnapshot;
  } catch {
    return null;
  }
}

function writeSnapshot(domain: string, s: GscSnapshot) {
  ensureDir(path.dirname(snapFile(domain)));
  writeAtomic(snapFile(domain), JSON.stringify(s));
}

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]);
      }
    }),
  );
  return out;
}

const SEARCH_TYPES = ["web", "image", "video", "news", "discover", "googleNews"] as const;

/**
 * Pull everything for one site and store it. Returns the new alerts (ones the previous sync did
 * not have), so monitoring can report each problem once.
 */
export async function syncSite(domain: string, siteUrl: string, deps: GscDeps = {}, props?: Property[]): Promise<{ snapshot: GscSnapshot; newAlerts: GscAlert[] }> {
  const now = (deps.now ?? Date.now)();
  const prevSnap = readSnapshot(domain);
  const base: GscSnapshot = {
    version: 1, domain, property: null, fetchedAt: new Date(now).toISOString(), error: null, endDate: null,
    daily: [], ranges: {}, countries: [], devices: [], appearance: [], searchTypes: [], queryPages: [], sitemaps: [], inspections: {}, alerts: [],
  };
  let property: string | null = null;
  try {
    property = matchProperty(domain, props ?? (await listProperties(deps)));
    if (!property) {
      const email = (deps.sa === undefined ? readServiceAccount() : deps.sa)?.client_email ?? "the service account";
      throw new GscError(404, `No Search Console property for ${domain} is shared with ${email}. In Search Console open the property, Settings → Users and permissions → Add user, and add that address (Restricted is enough).`);
    }
    // Search Console data runs about 2 days behind; "all" includes the newest, still-settling days.
    const end = Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate()) - DAY;
    const snap: GscSnapshot = { ...base, property, endDate: iso(end) };

    const daily = await query(property, { startDate: iso(end - (HISTORY_DAYS - 1) * DAY), endDate: iso(end), dimensions: ["date"], rowLimit: 25000 }, deps);
    snap.daily = daily.map((r) => row(r)).sort((a, b) => a.key.localeCompare(b.key));

    for (const days of RANGES) {
      const [q, pg] = await Promise.all([compared(property, "query", days, end, deps), compared(property, "page", days, end, deps)]);
      snap.ranges[String(days)] = { ...periods(end, days), queries: q.rows, lostQueries: q.lost, pages: pg.rows, lostPages: pg.lost };
    }
    const [countries, devices, appearance] = await Promise.all([
      compared(property, "country", 28, end, deps, 250),
      compared(property, "device", 28, end, deps, 10),
      compared(property, "searchAppearance", 28, end, deps, 50).catch(() => ({ rows: [] as MetricRow[], lost: [] })),
    ]);
    snap.countries = countries.rows;
    snap.devices = devices.rows;
    snap.appearance = appearance.rows;
    const p28 = periods(end, 28);
    snap.searchTypes = (
      await Promise.all(
        SEARCH_TYPES.map(async (type) => {
          try {
            const r = await query(property!, { startDate: p28.current.start, endDate: p28.current.end, type }, deps);
            return r[0] ? row(r[0], type) : null;
          } catch {
            return null; // e.g. Discover is not available for every property
          }
        }),
      )
    ).filter((x): x is MetricRow => Boolean(x && x.impressions > 0));
    snap.queryPages = (await query(property, { startDate: p28.current.start, endDate: p28.current.end, dimensions: ["query", "page"], rowLimit: 5000 }, deps)).map((r) => ({
      query: r.keys?.[0] ?? "", page: r.keys?.[1] ?? "", clicks: r.clicks, impressions: r.impressions, position: r.position,
    }));

    const sm = await call<{ sitemap?: Array<Record<string, unknown>> }>(`${API}/sites/${encodeURIComponent(property)}/sitemaps`, deps).catch(() => ({ sitemap: [] }));
    snap.sitemaps = (sm.sitemap ?? []).map((s) => ({
      path: String(s.path ?? ""),
      lastSubmitted: (s.lastSubmitted as string) ?? null,
      lastDownloaded: (s.lastDownloaded as string) ?? null,
      isPending: Boolean(s.isPending),
      isIndex: Boolean(s.isSitemapsIndex),
      errors: Number(s.errors ?? 0),
      warnings: Number(s.warnings ?? 0),
      submitted: ((s.contents as Array<{ submitted?: string }>) ?? []).reduce((a, c) => a + Number(c.submitted ?? 0), 0),
    }));

    // URL Inspection: the homepage, the pages that bring the most clicks, and pages that were not
    // indexed last time (to see whether they recovered).
    const home = property.startsWith("sc-domain:") ? siteUrl : property;
    const top = (snap.ranges["28"]?.pages ?? []).slice().sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions).map((r) => r.key);
    const retry = Object.values(prevSnap?.inspections ?? {}).filter((i) => i.verdict !== "PASS").map((i) => i.url);
    const targets = [...new Set([home, ...retry, ...top])].slice(0, INSPECT_LIMIT);
    const results = await pool(targets, 4, (u) => inspectUrl(property!, u, deps).catch(() => null));
    for (const r of results) if (r) snap.inspections[r.url] = { ...r, prevVerdict: prevSnap?.inspections?.[r.url]?.verdict ?? null };
    // Keep older inspections of URLs not re-checked this time.
    for (const [u, i] of Object.entries(prevSnap?.inspections ?? {})) if (!snap.inspections[u]) snap.inspections[u] = i;

    snap.alerts = computeAlerts(snap);
    writeSnapshot(domain, snap);
    const before = new Set((prevSnap?.alerts ?? []).map((a) => a.id));
    return { snapshot: snap, newAlerts: snap.alerts.filter((a) => !before.has(a.id)) };
  } catch (e) {
    const snap: GscSnapshot = prevSnap ? { ...prevSnap, error: (e as Error).message, errorAt: new Date(now).toISOString() } : { ...base, property, error: (e as Error).message };
    writeSnapshot(domain, snap);
    throw e;
  }
}
