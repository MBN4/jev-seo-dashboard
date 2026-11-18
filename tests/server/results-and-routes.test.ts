import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { installAudit, jsonReq, makeSandbox } from "../helpers";

let sb: ReturnType<typeof makeSandbox>;
const ID = "iana.org-2026-11-18-0812";
const RICH = "rich.example.org-2026-01-01-0000";

beforeAll(() => {
  sb = makeSandbox();
  installAudit(sb.reports, ID);
  // A test-only variant with Jev and PageSpeed blocks shaped exactly like the engine's output.
  installAudit(sb.reports, RICH, (a) => {
    a.site.domain = "rich.example.org";
    a.site.input_url = "https://rich.example.org";
    const url = a.pages[0].url;
    a.jev = {
      available: true, site: { value_prop: { type: "score", value: 0.67, raw: 2, levels: 4, confidence: 0.9, band: "act" } },
      pages: { [url]: { helpfulness: { type: "score", value: 0.33, raw: 1, levels: 4, confidence: 0.8, band: "act" }, answer_first: { type: "noul", value: 0.2, band: "no" } } },
      pairs: [], ledger: { cost_usd: 0.004 }, questions: { page_example: { helpfulness: { type: "score", instructions: "How helpful is `page`?", criteria: ["None", "Little", "Some", "Very"] } } }, not_judged: [],
    };
    a.performance = { source: "psi", keyed: false, runs: [
      { url, strategy: "mobile", error: "HTTP 429" },
      { url, strategy: "desktop", scores: { performance: 91 }, lab: { LCP: { value: 1200, display: "1.2 s" } }, field_url: null, field_origin: null, opportunities: [] },
    ] };
  });
  fs.mkdirSync(path.join(sb.reports, "not-an-audit"));
});
afterAll(() => sb.cleanup());

const ctx = <P,>(p: P) => ({ params: Promise.resolve(p) });

describe("audit list, import and history", () => {
  it("discovers existing report folders as imported audits with engine scores", async () => {
    const { GET } = await import("@/app/api/audits/route");
    const res = await GET(jsonReq("/api/audits", "GET"));
    const body = await res.json();
    expect(body.total).toBe(2);
    const a = body.items.find((x: { id: string }) => x.id === ID);
    expect(a).toMatchObject({ origin: "imported", status: "completed", score: 60, grade: "C", rulesEvaluated: 52, pagesCrawled: 4 });
    expect(a.reports).toEqual(expect.arrayContaining(["pdf", "xlsx", "md", "json"]));
  });

  it("removes from history without deleting files and restores via import", async () => {
    const one = await import("@/app/api/audits/[id]/route");
    const res = await one.DELETE(jsonReq(`/api/audits/${ID}`, "DELETE"), ctx({ id: ID }));
    expect(await res.json()).toMatchObject({ hidden: true, filesDeleted: false });
    expect(fs.existsSync(path.join(sb.reports, ID, "audit.json"))).toBe(true);
    const list = await import("@/app/api/audits/route");
    expect((await (await list.GET(jsonReq("/api/audits", "GET"))).json()).total).toBe(1);
    const imp = await import("@/app/api/audits/import/route");
    const r = await (await imp.POST(jsonReq("/api/audits/import", "POST", { restoreAll: true }))).json();
    expect(r.restored).toEqual([ID]);
    expect(r.discovered).toBe(2);
  });

  it("filters history by domain and status", async () => {
    const { GET } = await import("@/app/api/audits/route");
    const body = await (await GET(jsonReq("/api/audits?q=rich&status=completed", "GET"))).json();
    expect(body.items.map((x: { id: string }) => x.id)).toEqual([RICH]);
  });
});

describe("result endpoints", () => {
  it("returns paginated, filtered findings", async () => {
    const { GET } = await import("@/app/api/audits/[id]/findings/route");
    const body = await (await GET(jsonReq(`/api/audits/${ID}/findings?severity=low&pageSize=2`, "GET"), ctx({ id: ID }))).json();
    expect(body.items).toHaveLength(2);
    expect(body.items.every((f: { severity: string }) => f.severity === "low")).toBe(true);
    expect(body.total).toBe(body.facets.severity.low);
    expect(body.passedRules.length).toBe(40);
  });

  it("lists pages and lazy-loads page detail", async () => {
    const pages = await import("@/app/api/audits/[id]/pages/route");
    const body = await (await pages.GET(jsonReq(`/api/audits/${ID}/pages?sort=wordCount&dir=desc`, "GET"), ctx({ id: ID }))).json();
    expect(body.total).toBe(4);
    const wc = body.items.map((p: { wordCount: number }) => p.wordCount);
    expect(wc).toEqual([...wc].sort((a: number, b: number) => b - a));
    const detail = await import("@/app/api/audits/[id]/pages/detail/route");
    const d = await (await detail.GET(jsonReq(`/api/audits/${ID}/pages/detail?url=${encodeURIComponent(body.items[0].url)}`, "GET"), ctx({ id: ID }))).json();
    expect(d.url).toBe(body.items[0].url);
    expect(d.headings).toBeDefined();
    const missing = await detail.GET(jsonReq(`/api/audits/${ID}/pages/detail?url=https://nope/`, "GET"), ctx({ id: ID }));
    expect(missing.status).toBe(404);
  });

  it("reports Jev as unavailable instead of inventing judgments", async () => {
    const { GET } = await import("@/app/api/audits/[id]/ai/route");
    const body = await (await GET(jsonReq("", "GET"), ctx({ id: ID }))).json();
    expect(body.available).toBe(false);
    expect(body.pages).toEqual([]);
  });

  it("exposes real Jev dimensions when the engine produced them", async () => {
    const { GET } = await import("@/app/api/audits/[id]/ai/route");
    const body = await (await GET(jsonReq("", "GET"), ctx({ id: RICH }))).json();
    expect(body.available).toBe(true);
    expect(body.dimensions.map((d: { key: string }) => d.key)).toEqual(["helpfulness", "answer_first"]);
    expect(body.site[0]).toMatchObject({ key: "value_prop", label: "Value proposition" });
  });

  it("classifies PageSpeed runs and never substitutes zero", async () => {
    const { GET } = await import("@/app/api/audits/[id]/performance/route");
    const body = await (await GET(jsonReq("", "GET"), ctx({ id: RICH }))).json();
    expect(body.runs.map((r: { outcome: string }) => r.outcome)).toEqual(["rate_limited", "ok"]);
    expect(body.runs[0].scores).toBeUndefined();
  });
});

describe("recommendations", () => {
  it("persists status and notes outside audit.json", async () => {
    const before = fs.readFileSync(path.join(sb.reports, ID, "audit.json"), "utf8");
    const list = await import("@/app/api/audits/[id]/recommendations/route");
    const items = (await (await list.GET(jsonReq("", "GET"), ctx({ id: ID }))).json()).items;
    expect(items.length).toBe(11);
    expect(items[0].status).toBe("pending");
    const one = await import("@/app/api/audits/[id]/recommendations/[recId]/route");
    const res = await one.PATCH(jsonReq("", "PATCH", { status: "in_progress", notes: "Ticket SEO-12" }), ctx({ id: ID, recId: items[0].key }));
    expect(await res.json()).toMatchObject({ status: "in_progress", notes: "Ticket SEO-12" });
    const again = (await (await list.GET(jsonReq("", "GET"), ctx({ id: ID }))).json()).items[0];
    expect(again).toMatchObject({ status: "in_progress", notes: "Ticket SEO-12" });
    expect(fs.readFileSync(path.join(sb.reports, ID, "audit.json"), "utf8")).toBe(before);
    const bad = await one.PATCH(jsonReq("", "PATCH", { status: "done" }), ctx({ id: ID, recId: items[0].key }));
    expect(bad.status).toBe(400);
    const unknown = await one.PATCH(jsonReq("", "PATCH", { status: "completed" }), ctx({ id: ID, recId: "nope" }));
    expect(unknown.status).toBe(404);
  });
});

describe("report downloads", () => {
  it("serves the original files with download headers", async () => {
    const { GET } = await import("@/app/api/audits/[id]/reports/[type]/route");
    const res = await GET(jsonReq("", "GET"), ctx({ id: ID, type: "pdf" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toContain("attachment");
    expect(await res.text()).toBe("test report.pdf");
    const inline = await GET(new Request("http://localhost/x?inline=1"), ctx({ id: ID, type: "pdf" }));
    expect(inline.headers.get("content-disposition")).toContain("inline");
  });

  it("refuses traversal, unknown types, unregistered folders and symlink escapes", async () => {
    const { GET } = await import("@/app/api/audits/[id]/reports/[type]/route");
    fs.symlinkSync("/etc", path.join(sb.reports, "escape"));
    fs.mkdirSync(path.join(sb.reports, "linked"));
    fs.symlinkSync("/etc/passwd", path.join(sb.reports, "linked", "report.md"));
    for (const [id, type] of [["../../etc", "pdf"], ["..", "json"], [ID, "passwd"], [ID, "../audit.json"], ["escape", "md"], ["linked", "md"], ["not-an-audit", "pdf"]]) {
      const res = await GET(jsonReq("", "GET"), ctx({ id, type }));
      expect(res.status, `${id}/${type}`).toBe(404);
    }
  });
});

describe("audit creation", () => {
  it("validates input and refuses private targets before spawning anything", async () => {
    const { POST } = await import("@/app/api/audits/route");
    expect((await POST(jsonReq("/api/audits", "POST", { url: "http://127.0.0.1" }))).status).toBe(422);
    expect((await POST(jsonReq("/api/audits", "POST", { url: "" }))).status).toBe(400);
    expect((await POST(jsonReq("/api/audits", "POST", { url: "https://example.com", options: { maxPages: 99999 } }))).status).toBe(400);
    const text = new Request("http://localhost:3000/api/audits", { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" });
    expect((await POST(text)).status).toBe(415);
    expect(fs.existsSync(path.join(sb.data, "jobs"))).toBe(false);
  });

  it("requires explicit confirmation and credentials for paid DataForSEO mode", async () => {
    const { createAudit } = await import("@/lib/server/audit-service");
    const pub = async () => ["93.184.216.34"];
    await expect(createAudit({ url: "https://example.com", options: { full: true } }, pub)).rejects.toThrow(/Confirm the spend/);
    await expect(createAudit({ url: "https://example.com", options: { full: true }, confirmPaid: true }, pub)).rejects.toThrow(/DATAFORSEO_USERNAME/);
  });
});
