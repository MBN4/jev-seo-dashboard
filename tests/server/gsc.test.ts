import fs from "node:fs";
import path from "node:path";
import { createVerify, generateKeyPairSync } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { jsonReq, makeSandbox } from "../helpers";
import { expectedCtr, indexing, kpis, opportunities, type GscSnapshot } from "@/lib/gsc-insights";

let sb: ReturnType<typeof makeSandbox>;
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const PEM = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const EMAIL = "auditpilot@demo-project.iam.gserviceaccount.com";
const KEY_JSON = JSON.stringify({ type: "service_account", project_id: "demo-project", client_email: EMAIL, private_key: PEM, token_uri: "https://evil.example/token" });
const DAY = 86_400_000;
const NOW = Date.parse("2026-11-26T12:00:00Z");

/** A fake Google: token endpoint (verifies the JWT signature), Search Console and URL Inspection. */
function google(state: { weekFactor: number; verdicts: Record<string, string>; props: Array<{ siteUrl: string; permissionLevel: string }> }) {
  const calls: string[] = [];
  const f = async (url: string, init?: RequestInit) => {
    calls.push(url);
    const ok = (j: unknown) => new Response(JSON.stringify(j), { status: 200, headers: { "content-type": "application/json" } });
    if (url === "https://oauth2.googleapis.com/token") {
      const assertion = new URLSearchParams(String(init?.body)).get("assertion")!;
      const [h, p, sig] = assertion.split(".");
      const valid = createVerify("RSA-SHA256").update(`${h}.${p}`).verify(publicKey, Buffer.from(sig, "base64url"));
      const claims = JSON.parse(Buffer.from(p, "base64url").toString());
      if (!valid || claims.iss !== EMAIL || !String(claims.scope).includes("webmasters.readonly")) return new Response("{}", { status: 400 });
      return ok({ access_token: "tok", expires_in: 3600 });
    }
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    if (url.endsWith("/webmasters/v3/sites")) return ok({ siteEntry: state.props });
    if (url.endsWith("/sitemaps")) return ok({ sitemap: [{ path: "https://tellbear.com/sitemap.xml", errors: "2", warnings: "0", isPending: false, contents: [{ submitted: "40" }] }] });
    if (url.includes("urlInspection")) {
      const { inspectionUrl } = JSON.parse(String(init?.body));
      const v = state.verdicts[inspectionUrl] ?? "PASS";
      return ok({ inspectionResult: { inspectionResultLink: "https://search.google.com/x", indexStatusResult: { verdict: v, coverageState: v === "PASS" ? "Submitted and indexed" : "Crawled - currently not indexed", googleCanonical: inspectionUrl, userCanonical: inspectionUrl, lastCrawlTime: "2026-11-20T00:00:00Z" } } });
    }
    if (url.includes("/searchAnalytics/query")) {
      const b = JSON.parse(String(init?.body));
      const recent = Date.parse(b.endDate) > NOW - 3 * DAY; // the current period ends yesterday
      const dims: string[] = b.dimensions ?? [];
      if (dims[0] === "date") {
        const rows = [];
        for (let t = Date.parse(b.startDate); t <= Date.parse(b.endDate); t += DAY) {
          const lastWeek = t > NOW - 8 * DAY;
          rows.push({ keys: [new Date(t).toISOString().slice(0, 10)], clicks: lastWeek ? 100 * state.weekFactor : 100, impressions: 2000, ctr: 0.05, position: 8 });
        }
        return ok({ rows });
      }
      if (dims[0] === "query" && dims[1] === "page")
        return ok({ rows: [{ keys: ["ai cold email", "https://tellbear.com/a"], clicks: 5, impressions: 300, position: 7 }, { keys: ["ai cold email", "https://tellbear.com/b"], clicks: 3, impressions: 200, position: 9 }] });
      if (dims[0] === "query")
        return ok({ rows: recent
          ? [{ keys: ["tellbear"], clicks: 50, impressions: 400, ctr: 0.125, position: 1.2 }, { keys: ["cold email ai"], clicks: 2, impressions: 900, ctr: 0.002, position: 7.5 }, { keys: ["new topic"], clicks: 1, impressions: 120, ctr: 0.008, position: 12 }]
          : [{ keys: ["tellbear"], clicks: 60, impressions: 420, ctr: 0.14, position: 1.1 }, { keys: ["cold email ai"], clicks: 4, impressions: 800, ctr: 0.005, position: 8 }, { keys: ["gone query"], clicks: 9, impressions: 90, ctr: 0.1, position: 5 }] });
      if (dims[0] === "page") return ok({ rows: [{ keys: ["https://tellbear.com/"], clicks: 40, impressions: 500, ctr: 0.08, position: 2 }, { keys: ["https://tellbear.com/a"], clicks: 5, impressions: 300, ctr: 0.017, position: 7 }] });
      if (dims[0] === "country") return ok({ rows: [{ keys: ["usa"], clicks: 30, impressions: 600, ctr: 0.05, position: 6 }] });
      if (dims[0] === "device") return ok({ rows: [{ keys: ["MOBILE"], clicks: 20, impressions: 500, ctr: 0.04, position: 7 }] });
      if (dims[0] === "searchAppearance") return ok({ rows: [] });
      if (b.type === "discover") return new Response(JSON.stringify({ error: { message: "not supported" } }), { status: 400 });
      return ok({ rows: [{ clicks: b.type === "web" ? 700 : 0, impressions: b.type === "web" ? 14000 : 0, ctr: 0.05, position: 8 }] });
    }
    return new Response("{}", { status: 404 });
  };
  return { fetcher: f as unknown as typeof fetch, calls };
}

beforeAll(() => {
  sb = makeSandbox();
});
afterAll(() => sb.cleanup());

describe("Search Console credentials", () => {
  it("validates, stores privately and never returns the key", async () => {
    const { parseServiceAccount } = await import("@/lib/server/gsc");
    expect(() => parseServiceAccount("nope")).toThrow(/not valid JSON/);
    expect(() => parseServiceAccount(JSON.stringify({ installed: { client_id: "x" } }))).toThrow(/not a service account/);
    expect(() => parseServiceAccount(JSON.stringify({ type: "service_account", client_email: EMAIL, private_key: "-----BEGIN PRIVATE KEY-----\nbad\n-----END PRIVATE KEY-----" }))).toThrow(/could not be read/);

    const cred = await import("@/app/api/gsc/credentials/route");
    const res = await cred.PUT(jsonReq("/api/gsc/credentials", "PUT", { json: KEY_JSON }));
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain(EMAIL);
    expect(body).not.toContain("PRIVATE KEY");
    const file = path.join(sb.data, "gsc", "service-account.json");
    expect(fs.statSync(file).mode & 0o777).toBe(0o600);
    expect(fs.readFileSync(file, "utf8")).not.toContain("evil.example"); // token_uri from the file is never used

    const { GET } = await import("@/app/api/gsc/route");
    const ov = await (await GET()).text();
    expect(ov).not.toContain("PRIVATE KEY");
    expect(JSON.parse(ov).connection).toMatchObject({ configured: true, clientEmail: EMAIL, source: "dashboard" });
  });

  it("matches each site to the right property", async () => {
    const { matchProperty } = await import("@/lib/server/gsc");
    const props = [
      { siteUrl: "sc-domain:clustox.com", permissionLevel: "siteRestrictedUser" },
      { siteUrl: "http://tellbear.com/", permissionLevel: "siteOwner" },
      { siteUrl: "https://tellbear.com/", permissionLevel: "siteOwner" },
      { siteUrl: "https://www.emailverify.io/", permissionLevel: "siteFullUser" },
    ];
    expect(matchProperty("clustox.com", props)).toBe("sc-domain:clustox.com");
    expect(matchProperty("blog.clustox.com", props)).toBe("sc-domain:clustox.com");
    expect(matchProperty("tellbear.com", props)).toBe("https://tellbear.com/");
    expect(matchProperty("emailverify.io", props)).toBe("https://www.emailverify.io/");
    expect(matchProperty("inboxwarm.ai", props)).toBeNull();
  });
});

describe("Search Console sync", () => {
  it("pulls performance, opportunities, index status and sitemaps, and alerts once", async () => {
    const { syncSearchConsole, readMonitor } = await import("@/lib/server/monitor");
    const { readSnapshot } = await import("@/lib/server/gsc");
    const state = { weekFactor: 1, verdicts: {} as Record<string, string>, props: [{ siteUrl: "https://tellbear.com/", permissionLevel: "siteOwner" }] };
    const g = google(state);
    const deps = { fetcher: g.fetcher, now: () => NOW };

    const r1 = await syncSearchConsole("tellbear.com", deps);
    expect(g.calls.some((c) => c.includes("evil.example"))).toBe(false);
    const snap = readSnapshot("tellbear.com")!;
    expect(snap.property).toBe("https://tellbear.com/");
    expect(snap.endDate).toBe("2026-11-25");
    expect(snap.daily.length).toBeGreaterThan(400);
    expect(snap.searchTypes.map((t) => t.key)).toEqual(["web"]); // empty and unsupported types are left out
    expect(snap.inspections["https://tellbear.com/"].verdict).toBe("PASS");
    expect(r1.newAlerts.map((a) => a.id.split(":")[0])).toEqual(["gsc_sitemap_errors"]);

    // A week later: clicks halve and a top page drops out of the index.
    state.weekFactor = 0.4;
    state.verdicts["https://tellbear.com/a"] = "NEUTRAL";
    const r2 = await syncSearchConsole("tellbear.com", deps);
    const ids = r2.newAlerts.map((a) => a.id.split(":")[0]);
    expect(ids).toContain("gsc_clicks_drop");
    expect(ids).toContain("gsc_deindexed");
    expect(r2.newAlerts.find((a) => a.id.startsWith("gsc_clicks_drop"))).toMatchObject({ priority: "P0", title: "Search clicks down 60% this week" });
    expect(ids).not.toContain("gsc_sitemap_errors"); // already reported

    // The same problems are not reported again.
    const r3 = await syncSearchConsole("tellbear.com", deps);
    expect(r3.newAlerts.map((a) => a.id.split(":")[0])).not.toContain("gsc_clicks_drop");
    const events = readMonitor().events.filter((e) => e.kind === "search" && e.domain === "tellbear.com");
    expect(events.map((e) => e.title)).toEqual(expect.arrayContaining(["Search clicks down 60% this week", "1 page dropped out of Google's index"]));

    const view = await import("@/app/api/gsc/sites/[domain]/route");
    const v = await (await view.GET(jsonReq("/api/gsc/sites/tellbear.com?days=28", "GET"), { params: Promise.resolve({ domain: "tellbear.com" }) })).json();
    expect(v.synced).toBe(true);
    expect(v.kpis.current.clicks).toBeGreaterThan(0);
    expect(v.opportunities.striking.map((q: { key: string }) => q.key)).toContain("cold email ai");
    expect(v.opportunities.lowCtr.map((q: { key: string }) => q.key)).toContain("cold email ai");
    expect(v.opportunities.losingQueries.map((q: { key: string }) => q.key)).toEqual(expect.arrayContaining(["gone query", "tellbear"]));
    expect(v.opportunities.cannibal[0].query).toBe("ai cold email");
    expect(v.indexing.notIndexed).toBe(1);
  });

  it("explains a missing property and a missing key", async () => {
    const { syncSearchConsole } = await import("@/lib/server/monitor");
    const g = google({ weekFactor: 1, verdicts: {}, props: [] });
    await expect(syncSearchConsole("inboxwarm.ai", { fetcher: g.fetcher, now: () => NOW })).rejects.toThrow(new RegExp(`shared with ${EMAIL.replace(/\./g, "\\.")}`));
    await expect(syncSearchConsole("inboxwarm.ai", { fetcher: g.fetcher, now: () => NOW, sa: null })).rejects.toThrow(/not connected/);
  });
});

describe("Search Console insights", () => {
  const base = (): GscSnapshot => ({
    version: 1, domain: "x.com", property: "sc-domain:x.com", fetchedAt: "2026-11-26T00:00:00Z", error: null, endDate: "2026-11-25",
    daily: [], ranges: {}, countries: [], devices: [], appearance: [], searchTypes: [], queryPages: [], sitemaps: [], inspections: {}, alerts: [],
  });
  it("computes period totals with impression-weighted position", () => {
    const s = base();
    s.daily = [
      { key: "2026-11-18", clicks: 10, impressions: 100, ctr: 0.1, position: 2 },
      { key: "2026-11-25", clicks: 30, impressions: 300, ctr: 0.1, position: 6 },
      { key: "2026-11-11", clicks: 20, impressions: 100, ctr: 0.2, position: 4 },
    ];
    const k = kpis(s, 7)!;
    expect(k.current).toMatchObject({ clicks: 30, impressions: 300 });
    expect(k.prev.clicks).toBe(10);
    expect(k.change.clicks).toBe(2);
    expect(kpis(s, 28)!.current.position).toBeCloseTo((2 * 100 + 6 * 300 + 4 * 100) / 500);
  });
  it("flags low CTR only against the position benchmark", () => {
    expect(expectedCtr(1)).toBeGreaterThan(expectedCtr(5));
    const s = base();
    s.ranges["28"] = { current: { start: "", end: "" }, previous: { start: "", end: "" }, lostQueries: [], lostPages: [], pages: [], queries: [
      { key: "good", clicks: 30, impressions: 200, ctr: 0.15, position: 2 },
      { key: "bad", clicks: 1, impressions: 400, ctr: 0.0025, position: 3 },
    ] };
    expect(opportunities(s, 28)!.lowCtr.map((x) => x.key)).toEqual(["bad"]);
  });
  it("summarises inspections and canonical mismatches", () => {
    const s = base();
    const i = (url: string, verdict: string, gc?: string) => ({ url, verdict, coverageState: null, indexingState: null, robotsTxtState: null, pageFetchState: null, lastCrawlTime: null, crawledAs: null, googleCanonical: gc ?? url, userCanonical: url, inSitemap: true, referringUrls: 0, richResults: null, link: null, inspectedAt: "" });
    s.inspections = { a: i("https://x.com/a", "PASS"), b: i("https://x.com/b", "NEUTRAL"), c: i("https://x.com/c", "PASS", "https://x.com/") };
    const ix = indexing(s);
    expect(ix).toMatchObject({ inspected: 3, indexed: 2, notIndexed: 1 });
    expect(ix.canonicalMismatch.map((x) => x.url)).toEqual(["https://x.com/c"]);
  });
});
