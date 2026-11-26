import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { installAudit, jsonReq, makeSandbox } from "../helpers";
import { markdownHref, statusLabel, strayCharsHref } from "@/lib/server/finding-breakdown";

let sb: ReturnType<typeof makeSandbox>;
const ID = "shop.example.org-2026-01-02-0000";
const BASE = "https://shop.example.org";
const CF = `${BASE}/cdn-cgi/l/email-protection`;
const MD = `${BASE}/de/x/[https:/app.example.org?l=de](https://app.example.org?l=de)`;
const STRAY = `${BASE}/services%5C%5C%22`;
const page = (url: string, over: Record<string, unknown> = {}) => ({
  url, final_url: url, status: 200, kind: "page", depth: 1, inlinks: 3, title: `Title for ${url}`, meta_description: "x".repeat(120),
  h1: ["Heading"], word_count: 400, text_hash: url, links_internal: [], links_external: [], images: { total: 0, missing_alt: 0 }, schema_types: [], ...over,
});
const finding = (id: string, urls: string[], over: Record<string, unknown> = {}) => ({
  id, origin: "rule", category: "links", severity: "high", title: id, fix: "Fix it.", effort: 2, heuristic: false, urls, count: urls.length, evidence: "…", detail: {}, ...over,
});

beforeAll(() => {
  sb = makeSandbox();
  installAudit(sb.reports, ID, (a) => {
    a.site = { ...a.site, final_url: `${BASE}/`, domain: "shop.example.org", link_status: { [CF]: 404, [MD]: null, [STRAY]: 404, [`${BASE}/services`]: 200, [`${BASE}/old`]: 301 } };
    a.pages = [
      page(`${BASE}/`, { depth: 0, links_internal: [{ url: CF, anchor: "[email protected]" }, { url: `${BASE}/old`, anchor: "Docs" }] }),
      page(`${BASE}/a`, { links_internal: [{ url: CF, anchor: "[email protected]" }, { url: MD, anchor: "app" }, { url: `${BASE}/old`, anchor: "Docs" }], meta_robots: "noindex, follow" }),
      page(`${BASE}/b`, { links_internal: [{ url: STRAY, anchor: "our services" }], outline: ["h1: Top", "h2: Two", "h4: Skipped"], heading_skips: 1 }),
      page(`${BASE}/services`),
      page(`${BASE}/new`),
      { url: `${BASE}/old`, final_url: `${BASE}/new`, status: 301, kind: "redirect", redirect_chain: [{ url: `${BASE}/old`, status: 301 }, { url: `${BASE}/mid`, status: 302 }] },
    ];
    a.findings = [
      finding("broken_internal_links", [`${BASE}/`, `${BASE}/a`, `${BASE}/b`], { detail: { targets: { [CF]: [`${BASE}/`] } } }),
      finding("links_to_redirects", [`${BASE}/`, `${BASE}/a`], { severity: "low" }),
      finding("redirect_chains", [`${BASE}/old`], { severity: "medium" }),
      finding("noindex", [`${BASE}/a`]),
      finding("heading_skips", [`${BASE}/b`], { severity: "low" }),
    ];
    a.actions = [];
  });
});
afterAll(() => sb.cleanup());
const ctx = <P,>(p: P) => ({ params: Promise.resolve(p) });

async function detail(fid: string) {
  const { GET } = await import("@/app/api/audits/[id]/findings/[findingId]/route");
  const res = await GET(jsonReq("", "GET"), ctx({ id: ID, findingId: fid }));
  expect(res.status).toBe(200);
  return (await res.json()).breakdown;
}

describe("finding breakdown", () => {
  it("recognises link patterns from the URL text alone", () => {
    expect(markdownHref(MD)).toBe("https://app.example.org?l=de");
    expect(markdownHref(`${BASE}/plain`)).toBeNull();
    expect(strayCharsHref(STRAY)).toBe(`${BASE}/services`);
    expect(strayCharsHref(`${BASE}/x'`)).toBe(`${BASE}/x`);
    expect(strayCharsHref(`${BASE}/x`)).toBeNull();
    expect(statusLabel(null).text).toBe("Unreachable");
    expect(statusLabel(404).tone).toBe("bad");
  });

  it("groups broken links by target with every source page, anchor and a concrete fix", async () => {
    const b = await detail("broken_internal_links");
    expect(b.headline).toMatch(/^3 broken addresses are linked from 3 pages/);
    const keys = b.groups.map((g: { key: string }) => g.key);
    expect(keys).toEqual([CF, MD, STRAY]); // most-linked first; targets beyond the engine's detail are recomputed
    const cf = b.groups[0];
    expect(cf.total).toBe(2);
    expect(cf.items.map((i: { url: string }) => i.url)).toEqual([`${BASE}/`, `${BASE}/a`]);
    expect(cf.items[0].note).toContain("[email protected]");
    expect(cf.explain).toMatch(/Cloudflare/);
    expect(b.groups[1].suggestion.value.href).toBe("https://app.example.org?l=de");
    expect(b.groups[1].badge.text).toBe("Unreachable");
    expect(b.groups[2].suggestion).toMatchObject({ label: "Change the link to", value: { href: `${BASE}/services` } });
    expect(b.notes.map((n: { title: string }) => n.title).join(" ")).toMatch(/Cloudflare.*Markdown/);
    expect(b.steps.length).toBeGreaterThan(1);
    expect(b.meaning).toBeTruthy();
  });

  it("names the final address for links through redirects and shows each chain hop", async () => {
    const r = await detail("links_to_redirects");
    expect(r.groups[0]).toMatchObject({ key: `${BASE}/old`, total: 2, suggestion: { label: "Link straight to", value: { href: `${BASE}/new` } } });
    const c = await detail("redirect_chains");
    const chain = c.table.rows[0].chain.map((x: { text: string }) => x.text);
    expect(chain).toEqual(["301 /old", "302 /mid", "200 /new (final)"]);
  });

  it("says where a noindex comes from and which heading level is skipped", async () => {
    const n = await detail("noindex");
    expect(n.headline).toBe("1 page tells Google not to index it. It looks like a real content page.");
    expect(n.verdict).toMatchObject({ tone: "bad", title: "Check 1 page" });
    expect(n.table.rows[0].where[0].text).toBe("meta robots: noindex, follow");
    const h = await detail("heading_skips");
    expect(h.table.rows[0].skip.text).toBe("h2 → h4: “Skipped”");
  });
});
