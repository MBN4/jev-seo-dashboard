import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { installAudit, jsonReq, makeSandbox } from "../helpers";

let sb: ReturnType<typeof makeSandbox>;
const ID = "shop.example.org-2026-01-01-0000";
const BASE = "https://shop.example.org";
const page = (url: string, over: Record<string, unknown> = {}) => ({
  url, final_url: url, status: 200, kind: "page", depth: 1, inlinks: 3, title: "A perfectly reasonable page title here", meta_description: "x".repeat(120),
  h1: ["Heading"], h2: ["Sub"], word_count: 400, text_hash: url, links_internal: [{ url: `${BASE}/`, anchor: "home" }], links_external: [], images: { total: 0, missing_alt: 0 }, schema_types: [], ...over,
});

beforeAll(() => {
  sb = makeSandbox();
  installAudit(sb.reports, ID, (a) => {
    a.site = { ...a.site, final_url: `${BASE}/`, domain: "shop.example.org", link_status: { [`${BASE}/gone`]: 404, [`${BASE}/moved`]: 301 } };
    a.pages = [
      page(`${BASE}/`, { depth: 0, title: "Home" }),
      page(`${BASE}/a`, { title: "Same title", meta_description: null, h1: [], links_internal: [{ url: `${BASE}/gone`, anchor: "x" }] }),
      page(`${BASE}/b`, { title: "Same title", h1: ["One", "Two"], canonical: `${BASE}/moved`, images: { total: 3, missing_alt: 2, missing_alt_samples: [`${BASE}/i.png`] }, text_hash: "dup" }),
      page(`${BASE}/c`, { title: "=HYPERLINK(\"evil\")", meta_robots: "noindex", text_hash: "dup", word_count: 50 }),
      { url: `${BASE}/old`, final_url: `${BASE}/new`, status: 301, kind: "redirect", redirect_chain: [{ url: `${BASE}/old`, status: 301 }, { url: `${BASE}/mid`, status: 301 }] },
      { url: `${BASE}/gone`, status: 404, kind: "page" },
    ];
  });
});
afterAll(() => sb.cleanup());
const ctx = <P,>(p: P) => ({ params: Promise.resolve(p) });

describe("site explorer", () => {
  it("counts every filter from the crawl data and lists issues across tabs", async () => {
    const { GET } = await import("@/app/api/audits/[id]/explorer/route");
    const ov = await (await GET(jsonReq("", "GET"), ctx({ id: ID }))).json();
    const count = (tab: string, f: string) => ov.tabs.find((t: { key: string }) => t.key === tab).filters.find((x: { key: string }) => x.key === f).count;
    expect(ov.totalUrls).toBe(6);
    expect(count("titles", "duplicate")).toBe(2);
    expect(count("titles", "short")).toBe(4); // "Home", "Same title" x2, the formula one
    expect(count("meta", "missing")).toBe(1);
    expect(count("h1", "missing")).toBe(1);
    expect(count("h1", "multiple")).toBe(1);
    expect(count("response", "4xx")).toBe(1);
    expect(count("response", "chain")).toBe(1);
    expect(count("canonicals", "canonicalised")).toBe(1);
    expect(count("canonicals", "non_indexable_target")).toBe(1);
    expect(count("directives", "noindex")).toBe(1);
    expect(count("links", "broken_out")).toBe(1);
    expect(count("images", "missing_alt")).toBe(1);
    expect(count("content", "duplicate")).toBe(2);
    expect(count("content", "low")).toBe(1);
    const first = ov.issues[0];
    expect(first.kind).toBe("issue");
    expect(ov.issues.every((i: { kind: string; count: number }) => i.kind !== "info" && i.count > 0)).toBe(true);
  });

  it("filters, searches, sorts and paginates a tab", async () => {
    const { GET } = await import("@/app/api/audits/[id]/explorer/[tab]/route");
    const res = await (await GET(jsonReq(`/x?filter=duplicate&sort=url&dir=desc`, "GET"), ctx({ id: ID, tab: "titles" }))).json();
    expect(res.total).toBe(2);
    expect(res.rows.map((r: { url: string }) => r.url)).toEqual([`${BASE}/b`, `${BASE}/a`]);
    expect(res.columns.map((c: { key: string }) => c.key)).toEqual(["url", "title", "titleLen", "titleCount", "h1"]);
    const search = await (await GET(jsonReq(`/x?q=home`, "GET"), ctx({ id: ID, tab: "titles" }))).json();
    expect(search.total).toBe(1);
    const paged = await (await GET(jsonReq(`/x?pageSize=2&page=2`, "GET"), ctx({ id: ID, tab: "internal" }))).json();
    expect(paged.rows).toHaveLength(2);
    expect(paged.total).toBe(6);
  });

  it("exports CSV safely (quotes, lists, formula injection)", async () => {
    const { GET } = await import("@/app/api/audits/[id]/explorer/[tab]/route");
    const res = await GET(jsonReq(`/x?format=csv`, "GET"), ctx({ id: ID, tab: "titles" }));
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toMatch(/auditpilot-.*titles\.csv/);
    const csv = await res.text();
    expect(csv.split("\n")[0]).toBe("Address,Title,Characters,Title tags,H1");
    expect(csv).toContain(`"'=HYPERLINK(""evil"")"`); // neutralised and quoted
  });

  it("rejects unknown tabs and filters", async () => {
    const { GET } = await import("@/app/api/audits/[id]/explorer/[tab]/route");
    expect((await GET(jsonReq("/x", "GET"), ctx({ id: ID, tab: "nope" }))).status).toBe(404);
    expect((await GET(jsonReq("/x?filter=nope", "GET"), ctx({ id: ID, tab: "titles" }))).status).toBe(404);
    void fs; void path;
  });
});
