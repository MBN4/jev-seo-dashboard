import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fixtureAudit, installAudit, jsonReq, makeSandbox } from "../helpers";
import { containsPhrase, fleschReadingEase, isArticle, runExtraChecks, EXTRA_CHECKS } from "@/lib/server/extra-checks";
import type { EngineAudit, EnginePage } from "@/types/engine";

const BASE = "https://shop.example.org";
const words = (n: number, w = "lorem") => Array.from({ length: n }, (_, i) => `${w}${i % 50}`).join(" ");

function page(url: string, over: Partial<EnginePage> = {}): EnginePage {
  return {
    url, final_url: url, status: 200, kind: "page", depth: 1, inlinks: 3, title: "Default title here", meta_description: "A description",
    h1: ["Default heading here"], text_excerpt: words(200), word_count: 200, lang: "en", schema_types: [], schema_nodes: [],
    links_internal: [{ url: `${BASE}/a`, anchor: "a" }, { url: `${BASE}/b`, anchor: "b" }, { url: `${BASE}/c`, anchor: "c" }],
    links_external: [], images: { total: 1, missing_alt: 0, lazy: 0 }, twitter_card: "summary", ...over,
  };
}

function audit(pages: EnginePage[]): EngineAudit {
  const a = fixtureAudit() as EngineAudit;
  a.site = { ...a.site, final_url: `${BASE}/`, domain: "shop.example.org" };
  a.pages = pages;
  return a;
}

const ids = (r: ReturnType<typeof runExtraChecks>) => r.findings.map((f) => f.id);

describe("text helpers", () => {
  it("matches phrases on word boundaries with light stemming", () => {
    expect(containsPhrase("Python Job Board | Python.org", "python jobs")).toBe(true);
    expect(containsPhrase("Our Services", "service")).toBe(true);
    expect(containsPhrase("pythonic code", "python")).toBe(false);
    expect(containsPhrase("Café menu", "cafe")).toBe(true);
  });
  it("scores readability and needs enough text", () => {
    expect(fleschReadingEase("Too short.")).toBeNull();
    const easy = Array.from({ length: 30 }, () => "The cat sat on the mat.").join(" ");
    expect(fleschReadingEase(easy)!).toBeGreaterThan(80);
  });
  it("detects articles from schema or blog paths", () => {
    expect(isArticle(page(`${BASE}/blog/how-to-x`, { word_count: 400 }))).toBe(true);
    expect(isArticle(page(`${BASE}/pricing`, { schema_types: ["BlogPosting"] }))).toBe(true);
    expect(isArticle(page(`${BASE}/pricing`))).toBe(false);
  });
});

describe("focus keyword checks", () => {
  const pages = [
    page(`${BASE}/`, { title: "Shop | Example", h1: ["Welcome"], depth: 0 }),
    page(`${BASE}/running-shoes`, {
      title: "Running Shoes for Trail and Road",
      h1: ["Running shoes"],
      meta_description: "Lightweight running shoes for trail and road.",
      text_excerpt: `Our running shoes are built for trail and road. ${words(400)}`,
      word_count: 410,
    }),
    page(`${BASE}/socks`, { title: "Socks", h1: ["Socks"], text_excerpt: `${words(150)} hiking boots mentioned once`, word_count: 160 }),
  ];

  it("skips keyword checks without keywords", () => {
    const r = runExtraChecks(audit(pages), []);
    expect(r.skipped.map((s) => s.id)).toEqual(EXTRA_CHECKS.filter((c) => c.needsKeywords).map((c) => c.id));
    expect(ids(r).some((i) => i.startsWith("kw_"))).toBe(false);
  });

  it("finds the best page and checks placement like Rank Math", () => {
    const r = runExtraChecks(audit(pages), ["running shoes", "hiking boots", "rain jackets"]);
    const shoes = r.keywordReport.find((k) => k.keyword === "running shoes")!;
    expect(shoes.targetUrl).toBe(`${BASE}/running-shoes`);
    expect(shoes.checks).toEqual({ title: true, h1: true, url: true, meta: true, intro: true });
    const boots = r.keywordReport.find((k) => k.keyword === "hiking boots")!;
    expect(boots.targetUrl).toBe(`${BASE}/socks`);
    expect(boots.checks).toMatchObject({ title: false, h1: false, url: false, meta: false });
    expect(r.keywordReport.find((k) => k.keyword === "rain jackets")!.targetUrl).toBeNull();
    expect(ids(r)).toEqual(expect.arrayContaining(["kw_no_page", "kw_title", "kw_h1", "kw_url", "kw_meta", "kw_thin"]));
  });

  it("flags keyword stuffing on the target page", () => {
    const stuffed = page(`${BASE}/cheap-watches`, { title: "Cheap watches", h1: ["Cheap watches"], text_excerpt: `${"cheap watches ".repeat(40)}${words(200)}`, word_count: 280 });
    const r = runExtraChecks(audit([page(`${BASE}/`, { depth: 0 }), stuffed]), ["cheap watches"]);
    expect(ids(r)).toContain("kw_density_high");
  });
});

describe("E-E-A-T, schema, URL and link checks", () => {
  it("flags missing trust pages, authors, dates and organization markup", () => {
    const art = page(`${BASE}/blog/guide-to-x`, { word_count: 600, text_excerpt: words(600) });
    const r = runExtraChecks(audit([page(`${BASE}/`, { depth: 0 }), art]), []);
    expect(ids(r)).toEqual(expect.arrayContaining(["eeat_about", "eeat_contact", "eeat_privacy", "eeat_author", "eeat_dates", "eeat_org_schema", "schema_article", "schema_breadcrumb", "links_no_outbound", "eeat_contact_details"]));
  });

  it("passes when the signals are present", () => {
    const home = page(`${BASE}/`, {
      depth: 0,
      text_excerpt: `Call us on +1 415 555 0100 or hello@example.org. ${words(200)}`,
      schema_types: ["Organization"],
      schema_nodes: [{ types: ["Organization"], keys: ["name", "logo", "sameAs", "url"] }],
      links_internal: [
        { url: `${BASE}/about-us`, anchor: "About us" },
        { url: `${BASE}/contact`, anchor: "Contact" },
        { url: `${BASE}/privacy-policy`, anchor: "Privacy" },
        { url: `${BASE}/terms`, anchor: "Terms" },
      ],
    });
    const art = page(`${BASE}/blog/guide-to-x`, {
      word_count: 600,
      text_excerpt: `By Jane Smith. Updated March 3, 2026. ${words(600)}`,
      schema_types: ["BlogPosting", "BreadcrumbList"],
      schema_nodes: [{ types: ["BlogPosting"], keys: ["headline", "author", "datePublished"] }],
      links_external: [{ url: "https://source.example.com/study", anchor: "study" }],
    });
    const found = ids(runExtraChecks(audit([home, art]), []));
    for (const id of ["eeat_about", "eeat_contact", "eeat_privacy", "eeat_terms", "eeat_author", "eeat_dates", "eeat_org_schema", "eeat_sameas", "schema_article", "schema_breadcrumb", "links_no_outbound", "eeat_contact_details"]) {
      expect(found, id).not.toContain(id);
    }
  });

  it("checks URL structure, internal links, lazy loading and title/H1 alignment", () => {
    const r = runExtraChecks(
      audit([
        page(`${BASE}/`, { depth: 0 }),
        page(`${BASE}/Products/Blue_Widget?ref=nav`, { links_internal: [], inlinks: 1, depth: 2, images: { total: 12, missing_alt: 0, lazy: 0 } }),
        page(`${BASE}/pricing`, { title: "Pricing plans and costs | Shop", h1: ["Meet our friendly support team"] }),
      ]),
      [],
    );
    expect(ids(r)).toEqual(expect.arrayContaining(["url_uppercase", "url_underscores", "url_params", "links_internal_low", "links_weak_inlinks", "images_lazy", "title_h1_mismatch"]));
  });

  it("only evaluates indexable HTML pages", () => {
    const r = runExtraChecks(audit([page(`${BASE}/`, { depth: 0 }), page(`${BASE}/Hidden_Page`, { meta_robots: "noindex" }), page(`${BASE}/Gone_Page`, { status: 404 })]), []);
    expect(ids(r)).not.toContain("url_uppercase");
  });

  it("every finding references a defined check and a fix", () => {
    const r = runExtraChecks(audit([page(`${BASE}/`, { depth: 0 }), page(`${BASE}/blog/a-post`, { word_count: 500 })]), ["anything"]);
    for (const f of r.findings) {
      expect(EXTRA_CHECKS.find((c) => c.id === f.id)).toBeTruthy();
      expect(f.fix.length).toBeGreaterThan(10);
      expect(f.urls.length).toBe(f.count);
    }
  });
});

describe("extra checks API", () => {
  let sb: ReturnType<typeof makeSandbox>;
  const ID = "iana.org-2026-11-18-0812";
  beforeAll(() => {
    sb = makeSandbox();
    installAudit(sb.reports, ID);
  });
  afterAll(() => sb.cleanup());
  const ctx = <P,>(p: P) => ({ params: Promise.resolve(p) });

  it("stores keywords per audit and re-runs checks with them", async () => {
    const kw = await import("@/app/api/audits/[id]/keywords/route");
    const extra = await import("@/app/api/audits/[id]/extra/route");
    let body = await (await extra.GET(jsonReq("", "GET"), ctx({ id: ID }))).json();
    expect(body.keywords).toEqual([]);
    expect(body.skipped.length).toBeGreaterThan(0);
    const put = await kw.PUT(jsonReq("", "PUT", { keywords: [" domains ", "domains", "root zone"] }), ctx({ id: ID }));
    expect(await put.json()).toEqual({ keywords: ["domains", "root zone"] });
    body = await (await extra.GET(jsonReq("", "GET"), ctx({ id: ID }))).json();
    expect(body.keywords).toEqual(["domains", "root zone"]);
    expect(body.keywordReport).toHaveLength(2);
    expect(body.skipped).toEqual([]);
  });

  it("validates keyword input and unknown audits", async () => {
    const kw = await import("@/app/api/audits/[id]/keywords/route");
    expect((await kw.PUT(jsonReq("", "PUT", { keywords: Array.from({ length: 11 }, (_, i) => `k${i}`) }), ctx({ id: ID }))).status).toBe(400);
    expect((await kw.PUT(jsonReq("", "PUT", { keywords: ["x".repeat(81)] }), ctx({ id: ID }))).status).toBe(400);
    expect((await kw.PUT(jsonReq("", "PUT", { keywords: ["a"] }), ctx({ id: "nope-2026" }))).status).toBe(404);
    const cleared = await (await kw.PUT(jsonReq("", "PUT", { keywords: [] }), ctx({ id: ID }))).json();
    expect(cleared.keywords).toEqual([]);
  });
});
