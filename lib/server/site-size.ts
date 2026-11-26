import "server-only";
import { gunzipSync } from "node:zlib";
import { validateAuditTarget, type Resolver } from "./url-guard";

/**
 * "How many pages does this site have?" — answered before any crawl, from the site's own
 * robots.txt and XML sitemaps (sitemap indexes and .gz files included), plus a count of the
 * homepage's internal links as a fallback lower bound.
 *
 * Every request (and every redirect hop) passes the same private-network guard as audits.
 */

export const LIMITS = {
  maxSitemapFiles: 100,
  maxUrls: 200_000,
  maxBytes: 30 * 1024 * 1024, // per file, after decompression
  timeoutMs: 15_000,
  totalMs: 60_000,
};

export interface SitemapFile {
  url: string;
  type: "urlset" | "sitemapindex" | "unknown";
  urls: number;
  children?: number;
  error: string | null;
}

export interface SiteSize {
  inputUrl: string;
  finalUrl: string;
  host: string;
  robotsFound: boolean;
  sitemapsDeclared: number;
  sitemapFiles: SitemapFile[];
  /** Unique same-site page URLs listed across all sitemaps */
  sitemapUrlCount: number;
  /** Unique same-site URLs linked from the homepage (lower bound when there is no sitemap) */
  homepageLinks: number;
  sample: string[];
  truncated: boolean;
  /** Best available estimate and where it came from */
  estimate: number;
  basis: "sitemap" | "homepage-links";
  durationMs: number;
  notes: string[];
  /** SEO signals read from the homepage HTML (used by monitoring to spot changes). */
  homepage: HomepageSignals;
  /** Every sitemap URL, only when requested with `collectUrls` (monitoring); never sent to the browser. */
  urls?: string[];
}

export interface HomepageSignals {
  status: number;
  title: string | null;
  description: string | null;
  h1: string | null;
  canonical: string | null;
  robots: string | null;
}

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

export interface SiteSizeDeps {
  resolver?: Resolver;
  fetcher?: Fetcher;
  collectUrls?: boolean;
}

const clean = (s: string | undefined | null) => (s == null ? null : decodeXml(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim() || null);
function metaContent(html: string, attr: "name" | "property", value: string): string | null {
  const tag = [...html.matchAll(/<meta\s[^>]*>/gi)].map((m) => m[0]).find((t) => new RegExp(`${attr}\\s*=\\s*["']${value}["']`, "i").test(t));
  return tag ? clean(/content\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1]) : null;
}

/** Title, description, first H1, canonical and robots from homepage HTML. */
export function homepageSignals(status: number, html: string): HomepageSignals {
  const canonicalTag = [...html.matchAll(/<link\s[^>]*>/gi)].map((m) => m[0]).find((t) => /rel\s*=\s*["']canonical["']/i.test(t));
  return {
    status,
    title: clean(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]),
    description: metaContent(html, "name", "description"),
    h1: clean(/<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1]),
    canonical: canonicalTag ? (/href\s*=\s*["']([^"']*)["']/i.exec(canonicalTag)?.[1] ?? null) : null,
    robots: metaContent(html, "name", "robots"),
  };
}

const hostKey = (h: string) => h.toLowerCase().replace(/^www\./, "");

class GuardedClient {
  private allowed = new Map<string, boolean>();
  constructor(private deps: SiteSizeDeps, private deadline: number) {}

  private async hostOk(url: string): Promise<boolean> {
    let host: string;
    try {
      host = new URL(url).host;
    } catch {
      return false;
    }
    if (!this.allowed.has(host)) this.allowed.set(host, (await validateAuditTarget(url, this.deps.resolver)).ok);
    return this.allowed.get(host)!;
  }

  /** GET with manual redirects; every hop must be a public http(s) URL. Returns body bytes. */
  async get(url: string): Promise<{ finalUrl: string; status: number; body: Buffer; type: string } | { error: string }> {
    const fetcher = this.deps.fetcher ?? fetch;
    let current = url;
    for (let hop = 0; hop < 6; hop++) {
      if (Date.now() > this.deadline) return { error: "time limit reached" };
      if (!(await this.hostOk(current))) return { error: "blocked: not a public address" };
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), LIMITS.timeoutMs);
      let res: Response;
      try {
        res = await fetcher(current, {
          redirect: "manual",
          signal: ac.signal,
          headers: { "User-Agent": "Mozilla/5.0 (compatible; SiteSizeCounter/1.0)", Accept: "application/xml,text/xml,text/html;q=0.9,*/*;q=0.5" },
        });
      } catch (e) {
        clearTimeout(t);
        return { error: (e as Error).name === "AbortError" ? "timed out" : "unreachable" };
      }
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        clearTimeout(t);
        current = new URL(res.headers.get("location")!, current).toString();
        continue;
      }
      try {
        const reader = res.body?.getReader();
        const chunks: Uint8Array[] = [];
        let size = 0;
        if (reader) {
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > LIMITS.maxBytes) {
              await reader.cancel();
              return { error: "file too large" };
            }
            chunks.push(value);
          }
        }
        return { finalUrl: current, status: res.status, body: Buffer.concat(chunks), type: res.headers.get("content-type") ?? "" };
      } catch {
        return { error: "download failed" };
      } finally {
        clearTimeout(t);
      }
    }
    return { error: "too many redirects" };
  }
}

const decodeXml = (s: string) =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").trim();

/** Parse a sitemap or sitemap index without an XML library (no entity expansion, no DTDs). */
export function parseSitemap(xml: string): { type: SitemapFile["type"]; locs: string[] } {
  const body = xml.replace(/<!--[\s\S]*?-->/g, "");
  const isIndex = /<(?:[\w-]+:)?sitemapindex[\s>]/i.test(body);
  const isUrlset = /<(?:[\w-]+:)?urlset[\s>]/i.test(body);
  const block = isIndex ? "sitemap" : "url";
  const locs: string[] = [];
  const re = new RegExp(`<(?:[\\w-]+:)?${block}[\\s>][\\s\\S]*?<(?:[\\w-]+:)?loc>([\\s\\S]*?)</(?:[\\w-]+:)?loc>`, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) locs.push(decodeXml(m[1]));
  return { type: isIndex ? "sitemapindex" : isUrlset ? "urlset" : "unknown", locs };
}

function normalizePageUrl(u: string): string | null {
  try {
    const x = new URL(u);
    if (x.protocol !== "http:" && x.protocol !== "https:") return null;
    x.hash = "";
    return x.toString();
  } catch {
    return null;
  }
}

export async function countSitePages(input: string, deps: SiteSizeDeps = {}): Promise<SiteSize> {
  const started = Date.now();
  const target = await validateAuditTarget(input, deps.resolver);
  if (!target.ok || !target.url) throw Object.assign(new Error(target.error ?? "Invalid URL."), { status: 422 });
  const client = new GuardedClient(deps, started + LIMITS.totalMs);
  const notes: string[] = [];

  const home = await client.get(target.url);
  if ("error" in home) throw Object.assign(new Error(`Could not reach the site (${home.error}).`), { status: 422 });
  const finalUrl = home.finalUrl;
  const origin = new URL(finalUrl).origin;
  const site = hostKey(new URL(finalUrl).host);
  const sameSite = (u: string) => {
    try {
      return hostKey(new URL(u).host) === site;
    } catch {
      return false;
    }
  };

  // Homepage internal links (lower bound)
  const homeLinks = new Set<string>();
  const homeHtml = /html/i.test(home.type) ? home.body.toString("utf8") : "";
  if (home.status === 200 && homeHtml) {
    const html = homeHtml;
    const re = /<a\s[^>]*href\s*=\s*["']([^"']+)["']/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html))) {
      const raw = m[1].trim();
      if (!raw || raw.startsWith("#") || /^(mailto|tel|javascript|data):/i.test(raw)) continue;
      const abs = normalizePageUrl(new URL(raw, finalUrl).toString());
      if (abs && sameSite(abs)) homeLinks.add(abs);
    }
  }

  // robots.txt -> declared sitemaps
  const robots = await client.get(`${origin}/robots.txt`);
  let declared: string[] = [];
  const robotsFound = !("error" in robots) && robots.status === 200 && !/html/i.test(robots.type);
  if (robotsFound && !("error" in robots)) {
    declared = [...robots.body.toString("utf8").matchAll(/^\s*sitemap:\s*(\S+)/gim)].map((m) => m[1]);
  }
  const queue = declared.length ? [...declared] : [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`, `${origin}/wp-sitemap.xml`];
  if (!declared.length) notes.push("robots.txt declares no sitemap; tried the common sitemap locations.");

  const seenFiles = new Set<string>();
  const files: SitemapFile[] = [];
  const urls = new Set<string>();
  let truncated = false;
  while (queue.length) {
    const sm = queue.shift()!;
    if (seenFiles.has(sm)) continue;
    if (seenFiles.size >= LIMITS.maxSitemapFiles || Date.now() > started + LIMITS.totalMs || urls.size >= LIMITS.maxUrls) {
      truncated = true;
      break;
    }
    seenFiles.add(sm);
    const r = await client.get(sm);
    if ("error" in r) {
      files.push({ url: sm, type: "unknown", urls: 0, error: r.error });
      continue;
    }
    if (r.status !== 200) {
      files.push({ url: sm, type: "unknown", urls: 0, error: `HTTP ${r.status}` });
      continue;
    }
    let buf = r.body;
    if (sm.endsWith(".gz") || (buf[0] === 0x1f && buf[1] === 0x8b)) {
      try {
        buf = gunzipSync(buf, { maxOutputLength: LIMITS.maxBytes });
      } catch {
        files.push({ url: sm, type: "unknown", urls: 0, error: "could not decompress" });
        continue;
      }
    }
    const { type, locs } = parseSitemap(buf.toString("utf8"));
    if (type === "unknown") {
      files.push({ url: sm, type, urls: 0, error: "not a sitemap" });
      continue;
    }
    if (type === "sitemapindex") {
      files.push({ url: sm, type, urls: 0, children: locs.length, error: null });
      queue.push(...locs.filter((l) => !seenFiles.has(l)));
    } else {
      let n = 0;
      for (const l of locs) {
        const u = normalizePageUrl(l);
        if (!u || !sameSite(u)) continue;
        n++;
        if (urls.size < LIMITS.maxUrls) urls.add(u);
        else truncated = true;
      }
      files.push({ url: sm, type, urls: n, error: null });
    }
  }
  // Drop the "common location" misses when another candidate worked, to keep the report clean.
  const okFiles = files.filter((f) => !f.error);
  const shownFiles = declared.length || !okFiles.length ? files : okFiles;
  if (truncated) notes.push(`Stopped early (limits: ${LIMITS.maxSitemapFiles} sitemap files, ${LIMITS.maxUrls.toLocaleString()} URLs, ${LIMITS.totalMs / 1000} s). The real total is higher.`);
  if (!urls.size) notes.push("No usable sitemap found, so the estimate is the number of pages the homepage links to. The real site is usually larger.");

  return {
    inputUrl: input,
    finalUrl,
    host: new URL(finalUrl).host,
    robotsFound,
    sitemapsDeclared: declared.length,
    sitemapFiles: shownFiles,
    sitemapUrlCount: urls.size,
    homepageLinks: homeLinks.size,
    sample: [...urls].slice(0, 8),
    truncated,
    estimate: urls.size || Math.max(1, homeLinks.size + (homeLinks.has(finalUrl) ? 0 : 1)),
    basis: urls.size ? "sitemap" : "homepage-links",
    durationMs: Date.now() - started,
    notes,
    homepage: homepageSignals(home.status, homeHtml),
    ...(deps.collectUrls ? { urls: [...urls] } : {}),
  };
}
