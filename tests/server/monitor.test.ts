import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { installAudit, jsonReq, makeSandbox } from "../helpers";
import { diffAudits, diffHeadline } from "@/lib/server/audit-diff";
import { intendedNoindexReason } from "@/lib/server/finding-breakdown";
import type { EngineAudit } from "@/types/engine";

let sb: ReturnType<typeof makeSandbox>;
const SITE = "https://mycoldinbox.com/";
const D = "mycoldinbox.com";
const pub = async () => ["93.184.216.34"];

/** A tiny fake web: homepage + robots + one sitemap whose URL list the test controls. */
function web(state: { title: string; urls: string[] }) {
  return (async (url: string) => {
    const u = new URL(url);
    const ok = (body: string, type: string) => new Response(body, { status: 200, headers: { "content-type": type } });
    if (u.pathname === "/") return ok(`<html><head><title>${state.title}</title><meta name="description" content="Desc"></head><body><h1>Hi</h1></body></html>`, "text/html");
    if (u.pathname === "/robots.txt") return ok(`Sitemap: ${u.origin}/sitemap.xml`, "text/plain");
    if (u.pathname === "/sitemap.xml") return ok(`<urlset>${state.urls.map((x) => `<url><loc>${x}</loc></url>`).join("")}</urlset>`, "application/xml");
    return new Response("nope", { status: 404 });
  }) as unknown as typeof fetch;
}

function audit(id: string, finished: string, mutate: (a: EngineAudit) => void) {
  installAudit(sb.reports, id, (a) => {
    a.site = { ...a.site, domain: D, final_url: SITE };
    a.run = { ...a.run, started_at: finished, finished_at: finished };
    mutate(a as EngineAudit);
  });
}

const page = (url: string, over: Record<string, unknown> = {}) => ({ url, final_url: url, status: 200, kind: "page", title: "T", meta_description: "M", text_hash: "h", word_count: 300, ...over });

beforeAll(() => {
  sb = makeSandbox();
  process.env.AUDITPILOT_MONITOR = "1";
});
afterAll(() => sb.cleanup());
beforeEach(() => {
  fs.rmSync(sb.reports, { recursive: true, force: true });
  fs.mkdirSync(sb.reports, { recursive: true });
  fs.rmSync(sb.data, { recursive: true, force: true });
});

describe("audit diff", () => {
  it("lists new, worse, fixed issues and page-level changes", () => {
    const base = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "fixtures", "audit.json"), "utf8")) as EngineAudit;
    const prev: EngineAudit = { ...base, scores: { ...base.scores, overall: 80, grade: "B" }, findings: [
      { ...base.findings[0], id: "meta_missing", title: "Meta missing", urls: ["a"], count: 1 },
      { ...base.findings[0], id: "noindex", title: "Noindex", urls: ["x"], count: 1 },
    ], pages: [page("https://s/a"), page("https://s/b", { title: "Old" }), page("https://s/c")] as EngineAudit["pages"] };
    const curr: EngineAudit = { ...base, scores: { ...base.scores, overall: 74, grade: "C" }, findings: [
      { ...base.findings[0], id: "meta_missing", title: "Meta missing", urls: ["a", "b", "c"], count: 3 },
      { ...base.findings[0], id: "http_errors", title: "HTTP errors", severity: "high", urls: ["https://s/c"], count: 1 },
    ], pages: [page("https://s/a"), page("https://s/b", { title: "New" }), page("https://s/c", { status: 404 }), page("https://s/d")] as EngineAudit["pages"] };
    const d = diffAudits("p", prev, "c", curr);
    expect(d.score).toEqual({ before: 80, after: 74, delta: -6 });
    expect(d.newIssues.map((i) => i.id)).toEqual(["http_errors"]);
    expect(d.worse[0]).toMatchObject({ id: "meta_missing", before: 1, after: 3, newUrls: ["b", "c"] });
    expect(d.resolved.map((i) => i.id)).toEqual(["noindex"]);
    expect(d.pageChanges.broke).toEqual([{ url: "https://s/c", before: "200", after: "404" }]);
    expect(d.pageChanges.title).toEqual([{ url: "https://s/b", before: "Old", after: "New" }]);
    expect(d.pageChanges.found).toEqual(["https://s/d"]);
    expect(d.quiet).toBe(false);
    expect(diffHeadline(d)).toMatch(/^Score down 6 to 74, 1 new issue, 1 got worse, 1 fixed, 1 page now broken/);
  });
});

describe("noindex verdict", () => {
  it("recognises pages that are noindexed on purpose", () => {
    expect(intendedNoindexReason("https://s/blog/category/x/page/2")).toMatch(/Pagination/);
    expect(intendedNoindexReason("https://s/blog/author/maryam")).toMatch(/Author/);
    expect(intendedNoindexReason("https://s/privacy-policy")).toMatch(/Legal/);
    expect(intendedNoindexReason("https://s/terms-of-use")).toMatch(/Legal/);
    expect(intendedNoindexReason("https://s/pricing")).toBeNull();
  });
});

describe("monitoring scheduler", () => {
  it("reports a baseline, detects site changes, and starts a due audit sized from the sitemap", async () => {
    const { tick, readMonitor, monitorOverview } = await import("@/lib/server/monitor");
    audit("mycoldinbox.com-2026-11-20-1000", "2026-11-20T10:00:00+00:00", (a) => void (a.pages = [page("https://mycoldinbox.com/")] as EngineAudit["pages"]));
    const site = { title: "Cold inbox", urls: ["https://mycoldinbox.com/", "https://mycoldinbox.com/a"] };
    const started: Array<{ url: string; options: Record<string, unknown> }> = [];
    const startAudit = async (url: string, options: Record<string, unknown>) => {
      started.push({ url, options });
      return { id: `job-${started.length}` };
    };
    let now = Date.parse("2026-11-26T12:00:00Z");
    const deps = { resolver: pub, fetcher: web(site), now: () => now, startAudit };

    // First pass: baseline event for the existing audit, snapshot taken, overdue audit started.
    const r1 = await tick(deps);
    let m = readMonitor();
    expect(m.sites.map((s) => s.domain)).toEqual(expect.arrayContaining(["emailverify.io", "clustox.com", D, "inboxwarm.ai", "tellbear.com"]));
    expect(m.events.find((e) => e.domain === D && e.kind === "baseline")?.title).toMatch(/^First audit/);
    expect(m.sites.find((s) => s.domain === D)?.pagesCounted).toBe(2);
    expect(r1.started).toBe("job-1");
    expect(started[0].options).toMatchObject({ maxPages: 2, psi: false, ai: false });

    // Three hours later the site changed: new sitemap page and a new homepage title.
    site.urls.push("https://mycoldinbox.com/new-post");
    site.title = "Cold inbox: warm-up made easy";
    now += 3 * 3_600_000 + 1000;
    await tick(deps);
    m = readMonitor();
    const change = m.events.find((e) => e.domain === D && e.kind === "change");
    expect(change?.title).toMatch(/1 new page in the sitemap; homepage title changed/i);
    expect(change?.change?.sitemap?.added).toEqual(["https://mycoldinbox.com/new-post"]);
    expect(change?.change?.homepage[0]).toMatchObject({ field: "Title", before: "Cold inbox", after: "Cold inbox: warm-up made easy" });

    // A new completed audit is compared with the previous one.
    audit("mycoldinbox.com-2026-11-26-1500", "2026-11-26T15:00:00+00:00", (a) => {
      a.pages = [page("https://mycoldinbox.com/"), page("https://mycoldinbox.com/new-post")] as EngineAudit["pages"];
      a.findings = a.findings.slice(1);
    });
    await tick(deps);
    m = readMonitor();
    const ev = m.events.find((e) => e.kind === "audit");
    expect(ev?.auditId).toBe("mycoldinbox.com-2026-11-26-1500");
    expect(ev?.prevAuditId).toBe("mycoldinbox.com-2026-11-20-1000");
    expect(ev?.diff?.resolved.length).toBe(1);
    expect(ev?.diff?.pageChanges.found).toEqual(["https://mycoldinbox.com/new-post"]);

    const ov = monitorOverview();
    expect(ov.unseen).toBeGreaterThan(0);
    expect(ov.sites.find((s) => s.domain === D)?.lastAudit?.id).toBe("mycoldinbox.com-2026-11-26-1500");
  });

  it("exposes the feed and controls over the API", async () => {
    const { GET } = await import("@/app/api/monitor/route");
    const res = await (await GET()).json();
    expect(res.sites).toHaveLength(5);
    expect(res.sites.every((s: { intervalHours: number; builtIn: boolean }) => s.intervalHours === 24 && s.builtIn)).toBe(true);

    const site = await import("@/app/api/monitor/sites/[domain]/route");
    const ctx = { params: Promise.resolve({ domain: "clustox.com" }) };
    expect((await site.PATCH(jsonReq("/api/monitor/sites/clustox.com", "PATCH", { intervalHours: 12, enabled: false }), ctx)).status).toBe(200);
    expect((await site.PATCH(jsonReq("/api/monitor/sites/clustox.com", "PATCH", { intervalHours: 5 }), ctx)).status).toBe(400);
    expect((await site.DELETE(jsonReq("/api/monitor/sites/clustox.com", "DELETE"), ctx)).status).toBe(422);

    const add = await import("@/app/api/monitor/sites/route");
    expect((await add.POST(jsonReq("/api/monitor/sites", "POST", { url: "example.org" }))).status).toBe(201);
    expect((await add.POST(jsonReq("/api/monitor/sites", "POST", { url: "https://www.example.org" }))).status).toBe(409);
    const ex = { params: Promise.resolve({ domain: "example.org" }) };
    expect((await site.DELETE(jsonReq("/api/monitor/sites/example.org", "DELETE"), ex)).status).toBe(200);

    const after = await (await GET()).json();
    expect(after.sites.find((s: { domain: string }) => s.domain === "clustox.com")).toMatchObject({ enabled: false, intervalHours: 12, nextRunAt: null });
  });
});
