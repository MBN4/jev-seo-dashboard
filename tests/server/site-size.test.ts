import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { countSitePages, parseSitemap } from "@/lib/server/site-size";

const pub = async () => ["93.184.216.34"];

/** Fake web: path -> response. Hosts not listed return 404. */
function web(routes: Record<string, { status?: number; body?: string | Buffer; type?: string; location?: string }>) {
  const calls: string[] = [];
  const fetcher = async (url: string) => {
    calls.push(url);
    const r = routes[url];
    if (!r) return new Response("not found", { status: 404 });
    const headers: Record<string, string> = { "content-type": r.type ?? "text/html" };
    if (r.location) headers.location = r.location;
    return new Response((r.body ?? "") as BodyInit, { status: r.status ?? 200, headers });
  };
  return { fetcher: fetcher as unknown as typeof fetch, calls };
}

const urlset = (urls: string[]) => `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${u}</loc></url>`).join("")}</urlset>`;
const index = (maps: string[]) => `<?xml version="1.0"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${maps.map((u) => `<sitemap><loc>${u}</loc></sitemap>`).join("")}</sitemapindex>`;

describe("sitemap parsing", () => {
  it("reads urlsets, indexes, CDATA, entities and ignores comments", () => {
    expect(parseSitemap(urlset(["https://a.org/x?a=1&amp;b=2", "https://a.org/y"]))).toEqual({ type: "urlset", locs: ["https://a.org/x?a=1&b=2", "https://a.org/y"] });
    expect(parseSitemap(index(["https://a.org/s1.xml"])).type).toBe("sitemapindex");
    expect(parseSitemap("<urlset><url><loc><![CDATA[https://a.org/c]]></loc></url><!-- <url><loc>https://a.org/hidden</loc></url> --></urlset>").locs).toEqual(["https://a.org/c"]);
    expect(parseSitemap("<html>nope</html>").type).toBe("unknown");
  });
});

describe("counting a site's pages", () => {
  it("follows robots.txt -> sitemap index -> gzipped child sitemaps and dedupes same-site URLs", async () => {
    const { fetcher } = web({
      "https://shop.example.org/": { body: '<a href="/a">a</a><a href="/b">b</a>' },
      "https://shop.example.org/robots.txt": { body: "User-agent: *\nSitemap: https://shop.example.org/sitemap_index.xml", type: "text/plain" },
      "https://shop.example.org/sitemap_index.xml": { body: index(["https://shop.example.org/s1.xml", "https://shop.example.org/s2.xml.gz"]), type: "application/xml" },
      "https://shop.example.org/s1.xml": { body: urlset(["https://shop.example.org/a", "https://www.shop.example.org/b", "https://other.com/x"]), type: "application/xml" },
      "https://shop.example.org/s2.xml.gz": { body: gzipSync(urlset(["https://shop.example.org/c", "https://shop.example.org/a"])), type: "application/gzip" },
    });
    const r = await countSitePages("shop.example.org", { resolver: pub, fetcher });
    expect(r.basis).toBe("sitemap");
    expect(r.sitemapUrlCount).toBe(3); // a, b (www variant is same site), c; other.com excluded; duplicate a once
    expect(r.estimate).toBe(3);
    expect(r.sitemapsDeclared).toBe(1);
    expect(r.sitemapFiles.map((f) => [f.type, f.urls, f.children ?? null])).toEqual([["sitemapindex", 0, 2], ["urlset", 2], ["urlset", 2]].map((x) => (x.length === 2 ? [...x, null] : x)));
    expect(r.homepageLinks).toBe(2);
  });

  it("tries common locations when robots.txt declares none, and falls back to homepage links", async () => {
    const { fetcher, calls } = web({
      "https://plain.example.org/": { body: '<a href="/p1">1</a><a href="/p2#x">2</a><a href="https://elsewhere.com/">e</a><a href="mailto:x@y.z">m</a>' },
    });
    const r = await countSitePages("https://plain.example.org", { resolver: pub, fetcher });
    expect(calls).toEqual(expect.arrayContaining(["https://plain.example.org/sitemap.xml", "https://plain.example.org/sitemap_index.xml", "https://plain.example.org/wp-sitemap.xml"]));
    expect(r.basis).toBe("homepage-links");
    expect(r.homepageLinks).toBe(2);
    expect(r.estimate).toBe(3); // the two linked pages plus the homepage itself
    expect(r.notes.join(" ")).toMatch(/No usable sitemap/);
  });

  it("refuses private targets and redirects into private networks", async () => {
    await expect(countSitePages("http://127.0.0.1/", { resolver: pub, fetcher: web({}).fetcher })).rejects.toThrow(/private|local|reserved/i);
    const resolver = async (host: string) => (host === "internal.example.org" ? ["10.0.0.5"] : ["93.184.216.34"]);
    const { fetcher, calls } = web({
      "https://ok.example.org/": { body: "<a href='/x'>x</a>" },
      "https://ok.example.org/robots.txt": { body: "Sitemap: https://ok.example.org/sm.xml", type: "text/plain" },
      "https://ok.example.org/sm.xml": { status: 302, location: "https://internal.example.org/secret.xml" },
    });
    const r = await countSitePages("ok.example.org", { resolver, fetcher });
    expect(calls).not.toContain("https://internal.example.org/secret.xml");
    expect(r.sitemapFiles[0].error).toMatch(/blocked/);
  });

  it("reports unreachable sites as a 422", async () => {
    const fetcher = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    await expect(countSitePages("down.example.org", { resolver: pub, fetcher })).rejects.toMatchObject({ status: 422 });
  });
});
