/**
 * Plain-language breakdown of one finding, built from the saved crawl data.
 *
 * The engine's finding carries a list of URLs and a one-line evidence string. This module
 * re-reads the crawl (the same data the engine's rule used) to answer the question a user
 * actually has: "which link, on which page, points where, and what exactly do I change?"
 * Nothing here is guessed. Every row comes from a field the engine recorded. Special cases
 * (a Cloudflare email-protection link, an href containing Markdown) are recognised from the
 * URL text itself and explained.
 */
import { CHECKLIST } from "@/lib/google-checklist";
import type { EngineAudit, EngineFinding, EnginePage } from "@/types/engine";

export type Tone = "bad" | "warn" | "good" | "info" | "muted";

/** A value shown in a breakdown. `href` makes it a link; `page` marks a crawled page the UI can inspect. */
export interface Cell {
  text: string;
  href?: string;
  page?: boolean;
  tone?: Tone;
  mono?: boolean;
}

export interface BreakdownGroup {
  key: string;
  title: Cell;
  badge?: { text: string; tone: Tone };
  /** Short explanation specific to this group, e.g. why this link is broken. */
  explain?: string;
  /** What to change it to, when the data tells us. */
  suggestion?: { label: string; value: Cell };
  itemsLabel: string;
  items: Array<{ url: string; note?: string }>;
  total: number;
}

export interface BreakdownTable {
  columns: Array<{ key: string; label: string; align?: "right" }>;
  rows: Array<Record<string, Cell | Cell[] | null>>;
  total: number;
}

export interface BreakdownNote {
  tone: "info" | "warn" | "good";
  title: string;
  text: string;
}

export interface Breakdown {
  /** One sentence in plain words: what was found and how much. */
  headline: string;
  /** Why this matters for Google and visitors. */
  meaning: string | null;
  /** Concrete steps, in order. */
  steps: string[];
  notes: BreakdownNote[];
  groups: BreakdownGroup[] | null;
  table: BreakdownTable | null;
  /** "Should I act on this?" in one line. */
  verdict: Verdict;
}

export interface Verdict {
  tone: "good" | "info" | "warn" | "bad";
  title: string;
  text: string;
}

/** Pages that sites usually keep out of Google on purpose, recognised from the URL. */
export function intendedNoindexReason(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const p = u.pathname.toLowerCase();
  const q = u.search.toLowerCase();
  if (/\/page\/\d+\/?$/.test(p) || /[?&](page|paged|p)=\d+/.test(q)) return "Pagination (page 2, 3…)";
  if (/\/(author|authors)\//.test(p)) return "Author archive";
  if (/\/(tag|tags)\//.test(p)) return "Tag archive";
  if (/[?&]s=|\/search(\/|$)/.test(p + q)) return "Site search results";
  if (/\/(cart|checkout|basket|my-account|account|login|log-in|signin|sign-in|signup|sign-up|register|wp-admin|admin|dashboard)(\/|$)/.test(p)) return "Account, login or checkout";
  if (/\/(thank-you|thanks|thankyou|confirmation|success)(\/|$)/.test(p)) return "Thank-you or confirmation page";
  if (/\/(privacy|privacy-policy|terms|terms-of-service|terms-and-conditions|cookie|cookies|cookie-policy|legal|disclaimer|gdpr)(\/|$)/.test(p)) return "Legal page";
  if (/\/(feed|rss)(\/|$)/.test(p)) return "Feed";
  return null;
}

const SEVERITY_VERDICT: Record<string, Verdict> = {
  critical: { tone: "bad", title: "Fix this first", text: "This can stop pages, or the whole site, from appearing in Google." },
  high: { tone: "bad", title: "Fix soon", text: "This directly hurts how these pages are crawled, indexed or ranked." },
  medium: { tone: "warn", title: "Worth fixing", text: "This weakens these pages in search. It is not urgent, but it adds up." },
  low: { tone: "info", title: "Nice to have", text: "A small improvement. Do it when you are already editing these pages." },
  info: { tone: "good", title: "For information", text: "Nothing is broken. This is context for your decisions." },
};

const MAX_ROWS = 300;
const MAX_ITEMS = 60;

const n = (x: number) => x.toLocaleString("en-US");
const plural = (x: number, one: string, many = `${one}s`) => `${n(x)} ${x === 1 ? one : many}`;
const SINGULAR: Record<string, string> = { only: "only", include: "includes", contain: "contains", point: "points", are: "is", have: "has", do: "does", need: "needs", load: "loads", tell: "tells", return: "returns", list: "lists", jump: "jumps", fall: "falls", use: "uses", redirect: "redirects", link: "links" };
/** "3 pages have …" / "1 page has …": the count phrase plus the rest, with the first verb agreeing. */
const say = (x: number, one: string, rest: string, many = `${one}s`) => `${plural(x, one, many)} ${x === 1 ? rest.replace(/^(\w+)/, (w) => SINGULAR[w] ?? w) : rest}`;

function pathOf(url: string, home?: URL): string {
  try {
    const u = new URL(url);
    if (home && u.host !== home.host) return `${u.host}${u.pathname}${u.search}`;
    return `${u.pathname}${u.search}` || "/";
  } catch {
    return url;
  }
}

function isHttp(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

function urlCell(url: string, pages: Map<string, EnginePage>): Cell {
  return { text: url, href: isHttp(url) ? url : undefined, page: pages.has(url), mono: true };
}

function htmlPages(a: EngineAudit): EnginePage[] {
  return a.pages.filter((p) => p.kind === "page" && p.status === 200 && typeof p.word_count === "number");
}

export function statusLabel(st: number | null | undefined): { text: string; tone: Tone } {
  if (st == null) return { text: "Unreachable", tone: "bad" };
  if (st === 404) return { text: "404 Not found", tone: "bad" };
  if (st === 410) return { text: "410 Gone", tone: "bad" };
  if (st === 403) return { text: "403 Forbidden", tone: "bad" };
  if (st === 401) return { text: "401 Login required", tone: "warn" };
  if (st === 429) return { text: "429 Rate limited", tone: "warn" };
  if (st >= 500) return { text: `${st} Server error`, tone: "bad" };
  if (st >= 400) return { text: `${st} Client error`, tone: "bad" };
  if (st === 301 || st === 308) return { text: `${st} Permanent redirect`, tone: "warn" };
  if (st >= 300) return { text: `${st} Temporary redirect`, tone: "warn" };
  return { text: `${st} OK`, tone: "good" };
}

/** Links whose href has Markdown in it: `/path/[label](https://real.url)`. Returns the intended URL. */
export function markdownHref(url: string): string | null {
  const m = /\]\((https?:\/\/[^)\s]+)\)/.exec(decodeSafe(url));
  return m ? m[1] : null;
}

function decodeSafe(s: string): string {
  try {
    return decodeURI(s);
  } catch {
    return s;
  }
}

export function isCloudflareEmail(url: string): boolean {
  return /\/cdn-cgi\/l\/email-protection/i.test(url);
}

/** Explanation and replacement for one broken link target, from its URL text and status alone. */
/** The link with stray quote or backslash characters removed, e.g. `/services/x%5C%5C%22` or `/x'`. */
export function strayCharsHref(url: string): string | null {
  const cleaned = url.replace(/(?:%5C|%22|%27|\\|"|'|%E2%80%9D|”|’)+$/i, "");
  return cleaned !== url && cleaned.length > 0 ? cleaned : null;
}

function explainBrokenTarget(target: string, st: number | null | undefined, works: (u: string) => boolean = () => false): Pick<BreakdownGroup, "explain" | "suggestion"> {
  if (isCloudflareEmail(target)) {
    return {
      explain:
        "This is not a page on your site. Cloudflare's Email Address Obfuscation rewrites every email address into this link and decodes it with JavaScript for visitors. Crawlers that follow it get a 404. Visitors are not affected, but Google sees a broken link on every page that shows an email address.",
      suggestion: { label: "Fix", value: { text: "Cloudflare dashboard → Scrape Shield → turn off Email Address Obfuscation, or wrap the email in <!--email_off--> … <!--/email_off-->" } },
    };
  }
  const intended = markdownHref(target);
  if (intended) {
    return {
      explain:
        "The link's address contains Markdown text ([label](url)) instead of a plain URL, so the browser treats it as a path on your own site, which does not exist. This usually comes from pasting Markdown into a CMS or translation field.",
      suggestion: { label: "Change the link's href to", value: { text: intended, href: intended, mono: true } },
    };
  }
  const stripped = strayCharsHref(target);
  if (stripped) {
    return {
      explain: `The address ends with stray characters (${decodeSafe(target.slice(stripped.length))}), usually an escaped or doubled quote left in the HTML, e.g. href="…\\"" from a page builder or copied code.${works(stripped) ? " Without them, the address works." : ""}`,
      suggestion: { label: works(stripped) ? "Change the link to" : "Probably meant", value: { text: stripped, href: stripped, mono: true } },
    };
  }
  if (st == null)
    return { explain: "The crawler could not get any response from this address (DNS failure, timeout, refused connection or an invalid URL)." };
  if (st === 404 || st === 410)
    return { explain: "The page does not exist (any more). Either restore it, add a 301 redirect to the closest live page, or change the links below to point at a live page." };
  if (st >= 500) return { explain: "The server failed when this page was requested. Check the server or application logs for this URL." };
  return { explain: `The address answered HTTP ${st}, so visitors and crawlers cannot use it.` };
}

const GENERIC_ANCHORS = new Set(["click here", "here", "read more", "learn more", "more", "this", "link", "go", "details", "continue", "see more", "view more"]);
const genericAnchor = (a: string) => GENERIC_ANCHORS.has(a.replace(/[\W_]+/gu, " ").trim().toLowerCase());

/** Who links to each URL, with the anchor text used. Built once per audit. */
const inlinkCache = new WeakMap<EngineAudit, Map<string, Map<string, string>>>();
function inlinks(a: EngineAudit): Map<string, Map<string, string>> {
  let m = inlinkCache.get(a);
  if (m) return m;
  m = new Map();
  for (const p of htmlPages(a)) {
    for (const l of [...(p.links_internal ?? []), ...(p.links_external ?? [])]) {
      let src = m.get(l.url);
      if (!src) m.set(l.url, (src = new Map()));
      if (!src.has(p.url)) src.set(p.url, (l.anchor ?? "").trim());
    }
  }
  inlinkCache.set(a, m);
  return m;
}

function sourcesOf(a: EngineAudit, target: string): Array<{ url: string; note?: string }> {
  const src = inlinks(a).get(target);
  if (!src) return [];
  return [...src.entries()].sort(([x], [y]) => x.localeCompare(y)).map(([url, anchor]) => ({ url, note: anchor ? `link text “${anchor.slice(0, 80)}”` : "link with no text (image or icon)" }));
}

function chainOf(p: EnginePage): Array<{ url: string; status: number | null }> {
  return ((p.redirect_chain ?? []) as Array<{ url?: string; status?: number | null }>)
    .filter((h) => h && typeof h.url === "string")
    .map((h) => ({ url: h.url as string, status: h.status ?? null }));
}

// ------------------------------------------------------------------ fixed text per rule

const STEPS: Record<string, string[]> = {
  broken_internal_links: [
    "Open each broken address below to confirm it fails.",
    "If the page moved, add a 301 redirect from the old address to the new one.",
    "Otherwise edit the pages listed under each address and point the link at a live page (or remove it).",
    "Re-run the audit to confirm the count drops to zero.",
  ],
  broken_external_links: ["Open each address to confirm it fails.", "Replace the link with the site's current page, link to another source, or remove it."],
  links_to_redirects: [
    "For each redirecting address below, find the final address it lands on.",
    "Edit the listed pages (often a shared menu, footer or template) so the link points straight at the final address.",
    "Keep the redirect itself for old bookmarks and backlinks.",
  ],
  redirect_chains: ["Change the first redirect so it goes straight to the final address in one hop.", "Update internal links to use the final address."],
  http_errors: [
    "Check whether each address should exist.",
    "Restore the page, or 301-redirect it to the closest live page.",
    "Update the pages that link to it (listed under each address).",
  ],
  noindex: [
    "Check each page: should it appear in Google?",
    "If yes, remove “noindex” from the robots meta tag or the X-Robots-Tag header.",
    "If no (thank-you pages, logins, filters), leave it, and remove the page from the sitemap.",
  ],
  sitemap_bad_urls: ["Remove these addresses from the sitemap, or replace each with its final, indexable address.", "Most CMS sitemap plugins do this automatically once redirects and noindex are set correctly."],
  not_in_sitemap: ["Add these pages to the XML sitemap (or check why your sitemap plugin excludes them)."],
  orphan_pages: ["Link to each page from at least one related page, hub or menu.", "If a page is obsolete, remove it from the sitemap instead."],
  canonical_missing: ["Add <link rel=\"canonical\" href=\"…\"> pointing at the page's own address in the <head>."],
  canonical_elsewhere: ["Check each pair: is the page a true duplicate of the canonical target?", "If not, make the canonical point at the page itself."],
  canonical_broken: ["Point the canonical at a live, final (200) address."],
  title_duplicate: ["Give every page in each group its own title that describes that page.", "For paginated lists, add “– Page 2”, “– Page 3” and so on."],
  title_length: ["Keep titles roughly 30–60 characters: the main topic first, the brand last.", "Google cuts long titles in results; very short ones waste the space."],
  title_missing: ["Add a unique <title> that describes each page."],
  meta_missing: ["Write a 120–160 character description for each page: what it offers and why to click."],
  meta_duplicate: ["Write a distinct description for each page in each group."],
  h1_missing: ["Add one visible <h1> heading that states the page's topic."],
  h1_multiple: ["Keep one <h1> per page; turn the others into <h2>."],
  heading_skips: ["Use headings in order (h1 → h2 → h3). Change the skipped level shown below, e.g. an h4 that follows an h2 becomes an h3."],
  lang_missing: ["Add the language to the <html> tag, e.g. <html lang=\"en\">."],
  viewport_missing: ["Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"> to the <head> of these pages' template."],
  thin_content: ["Expand pages that should rank with useful, specific content.", "Merge near-empty pages into a stronger page, or noindex them if they exist only for navigation."],
  duplicate_content: ["Keep one page in each group; 301-redirect or canonicalise the others to it.", "URLs that differ only by a tracking or billing parameter should canonicalise to the clean URL."],
  images_alt: ["Add an alt attribute to each image listed: a short description for informative images, alt=\"\" for decorative ones and tracking pixels."],
  images_dimensions: ["Add width and height attributes (or CSS aspect-ratio) to images so the layout does not jump while loading."],
  schema_required: ["Add the missing properties listed for each page, then test the page in Google's Rich Results Test."],
  jsonld_errors: ["Fix the JSON-LD syntax on these pages and validate with the Rich Results Test."],
  og_missing: ["Add og:title, og:description and og:image to these pages (most SEO plugins have a Social tab)."],
  hreflang_issues: ["Each language version must list itself and every other version in its hreflang tags.", "Add the missing self-reference shown below."],
  slow_ttfb: ["Enable full-page caching or a CDN for these pages.", "Check slow database queries or server-side rendering for the slowest pages first."],
  heavy_html: ["Remove inlined data, huge inline SVGs or scripts, and repeated markup from these pages.", "Load long lists or embeds on demand."],
  security_headers: ["Add the missing headers in your web server, CDN or hosting settings (examples below)."],
  generic_anchors: ["Rewrite each link text so it says where the link goes, e.g. “Read more” → “Read the pricing guide”."],
  deep_pages: ["Link important pages from the menu, a hub page or related pages so they are at most three clicks from the homepage."],
  soft_404: ["Make your server return HTTP 404 (or 410) for addresses that do not exist, while still showing your custom “not found” page."],
  faq_rich_result_limited: ["No change needed for most sites: FAQ markup is harmless, but Google shows FAQ rich results only for well-known government and health websites."],
};

const MEANING: Record<string, string> = Object.fromEntries(CHECKLIST.flatMap((s) => s.items.map((i) => [i.id, i.why])));

// ------------------------------------------------------------------ builders

type Ctx = { a: EngineAudit; f: EngineFinding; pages: Map<string, EnginePage>; home: URL | undefined };

function table(columns: BreakdownTable["columns"], rows: BreakdownTable["rows"], total = rows.length): BreakdownTable {
  return { columns, rows: rows.slice(0, MAX_ROWS), total };
}

function pageRows(ctx: Ctx, extra?: (p: EnginePage | undefined, url: string) => Record<string, Cell | Cell[] | null>, extraCols: BreakdownTable["columns"] = []) {
  const rows = ctx.f.urls.map((u) => {
    const p = ctx.pages.get(u);
    return { page: urlCell(u, ctx.pages), title: p?.title ? { text: p.title } : { text: "—", tone: "muted" as Tone }, ...(extra?.(p, u) ?? {}) };
  });
  return table([{ key: "page", label: "Page" }, { key: "title", label: "Title" }, ...extraCols], rows, ctx.f.urls.length);
}

function works(ctx: Ctx) {
  const status = ctx.a.site.link_status ?? {};
  return (u: string) => {
    const p = ctx.pages.get(u);
    const st = p ? p.status : status[u];
    return st === 200 || (p?.kind === "redirect" && (ctx.pages.get(p.final_url ?? "")?.status ?? 0) === 200);
  };
}

function brokenGroups(ctx: Ctx, external: boolean): BreakdownGroup[] {
  const status = (external ? ctx.a.site.external_status : ctx.a.site.link_status) ?? {};
  const targets = external
    ? ctx.f.urls
    : Object.keys((ctx.f.detail?.targets as Record<string, string[]>) ?? {}).length
      ? Object.keys(ctx.f.detail?.targets as Record<string, string[]>)
      : Object.entries(status).filter(([, st]) => st == null || st >= 400).map(([u]) => u);
  // Recompute every target from the crawl so no source page is cut off.
  const all = new Set(targets);
  if (!external) for (const [u, st] of Object.entries(status)) if ((st == null || st >= 400) && inlinks(ctx.a).has(u)) all.add(u);
  return [...all]
    .map((t) => {
      const items = sourcesOf(ctx.a, t);
      const st = status[t];
      const label = statusLabel(st);
      return {
        key: t,
        title: { text: t, href: isHttp(t) && !markdownHref(t) ? t : undefined, mono: true },
        badge: label,
        ...explainBrokenTarget(t, st, works(ctx)),
        itemsLabel: items.length === 1 ? "Linked from 1 page" : `Linked from ${n(items.length)} pages`,
        items: items.slice(0, MAX_ITEMS),
        total: items.length,
      };
    })
    .sort((x, y) => y.total - x.total);
}

function build(ctx: Ctx): Omit<Breakdown, "meaning" | "steps" | "verdict"> & { steps?: string[]; verdict?: Verdict } {
  const { a, f, pages, home } = ctx;
  const notes: BreakdownNote[] = [];
  const count = f.urls.length;

  switch (f.id) {
    case "broken_internal_links": {
      const groups = brokenGroups(ctx, false);
      const cf = groups.filter((g) => isCloudflareEmail(g.key));
      const md = groups.filter((g) => markdownHref(g.key));
      if (cf.length)
        notes.push({
          tone: "info",
          title: `Cloudflare email protection causes this on ${plural(cf.reduce((s, g) => s + g.total, 0), "page")}`,
          text: "That link is generated by Cloudflare, not written by you. Turning off Email Address Obfuscation (or excluding the email from it) clears most of this finding at once.",
        });
      if (md.length)
        notes.push({
          tone: "warn",
          title: `${say(md.length, "link", "contain Markdown instead of a URL")}`,
          text: "These were probably pasted into a CMS or translation field as [text](url). The correct address is shown under each one.",
        });
      return {
        headline: `${plural(groups.length, "broken address", "broken addresses")} ${groups.length === 1 ? "is" : "are"} linked from ${plural(count, "page")} of your site. Fix each address once and every page that links to it is fixed.`,
        notes,
        groups,
        table: null,
      };
    }
    case "broken_external_links": {
      const groups = brokenGroups(ctx, true);
      return { headline: `${plural(groups.length, "outbound link")} to other websites no longer work.`, notes, groups, table: null };
    }
    case "links_to_redirects": {
      const by = new Map<string, Set<string>>();
      for (const src of f.urls) {
        const p = pages.get(src);
        for (const l of p?.links_internal ?? []) {
          const t = pages.get(l.url);
          if (t?.kind === "redirect") (by.get(l.url) ?? by.set(l.url, new Set()).get(l.url)!).add(src);
        }
      }
      const groups: BreakdownGroup[] = [...by.entries()]
        .map(([t, srcs]) => {
          const tp = pages.get(t);
          const final = tp?.final_url ?? null;
          const chain = tp ? chainOf(tp) : [];
          const items = sourcesOf(a, t).filter((s) => srcs.has(s.url));
          return {
            key: t,
            title: { text: t, href: t, mono: true },
            badge: statusLabel(chain[0]?.status ?? tp?.status ?? 301),
            explain: chain.length > 1 ? `Redirects ${chain.length} times before reaching the final page.` : undefined,
            suggestion: final ? { label: "Link straight to", value: { text: final, href: final, page: pages.has(final), mono: true } } : undefined,
            itemsLabel: items.length === 1 ? "Linked from 1 page" : `Linked from ${n(items.length)} pages`,
            items: items.slice(0, MAX_ITEMS),
            total: items.length,
          };
        })
        .sort((x, y) => y.total - x.total);
      if (groups.length && groups[0].total > count * 0.5)
        notes.push({ tone: "info", title: "Most of this comes from a shared menu or footer", text: `The top address is linked from ${plural(groups[0].total, "page")}, which almost always means one template. Fixing that one link fixes them all.` });
      return { headline: `${plural(groups.length, "internal link target")} redirect${groups.length === 1 ? "s" : ""} somewhere else. ${plural(count, "page")} link to them instead of the final address.`, notes, groups, table: null };
    }
    case "redirect_chains": {
      const rows = f.urls.map((u) => {
        const p = pages.get(u);
        const chain = p ? chainOf(p) : [];
        const hops: Cell[] = chain.map((h) => ({ text: `${h.status ?? "?"} ${pathOf(h.url, home)}`, href: h.url, mono: true, tone: "warn" as Tone }));
        const final = p?.final_url ?? null;
        if (final) {
          const fst = pages.get(final)?.status ?? a.site.link_status?.[final] ?? null;
          hops.push({ text: `${fst ?? "?"} ${pathOf(final, home)} (final)`, href: final, mono: true, tone: fst === 200 ? "good" : "bad" });
        }
        return { page: urlCell(u, pages), hops: { text: String(chain.length) }, chain: hops };
      });
      return {
        headline: `${say(count, "address", "redirect more than once before reaching the final page.", "addresses")}`,
        notes,
        groups: null,
        table: table([{ key: "page", label: "Starting address" }, { key: "hops", label: "Hops", align: "right" }, { key: "chain", label: "Path taken (last step is where links should point)" }], rows),
      };
    }
    case "http_errors": {
      const groups: BreakdownGroup[] = f.urls.map((u) => {
        const p = pages.get(u);
        const items = sourcesOf(a, u);
        return {
          key: u,
          title: { text: u, href: u, mono: true },
          badge: p?.status ? statusLabel(p.status) : { text: p?.error ? `Error: ${p.error}` : "Unreachable", tone: "bad" },
          ...explainBrokenTarget(u, p?.status ?? null, works(ctx)),
          itemsLabel: items.length ? `Linked from ${plural(items.length, "page")}` : p?.in_sitemap ? "Listed in your sitemap; no crawled page links to it. Remove it from the sitemap or restore the page." : "No crawled page links to it (reached through a redirect or the sitemap)",
          items: items.slice(0, MAX_ITEMS),
          total: items.length,
        };
      });
      return { headline: `${say(count, "address", "on your site return an error instead of a page.", "addresses").replace("address on your site return ", "address on your site returns ")}`, notes, groups, table: null };
    }
    case "sitemap_bad_urls": {
      const rows = f.urls.map((u) => {
        const p = pages.get(u);
        let problem: Cell = { text: "Not a final indexable page", tone: "warn" };
        if (p?.kind === "redirect") problem = { text: `Redirects to ${p.final_url ?? "another address"}`, href: p.final_url ?? undefined, tone: "warn" };
        else if ((p?.status ?? 0) >= 400) problem = { text: statusLabel(p?.status).text, tone: "bad" };
        else if (p && `${p.meta_robots ?? ""} ${p.x_robots ?? ""}`.toLowerCase().includes("noindex")) problem = { text: "Marked noindex", tone: "warn" };
        else if (p?.canonical && p.canonical !== p.url) problem = { text: `Canonical points to ${p.canonical}`, href: p.canonical, tone: "warn" };
        return { page: urlCell(u, pages), problem };
      });
      return { headline: `Your sitemap lists ${plural(count, "address", "addresses")} that Google should not index as they are.`, notes, groups: null, table: table([{ key: "page", label: "Address in the sitemap" }, { key: "problem", label: "Why it should not be there" }], rows) };
    }
    case "noindex": {
      const why = new Map(f.urls.map((u) => [u, intendedNoindexReason(u)]));
      const t = pageRows(ctx, (p, u) => {
        const where: Cell[] = [];
        if ((p?.meta_robots ?? "").toLowerCase().includes("noindex")) where.push({ text: `meta robots: ${p?.meta_robots}`, mono: true });
        if ((p?.x_robots ?? "").toLowerCase().includes("noindex")) where.push({ text: `X-Robots-Tag: ${p?.x_robots}`, mono: true });
        const r = why.get(u);
        return { kind: r ? { text: `${r}: usually intended`, tone: "good" as Tone } : { text: "Content page: check this one", tone: "bad" as Tone }, where };
      }, [{ key: "kind", label: "Looks like" }, { key: "where", label: "Where the noindex is" }]);
      t.rows.sort((x, y) => Number((x.kind as Cell).tone === "good") - Number((y.kind as Cell).tone === "good"));
      const intended = f.urls.filter((u) => why.get(u)).length;
      const check = count - intended;
      const home = f.urls.some((u) => { try { return new URL(u).pathname === "/"; } catch { return false; } });
      const verdict: Verdict = home
        ? { tone: "bad", title: "Fix immediately", text: "Your homepage is marked noindex, so Google will drop it from search." }
        : check === 0
          ? { tone: "good", title: "Probably intended: no action needed", text: `All ${plural(count, "page")} are ${[...new Set([...why.values()].filter(Boolean))].join(", ").toLowerCase()}. SEO plugins (Yoast, Rank Math) noindex these on purpose, so they do not compete with your real pages. Only change this if you want these pages in Google.` }
          : { tone: "bad", title: `Check ${plural(check, "page")}`, text: `${plural(check, "content page")} ${check === 1 ? "is" : "are"} hidden from Google. If ${check === 1 ? "it" : "they"} should rank, remove the noindex.${intended ? ` The other ${n(intended)} look intentional (pagination, archives, legal or account pages).` : ""}` };
      const lead = count === 1 ? "1 page tells Google not to index it." : `${n(count)} pages tell Google not to index them.`;
      const tail = check === 0 ? (count === 1 ? " It looks intentional." : " All of them look intentional.") : count === 1 ? " It looks like a real content page." : ` ${n(check)} of them look like real content pages.`;
      return { headline: lead + tail, notes, groups: null, table: t, verdict };
    }
    case "canonical_elsewhere":
    case "canonical_broken": {
      const status = a.site.link_status ?? {};
      const rows = f.urls.map((u) => {
        const p = pages.get(u);
        const c = p?.canonical ?? null;
        const cp = c ? pages.get(c) : undefined;
        const st = cp?.status ?? (c ? status[c] : null);
        return { page: urlCell(u, pages), canonical: c ? { text: c, href: c, page: pages.has(c), mono: true } : null, status: c ? statusLabel(cp?.kind === "redirect" ? (chainOf(cp)[0]?.status ?? 301) : st) : null };
      });
      const params = f.urls.filter((u) => u.includes("?")).length;
      if (params) notes.push({ tone: "good", title: `${say(params, "address", "are parameter versions", "addresses")}`, text: "Pages with ?utm_, ?billing= and similar parameters that point their canonical at the clean URL are set up correctly. Only act on the others." });
      return { headline: f.id === "canonical_broken" ? `${say(count, "page", "point their canonical at an address that redirects or fails.")}` : `${say(count, "page", "tell Google that another address is the main version.")}`, notes, groups: null, table: table([{ key: "page", label: "Page" }, { key: "canonical", label: "Canonical points to" }, { key: "status", label: "That address returns" }], rows) };
    }
    case "title_duplicate":
    case "meta_duplicate": {
      const field = f.id === "title_duplicate" ? "title" : "meta_description";
      const by = new Map<string, { label: string; urls: string[] }>();
      for (const p of htmlPages(a)) {
        const v = (p[field] as string | null | undefined)?.trim();
        if (!v) continue;
        const k = v.toLowerCase();
        const g = by.get(k) ?? by.set(k, { label: v, urls: [] }).get(k)!;
        g.urls.push(p.url);
      }
      const groups: BreakdownGroup[] = [...by.values()]
        .filter((g) => g.urls.length > 1)
        .sort((x, y) => y.urls.length - x.urls.length)
        .map((g) => ({ key: g.label, title: { text: `“${g.label}”` }, badge: { text: `${g.urls.length} pages`, tone: "warn" }, itemsLabel: "Pages sharing it", items: g.urls.slice(0, MAX_ITEMS).map((url) => ({ url })), total: g.urls.length }));
      const paged = f.urls.filter((u) => /\/page\/\d+|[?&]page=\d+/i.test(u)).length;
      if (paged) notes.push({ tone: "info", title: `${say(paged, "page", "are pagination")}`, text: "Paginated lists (/page/2, ?page=3) often repeat the first page's text. Add the page number to each one, e.g. “Blog – Page 2”." });
      const what = f.id === "title_duplicate" ? "title" : "meta description";
      return { headline: `${plural(groups.length, what)} ${groups.length === 1 ? "is" : "are"} used on more than one page (${plural(count, "page")} in total), so Google cannot tell those pages apart.`, notes, groups, table: null };
    }
    case "title_length": {
      const rows = f.urls.map((u) => {
        const p = pages.get(u);
        const len = p?.title?.length ?? 0;
        return { page: urlCell(u, pages), title: { text: p?.title ?? "—" }, length: { text: String(len), tone: (len > 65 ? "warn" : "info") as Tone }, problem: { text: len > 65 ? "Too long: likely cut off in results" : "Too short: says little about the page" } };
      }).sort((x, y) => Number(y.length.text) - Number(x.length.text));
      return { headline: `${say(count, "title", "fall outside the 15–65 character range.")}`, notes, groups: null, table: table([{ key: "page", label: "Page" }, { key: "title", label: "Title" }, { key: "length", label: "Chars", align: "right" }, { key: "problem", label: "Problem" }], rows) };
    }
    case "heading_skips": {
      const t = pageRows(ctx, (p) => {
        const out = p?.outline ?? [];
        let prev = 0;
        for (const line of out) {
          const m = /^h(\d)\s*:\s*(.*)$/i.exec(line);
          if (!m) continue;
          const lvl = Number(m[1]);
          if (prev && lvl > prev + 1) return { skip: { text: `h${prev} → h${lvl}: “${m[2].slice(0, 70)}”`, tone: "warn" as Tone } };
          prev = lvl;
        }
        return { skip: { text: `${p?.heading_skips ?? "?"} skip(s)`, tone: "muted" as Tone } };
      }, [{ key: "skip", label: "First skipped level" }]);
      return { headline: `${say(count, "page", "jump over a heading level (for example from h2 straight to h4).")}`, notes, groups: null, table: t };
    }
    case "thin_content": {
      const wc = (f.detail?.word_counts as Record<string, number>) ?? {};
      const rows = f.urls.map((u) => ({ page: urlCell(u, pages), title: { text: pages.get(u)?.title ?? "—" }, words: { text: n(wc[u] ?? pages.get(u)?.word_count ?? 0), tone: "warn" as Tone } })).sort((x, y) => Number(x.words.text.replace(/,/g, "")) - Number(y.words.text.replace(/,/g, "")));
      return { headline: `${say(count, "indexable page", "have under 150 words of main content.")}`, notes, groups: null, table: table([{ key: "page", label: "Page" }, { key: "title", label: "Title" }, { key: "words", label: "Words", align: "right" }], rows) };
    }
    case "duplicate_content": {
      const groups = ((f.detail?.groups as string[][]) ?? []).map((urls, i) => ({ key: String(i), title: { text: `Group ${i + 1}: identical main text` }, badge: { text: `${urls.length} pages`, tone: "warn" as Tone }, suggestion: { label: "Keep", value: { text: [...urls].sort((x, y) => x.length - y.length)[0], href: [...urls].sort((x, y) => x.length - y.length)[0], mono: true } }, itemsLabel: "Pages", items: urls.map((url) => ({ url })), total: urls.length }));
      return { headline: `${plural(groups.length, "group")} of pages ${groups.length === 1 ? "has" : "have"} exactly the same main text.`, notes, groups, table: null };
    }
    case "images_alt": {
      const rows = f.urls.map((u) => {
        const p = pages.get(u);
        const samples = (p?.images?.missing_alt_samples ?? []).slice(0, 4);
        return { page: urlCell(u, pages), missing: { text: n(p?.images?.missing_alt ?? 0), tone: "warn" as Tone }, examples: samples.map((s) => (isHttp(s) ? { text: pathOf(s, home), href: s, mono: true } : { text: s.startsWith("data:") || s.startsWith("image/") ? "inline image (data: URI)" : s.slice(0, 80), tone: "muted" as Tone })) };
      }).sort((x, y) => Number(y.missing.text.replace(/,/g, "")) - Number(x.missing.text.replace(/,/g, "")));
      const pixel = f.urls.filter((u) => (pages.get(u)?.images?.missing_alt_samples ?? []).some((s) => /facebook\.com\/tr|\/pixel|doubleclick|bat\.bing/i.test(s))).length;
      if (pixel) notes.push({ tone: "info", title: `${say(pixel, "page", "include a tracking pixel", )}`, text: "Tracking pixels (Facebook, Bing, Google Ads) are invisible 1×1 images, usually inside <noscript>. Add alt=\"\" to the pixel's <img> tag in your tag manager or theme; that single template change fixes them on every page." });
      return { headline: `${n(rows.reduce((s, r) => s + Number(r.missing.text.replace(/,/g, "")), 0))} images on ${plural(count, "page")} have no alt attribute.`, notes, groups: null, table: table([{ key: "page", label: "Page" }, { key: "missing", label: "Images", align: "right" }, { key: "examples", label: "Examples" }], rows) };
    }
    case "images_dimensions": {
      const rows = f.urls.map((u) => ({ page: urlCell(u, pages), count: { text: n(pages.get(u)?.images?.no_dimensions ?? 0) } }));
      return { headline: `Images on ${plural(count, "page")} have no width and height, which makes the layout shift while loading.`, notes, groups: null, table: table([{ key: "page", label: "Page" }, { key: "count", label: "Images", align: "right" }], rows) };
    }
    case "schema_required": {
      const rows: BreakdownTable["rows"] = [];
      for (const u of f.urls) {
        const p = pages.get(u);
        for (const node of (p?.schema_nodes ?? []) as Array<{ types: string[]; keys: string[]; offers_price?: boolean; list_items_ok?: boolean }>) {
          const keys = new Set(node.keys);
          const ts = new Set(node.types);
          const miss: string[] = [];
          let type = "";
          if (ts.has("Product")) { type = "Product"; if (!keys.has("name")) miss.push("name"); if (!["offers", "review", "aggregateRating"].some((k) => keys.has(k))) miss.push("offers, review or aggregateRating"); }
          if (ts.has("SoftwareApplication")) { type = "SoftwareApplication"; if (!keys.has("name")) miss.push("name"); if (!node.offers_price) miss.push("offers.price"); if (!keys.has("review") && !keys.has("aggregateRating")) miss.push("aggregateRating or review"); }
          if (ts.has("BreadcrumbList") && node.list_items_ok === false) { type = "BreadcrumbList"; miss.push("position or name on some items"); }
          if (ts.has("LocalBusiness")) { type = "LocalBusiness"; for (const k of ["name", "address"]) if (!keys.has(k)) miss.push(k); }
          if (type && miss.length) rows.push({ page: urlCell(u, pages), type: { text: type, mono: true }, missing: miss.map((m) => ({ text: m, mono: true, tone: "warn" as Tone })) });
        }
      }
      return { headline: `Structured data on ${plural(count, "page")} is missing properties Google requires for a rich result.`, notes, groups: null, table: table([{ key: "page", label: "Page" }, { key: "type", label: "Schema type" }, { key: "missing", label: "Missing" }], rows) };
    }
    case "og_missing": {
      const t = pageRows(ctx, (p) => ({ missing: (["title", "image"] as const).filter((k) => !(p?.og ?? {})[k]).map((k) => ({ text: `og:${k}`, mono: true, tone: "warn" as Tone })) }), [{ key: "missing", label: "Missing" }]);
      return { headline: `${say(count, "page", "have no Open Graph title or image, so shared links look bare on social media and chat apps.")}`, notes, groups: null, table: t };
    }
    case "hreflang_issues": {
      const t = pageRows(ctx, (p) => ({ langs: { text: ((p?.hreflang ?? []) as Array<{ lang?: string }>).map((h) => h.lang).filter(Boolean).join(", ") || "—" }, missing: { text: `<link rel="alternate" hreflang="${p?.lang ?? "xx"}" href="${p?.url ?? ""}">`, mono: true, tone: "warn" } }), [{ key: "langs", label: "Languages declared" }, { key: "missing", label: "Add this self-reference" }]);
      return { headline: `${say(count, "page", "list other language versions but not themselves.")}`, notes, groups: null, table: t };
    }
    case "slow_ttfb": {
      const rows = f.urls.map((u) => ({ page: urlCell(u, pages), ttfb: { text: `${n(pages.get(u)?.ttfb_ms ?? 0)} ms`, tone: ((pages.get(u)?.ttfb_ms ?? 0) > 1800 ? "bad" : "warn") as Tone } })).sort((x, y) => Number(y.ttfb.text.replace(/\D/g, "")) - Number(x.ttfb.text.replace(/\D/g, "")));
      return { headline: `${plural(count, "page")} took over 800 ms for the server to start responding (Google recommends under 800 ms).`, notes, groups: null, table: table([{ key: "page", label: "Page" }, { key: "ttfb", label: "Server response", align: "right" }], rows) };
    }
    case "heavy_html": {
      const rows = f.urls.map((u) => ({ page: urlCell(u, pages), size: { text: `${n(Math.round((pages.get(u)?.bytes ?? 0) / 1024))} KB`, tone: "warn" as Tone } })).sort((x, y) => Number(y.size.text.replace(/\D/g, "")) - Number(x.size.text.replace(/\D/g, "")));
      return { headline: `${say(count, "page", "have more than 500 KB of HTML.")}`, notes, groups: null, table: table([{ key: "page", label: "Page" }, { key: "size", label: "HTML size", align: "right" }], rows) };
    }
    case "deep_pages": {
      const t = pageRows(ctx, (p) => ({ depth: { text: `${p?.depth ?? "?"} clicks` } }), [{ key: "depth", label: "From homepage", align: "right" }]);
      return { headline: `${say(count, "page", "are more than three clicks from the homepage.")}`, notes, groups: null, table: t };
    }
    case "orphan_pages":
      return { headline: `${say(count, "page", "are in your sitemap, but no crawled page links to them. Visitors cannot find them by browsing.")}`, notes, groups: null, table: pageRows(ctx) };
    case "generic_anchors": {
      const rows: BreakdownTable["rows"] = [];
      for (const u of f.urls)
        for (const l of pages.get(u)?.links_internal ?? [])
          if (genericAnchor(l.anchor ?? "")) rows.push({ page: urlCell(u, pages), anchor: { text: `“${l.anchor.trim()}”`, tone: "warn" }, target: { text: l.url, href: l.url, page: pages.has(l.url), mono: true } });
      return { headline: `${plural(rows.length, "link")} on ${plural(count, "page")} use vague text like “Learn more” that does not say where they go.`, notes, groups: null, table: table([{ key: "page", label: "On page" }, { key: "anchor", label: "Link text" }, { key: "target", label: "Goes to" }], rows) };
    }
    case "security_headers": {
      const list = (/:\s*(.*)$/.exec(f.evidence)?.[1] ?? "").split(/,\s*/).filter(Boolean);
      const INFO: Record<string, [string, string]> = {
        "x-content-type-options": ["Stops browsers guessing file types", "X-Content-Type-Options: nosniff"],
        "referrer-policy": ["Controls what address is shared when visitors click away", "Referrer-Policy: strict-origin-when-cross-origin"],
        "x-frame-options or CSP frame-ancestors": ["Stops other sites framing your pages (clickjacking)", "X-Frame-Options: SAMEORIGIN"],
      };
      const rows = list.map((h) => ({ header: { text: h, mono: true }, does: { text: INFO[h]?.[0] ?? "" }, add: { text: INFO[h]?.[1] ?? h, mono: true, tone: "info" as Tone } }));
      return { headline: `Your homepage response is missing ${plural(list.length, "security header")}.`, notes, groups: null, table: table([{ key: "header", label: "Header" }, { key: "does", label: "What it does" }, { key: "add", label: "Add this" }], rows) };
    }
    case "soft_404":
      return { headline: "We requested an address that does not exist on your site, and the server answered “200 OK” instead of “404 Not found”.", notes: [{ tone: "info", title: "How this was tested", text: `The crawler requested a random made-up path on ${home?.host ?? "your site"}. A correct server answers 404 so Google drops dead pages instead of indexing empty ones.` }], groups: null, table: null };
    case "faq_rich_result_limited":
      return { headline: `${say(count, "page", "have FAQPage markup. This is informational only.")}`, notes, groups: null, table: pageRows(ctx) };
    default: {
      const missingText: Record<string, string> = {
        meta_missing: "have no meta description",
        h1_missing: "have no H1 heading",
        lang_missing: "do not declare a language on the <html> tag",
        viewport_missing: "have no mobile viewport tag, so phones show them zoomed out",
        canonical_missing: "have no canonical link",
        not_in_sitemap: "are indexable but not in your sitemap",
        title_missing: "have no title",
        h1_multiple: "have more than one H1",
        multiple_titles: "have more than one <title> tag",
        js_dependent: "need JavaScript to show their content",
        mixed_content: "load http:// files on an https:// page",
      };
      const extraCols: BreakdownTable["columns"] = f.id === "h1_multiple" ? [{ key: "h1", label: "H1s" }] : f.id === "mixed_content" ? [{ key: "mixed", label: "Insecure files" }] : [];
      const t = pageRows(ctx, (p): Record<string, Cell[]> => (f.id === "h1_multiple" ? { h1: (p?.h1 ?? []).map((h) => ({ text: h })) } : f.id === "mixed_content" ? { mixed: ((p?.mixed_content ?? []) as string[]).slice(0, 4).map((m) => ({ text: m, href: m, mono: true })) } : {}), extraCols);
      const headline = missingText[f.id] ? `${say(count, "page", missingText[f.id])}.` : f.evidence || `${plural(count, "address", "addresses")} affected.`;
      return { headline, notes, groups: null, table: count ? t : null };
    }
  }
}

/** Verdict from the data where it is clear, else from the engine's severity. */
function autoVerdict(f: EngineFinding, b: Omit<Breakdown, "meaning" | "steps" | "verdict">): Verdict {
  if (f.id === "faq_rich_result_limited") return { tone: "good", title: "No action needed", text: "FAQ markup does no harm. Google simply no longer shows it as a rich result for most sites." };
  if (f.id === "canonical_elsewhere" && f.urls.every((u) => u.includes("?"))) return { tone: "good", title: "Set up correctly: no action needed", text: "Every page here is a parameter version (tracking or filter) that points Google at the clean address, which is what Google recommends." };
  if (f.id === "broken_internal_links" && b.groups?.length && b.groups.every((g) => isCloudflareEmail(g.key) || markdownHref(g.key))) {
    const cf = b.groups.some((g) => isCloudflareEmail(g.key));
    return { tone: "warn", title: "Easy fix", text: cf ? "Mostly Cloudflare's email protection plus a few mistyped links. One Cloudflare setting and a few link edits clear it." : "A few links were pasted with Markdown. Edit those links (shown below) to clear it." };
  }
  if (f.heuristic) {
    const v = SEVERITY_VERDICT[f.severity] ?? SEVERITY_VERDICT.medium;
    return { ...v, text: `${v.text} This check is a heuristic, so confirm each case before changing anything.` };
  }
  return SEVERITY_VERDICT[f.severity] ?? SEVERITY_VERDICT.medium;
}

export function findingBreakdown(a: EngineAudit, f: EngineFinding): Breakdown {
  const pages = new Map(a.pages.map((p) => [p.url, p]));
  let home: URL | undefined;
  try {
    home = new URL(a.site.final_url);
  } catch {
    home = undefined;
  }
  const b = build({ a, f, pages, home });
  return {
    verdict: b.verdict ?? autoVerdict(f, b),
    headline: b.headline,
    meaning: MEANING[f.id] ?? null,
    steps: b.steps ?? STEPS[f.id] ?? (f.fix ? [f.fix] : []),
    notes: b.notes,
    groups: b.groups,
    table: b.table,
  };
}

