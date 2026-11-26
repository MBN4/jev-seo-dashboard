/**
 * Fix kit: for each finding, the exact changes to make and ready-to-paste code.
 *
 * Built only from the crawl data. Where a value has to be guessed (the page a broken link was
 * probably meant to reach, a draft meta description) it is labelled as a suggestion to check.
 * Code is offered in the forms a custom-coded site most likely uses: HTML, Next.js, Express,
 * nginx and Apache.
 */
import type { EngineAudit, EngineFinding, EnginePage } from "@/types/engine";

export interface FixChange {
  /** Page where the change is made (null = site-wide, e.g. server config) */
  page: string | null;
  /** Plain instruction */
  text: string;
  find?: string;
  replace?: string;
}

export interface FixCode {
  title: string;
  note?: string;
  variants: Array<{ label: string; lang: string; code: string }>;
}

export interface FixKit {
  /** One line: what to do */
  summary: string;
  changes: FixChange[];
  code: FixCode[];
  /** Markdown task for a developer or a task tool */
  devTask: string;
}

const CAP = 40;
const DAY_TASK_CHECK = "The next daily AuditPilot audit shows this check as passed.";

function decode(s: string): string {
  try {
    return decodeURI(s);
  } catch {
    return s;
  }
}
const words = (s: string) => decode(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter((w) => w.length > 1);
const pathOf = (u: string) => {
  try {
    const x = new URL(u);
    return decode(x.pathname + x.search);
  } catch {
    return u;
  }
};
const okPages = (a: EngineAudit) => a.pages.filter((p) => p.status === 200 && p.kind === "page");
const stripBrand = (t: string) => t.replace(/\s*[|–—-]\s*[^|–—-]{2,40}$/, "").trim();

/** The live page a broken address was most likely meant to reach, from page titles and URL words. */
export function closestPage(a: EngineAudit, broken: string): { url: string; why: string } | null {
  const target = decode(broken.split("/").filter(Boolean).at(-1) ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (!target) return null;
  for (const p of okPages(a)) {
    const t = stripBrand(p.title ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (t && t === target) return { url: p.final_url ?? p.url, why: "its title matches the broken address exactly" };
  }
  const tw = new Set(words(target));
  let best: { url: string; score: number } | null = null;
  for (const p of okPages(a)) {
    const pw = new Set(words(pathOf(p.url)));
    if (!pw.size) continue;
    const inter = [...tw].filter((w) => pw.has(w)).length;
    const score = inter / new Set([...tw, ...pw]).size;
    if (!best || score > best.score) best = { url: p.final_url ?? p.url, score };
  }
  return best && best.score >= 0.5 ? { url: best.url, why: "its address shares most words with the broken one" } : null;
}

/** Escape a literal path for Next.js redirects (":", "(", ")", "*", "+", "?" have meaning there). */
const nextPath = (p: string) => p.replace(/([:()*+?])/g, "\\$1");
const q = (s: string) => JSON.stringify(s);

export function redirectCode(pairs: Array<{ from: string; to: string }>, title = "Redirect rules (pick the one your site uses)"): FixCode | null {
  if (!pairs.length) return null;
  const list = pairs.slice(0, CAP).map((x) => ({ from: pathOf(x.from), to: x.to }));
  return {
    title,
    note: "A 301 sends visitors and Google from the old address to the right page.",
    variants: [
      { label: "Next.js (next.config.js)", lang: "js", code: `async redirects() {\n  return [\n${list.map((x) => `    { source: ${q(nextPath(x.from.split("?")[0]))}, destination: ${q(x.to)}, permanent: true },`).join("\n")}\n  ];\n},` },
      { label: "Express", lang: "js", code: list.map((x) => `app.get(${q(x.from.split("?")[0])}, (req, res) => res.redirect(301, ${q(x.to)}));`).join("\n") },
      { label: "nginx", lang: "nginx", code: list.map((x) => `location = ${q(x.from.split("?")[0])} { return 301 ${x.to}; }`).join("\n") },
      { label: "Apache (.htaccess)", lang: "apache", code: list.map((x) => `Redirect 301 ${q(x.from.split("?")[0])} ${x.to}`).join("\n") },
    ],
  };
}

function headTag(html: string, title: string, note?: string): FixCode {
  return { title, note, variants: [{ label: "HTML <head>", lang: "html", code: html }] };
}

function commonPrefix(urls: string[]): string | null {
  const paths = urls.map((u) => pathOf(u).split("/").filter(Boolean));
  if (!paths.length) return null;
  const first = paths[0];
  let i = 0;
  while (i < first.length && paths.every((p) => p[i] === first[i])) i++;
  return i ? `/${first.slice(0, i).join("/")}/` : null;
}

/** A readable sentence: 10+ words, not a run of menu labels (mostly Capitalised Words). */
function proseSentence(text: string): string | null {
  for (const sen of text.split(/(?<=[.!?])\s+/)) {
    const w = sen.split(/\s+/).filter(Boolean);
    if (w.length < 10) continue;
    const caps = w.filter((x) => /^[A-Z&]/.test(x)).length / w.length;
    if (caps < 0.4) return sen;
  }
  return null;
}

function draftDescription(p: EnginePage | undefined): string | null {
  // Only draft from text that clearly follows the page's H1; menus and footers make bad drafts.
  const text = (p?.text_excerpt ?? "").replace(/\s+/g, " ").trim();
  const h1 = (p?.h1 ?? [])[0]?.trim();
  const at = h1 ? text.indexOf(h1) : -1;
  if (at < 0) return null;
  const after = text.slice(at + h1!.length).trim();
  const first = proseSentence(after);
  if (!first || after.indexOf(first) > 200) return null;
  let d = after.slice(after.indexOf(first), after.indexOf(first) + 158);
  const cut = d.lastIndexOf(". ");
  d = cut > 80 ? d.slice(0, cut + 1) : d.replace(/\s+\S*$/, "") + "…";
  return d;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

interface Ctx {
  a: EngineAudit;
  f: EngineFinding;
  pages: Map<string, EnginePage>;
  /** Broken-link groups from the breakdown: target, suggestion, sources */
  groups: Array<{ key: string; suggestion?: string | null; sources: Array<{ url: string; note?: string }> }>;
}

function kit(ctx: Ctx): Omit<FixKit, "devTask"> | null {
  const { a, f, pages } = ctx;
  const host = (() => {
    try {
      return new URL(a.site.final_url);
    } catch {
      return null;
    }
  })();
  const page = (u: string) => pages.get(u);
  switch (f.id) {
    case "broken_internal_links":
    case "broken_external_links": {
      const changes: FixChange[] = [];
      const redirects: Array<{ from: string; to: string }> = [];
      for (const g of ctx.groups) {
        const anchor = (s: { note?: string }) => s.note?.match(/“(.*)”/)?.[1];
        if (/\/cdn-cgi\/l\/email-protection/.test(g.key)) {
          changes.push({ page: null, text: `Cloudflare → your site → Scrape Shield → turn off "Email Address Obfuscation" (fixes all ${g.sources.length} pages at once). Or wrap the email in <!--email_off--> … <!--/email_off--> in the template.` });
          continue;
        }
        for (const s of g.sources.slice(0, 10)) {
          changes.push({
            page: s.url,
            text: g.suggestion ? `Change the link${anchor(s) ? ` “${anchor(s)}”` : ""} to the correct address.` : `Remove the link${anchor(s) ? ` “${anchor(s)}”` : ""} or point it at a live page.`,
            find: decode(g.key.replace(/^https?:\/\/[^/]+/, "")) || g.key,
            replace: g.suggestion ?? undefined,
          });
        }
        if (g.sources.length > 10) changes.push({ page: null, text: `…and the same change on ${g.sources.length - 10} more page(s) linking to ${pathOf(g.key)} (usually one shared template).` });
        if (g.suggestion && f.id === "broken_internal_links" && !/\/cdn-cgi\//.test(g.key)) redirects.push({ from: g.key, to: g.suggestion });
      }
      const code = [redirectCode(redirects, "Optional safety net: redirect the broken addresses (pick the one your site uses)")].filter(Boolean) as FixCode[];
      return { summary: "Correct the link address on the pages listed (find → replace), then optionally add a redirect for the broken address.", changes, code };
    }
    case "http_errors": {
      const pairs: Array<{ from: string; to: string }> = [];
      const changes: FixChange[] = [];
      for (const g of ctx.groups) {
        const s = g.suggestion;
        if (/\/cdn-cgi\/l\/email-protection/.test(g.key)) {
          changes.push({ page: null, text: `This is Cloudflare's email protection link, not a page. Turn off "Email Address Obfuscation" in Cloudflare (Scrape Shield) and it disappears from all ${g.sources.length} pages.` });
          continue;
        }
        changes.push({ page: g.key, text: s ? `Redirect this address to ${s}, or restore the page.` : "Restore the page, or redirect it to the closest live page.", replace: s ?? undefined });
        if (s) pairs.push({ from: g.key, to: s });
        for (const src of g.sources.slice(0, 5)) changes.push({ page: src.url, text: `Update the link to ${pathOf(g.key)}${s ? ` → ${s}` : ""}.`, find: pathOf(g.key), replace: s ?? undefined });
      }
      return { summary: "Restore each missing page or 301-redirect it to the right page, and fix the links that point to it.", changes, code: [redirectCode(pairs)].filter(Boolean) as FixCode[] };
    }
    case "links_to_redirects": {
      const pairs = new Map<string, string>();
      for (const u of f.urls) for (const l of page(u)?.links_internal ?? []) {
        const t = page(l.url);
        if (t?.kind === "redirect" && t.final_url) pairs.set(l.url, t.final_url);
      }
      const changes = [...pairs].slice(0, CAP).map(([from, to]) => ({ page: null, text: "Replace this link everywhere (usually in the shared menu or footer).", find: from, replace: to }));
      const csv = ["find,replace", ...[...pairs].map(([x, y]) => `${x},${y}`)].join("\n");
      return { summary: `Replace ${pairs.size} old link address${pairs.size === 1 ? "" : "es"} with the final address (search the codebase for each).`, changes, code: [{ title: "Find → replace list (CSV)", variants: [{ label: "CSV", lang: "csv", code: csv }] }] };
    }
    case "redirect_chains": {
      const pairs = f.urls.map((u) => ({ from: u, to: page(u)?.final_url ?? "" })).filter((x) => x.to && x.to !== x.from);
      return { summary: "Point the first redirect straight at the final address (one hop).", changes: pairs.slice(0, CAP).map((x) => ({ page: null, text: "Make this redirect go straight to the final page.", find: x.from, replace: x.to })), code: [redirectCode(pairs, "One-hop redirects (replace the existing chained rules)")].filter(Boolean) as FixCode[] };
    }
    case "viewport_missing": {
      const prefix = commonPrefix(f.urls);
      return {
        summary: `Add the viewport tag to the template used by ${prefix ? `every page under ${prefix}` : "these pages"}.`,
        changes: [{ page: null, text: `Add it once to the shared layout of ${prefix ? `the ${prefix} section` : "these pages"}, inside <head>.` }],
        code: [{ title: "Viewport tag", variants: [{ label: "HTML <head>", lang: "html", code: `<meta name="viewport" content="width=device-width, initial-scale=1">` }, { label: "Next.js (app router)", lang: "ts", code: `export const viewport = { width: "device-width", initialScale: 1 };` }] }],
      };
    }
    case "lang_missing": {
      const counts = new Map<string, number>();
      for (const p of a.pages) if (p.lang) counts.set(p.lang, (counts.get(p.lang) ?? 0) + 1);
      const lang = [...counts].sort((x, y) => y[1] - x[1])[0]?.[0] ?? "en";
      return { summary: `Add lang="${lang}" (or the page's language) to the <html> tag of these pages' template.`, changes: [{ page: null, text: "Change the opening <html> tag in the template.", find: "<html>", replace: `<html lang="${lang}">` }], code: [{ title: "Language attribute", variants: [{ label: "HTML", lang: "html", code: `<html lang="${lang}">` }, { label: "Next.js (app/layout.tsx)", lang: "tsx", code: `<html lang="${lang}">` }] }] };
    }
    case "canonical_missing": {
      const tags = f.urls.slice(0, CAP).map((u) => `<!-- ${pathOf(u)} -->\n<link rel="canonical" href="${esc(page(u)?.final_url ?? u)}">`).join("\n");
      return { summary: "Add a self-referencing canonical tag to each page (best done once in the layout, using the page's own URL).", changes: [], code: [headTag(tags, "Canonical tags", "In a template, output the page's own clean URL instead of hard-coding it.")] };
    }
    case "meta_missing": {
      const changes = f.urls.slice(0, CAP).map((u) => {
        const d = draftDescription(page(u));
        return { page: u, text: d ? "Add a meta description (draft from the page's opening text; edit it to sell the page)." : "Write a meta description: what the page offers and why to click (no reliable text to draft from).", replace: d ?? undefined };
      });
      const code = f.urls.slice(0, CAP).map((u) => { const d = draftDescription(page(u)); return d ? `<!-- ${pathOf(u)} -->\n<meta name="description" content="${esc(d)}">` : null; }).filter(Boolean).join("\n");
      return { summary: "Write a 120–160 character description for each page listed (drafts included below).", changes, code: code ? [headTag(code, "Draft meta descriptions", "Drafts are taken from each page's opening text. Edit them before publishing.")] : [] };
    }
    case "h1_missing": {
      const changes = f.urls.slice(0, CAP).map((u) => ({ page: u, text: "Add one visible H1 that names the page's topic.", replace: page(u)?.title ? `<h1>${esc(stripBrand(page(u)!.title!))}</h1>` : undefined }));
      return { summary: "Add one visible <h1> to each page listed (suggested text from the page title).", changes, code: [] };
    }
    case "title_duplicate": {
      const changes: FixChange[] = [];
      for (const u of f.urls.slice(0, CAP)) {
        const t = page(u)?.title;
        const m = /\/page\/(\d+)|[?&]page=(\d+)/i.exec(u);
        const num = m ? (m[1] ?? m[2]) : null;
        const bar = t ? t.lastIndexOf(" | ") : -1;
        if (t && num) changes.push({ page: u, text: "Add the page number to the title.", find: t, replace: bar > 0 ? `${t.slice(0, bar)} – Page ${num}${t.slice(bar)}` : `${t} – Page ${num}` });
        else if (t) changes.push({ page: u, text: "Give this page its own title that says what is different about it.", find: t });
      }
      return { summary: "Make every title unique: add the page number on paginated pages, and describe the difference on the others.", changes, code: [] };
    }
    case "title_length": {
      const changes = f.urls.slice(0, CAP).map((u) => {
        const t = page(u)?.title ?? "";
        const short = stripBrand(t);
        return { page: u, text: t.length > 65 ? `Shorten to about 60 characters (now ${t.length}).` : `Make it more descriptive (now ${t.length} characters).`, find: t, replace: t.length > 65 && short.length <= 65 && short !== t ? short : undefined };
      });
      return { summary: "Keep titles about 30–60 characters, main topic first.", changes, code: [] };
    }
    case "noindex": {
      return {
        summary: "Remove noindex from the pages that should appear in Google (only those marked 'check this').",
        changes: f.urls.slice(0, CAP).map((u) => ({ page: u, text: "If this page should rank, change its robots meta tag.", find: page(u)?.meta_robots ? `<meta name="robots" content="${page(u)!.meta_robots}">` : "X-Robots-Tag: noindex", replace: `<meta name="robots" content="index, follow">` })),
        code: [headTag(`<meta name="robots" content="index, follow">`, "Robots tag for pages that should rank")],
      };
    }
    case "soft_404":
      return {
        summary: "Make unknown addresses answer with HTTP 404 (keep your custom 'not found' page, just change the status).",
        changes: [{ page: null, text: "Change the catch-all / not-found route to send status 404." }],
        code: [{
          title: "Return a real 404",
          variants: [
            { label: "Next.js (app router)", lang: "tsx", code: `import { notFound } from "next/navigation";\n// in the page, when the content does not exist:\nnotFound(); // renders app/not-found.tsx with status 404` },
            { label: "Next.js (pages router)", lang: "ts", code: `export async function getServerSideProps() {\n  // when the content does not exist:\n  return { notFound: true };\n}` },
            { label: "Express", lang: "js", code: `// last route, after all others:\napp.use((req, res) => res.status(404).sendFile(path.join(__dirname, "404.html")));` },
            { label: "nginx (SPA / static)", lang: "nginx", code: `error_page 404 /404.html;\nlocation / {\n  try_files $uri $uri/ =404;   # not: try_files ... /index.html\n}` },
          ],
        }],
      };
    case "host_variant": {
      const main = host?.host ?? "example.com";
      const other = main.startsWith("www.") ? main.slice(4) : `www.${main}`;
      return {
        summary: `Redirect ${other} to ${main} with a 301 (one host for the whole site).`,
        changes: [{ page: null, text: `Add a host redirect from ${other} to ${main}.` }],
        code: [{
          title: "Host redirect",
          variants: [
            { label: "nginx", lang: "nginx", code: `server {\n  listen 80; listen 443 ssl;\n  server_name ${other};\n  return 301 https://${main}$request_uri;\n}` },
            { label: "Next.js (next.config.js)", lang: "js", code: `async redirects() {\n  return [{ source: "/:path*", has: [{ type: "host", value: "${other}" }], destination: "https://${main}/:path*", permanent: true }];\n},` },
            { label: "Apache (.htaccess)", lang: "apache", code: `RewriteEngine On\nRewriteCond %{HTTP_HOST} ^${other.replace(/\./g, "\\.")}$ [NC]\nRewriteRule ^(.*)$ https://${main}/$1 [R=301,L]` },
            { label: "Cloudflare", lang: "text", code: `Rules → Redirect Rules → Create rule\nWhen: Hostname equals ${other}\nThen: Dynamic redirect to concat("https://${main}", http.request.uri.path), status 301, preserve query string` },
          ],
        }],
      };
    }
    case "security_headers": {
      const missing = (/:\s*(.*)$/.exec(f.evidence)?.[1] ?? "").split(/,\s*/).filter(Boolean);
      const H: Record<string, [string, string]> = { "x-content-type-options": ["X-Content-Type-Options", "nosniff"], "referrer-policy": ["Referrer-Policy", "strict-origin-when-cross-origin"], "x-frame-options or CSP frame-ancestors": ["X-Frame-Options", "SAMEORIGIN"] };
      const hs = missing.map((m) => H[m]).filter(Boolean);
      if (!hs.length) return null;
      return {
        summary: `Add ${hs.map((h) => h[0]).join(", ")} to every response.`,
        changes: [{ page: null, text: "Add the header(s) in the server or framework config." }],
        code: [{ title: "Security headers", variants: [
          { label: "Next.js (next.config.js)", lang: "js", code: `async headers() {\n  return [{ source: "/:path*", headers: [\n${hs.map((h) => `    { key: "${h[0]}", value: "${h[1]}" },`).join("\n")}\n  ] }];\n},` },
          { label: "Express", lang: "js", code: `app.use((req, res, next) => {\n${hs.map((h) => `  res.setHeader("${h[0]}", "${h[1]}");`).join("\n")}\n  next();\n});` },
          { label: "nginx", lang: "nginx", code: hs.map((h) => `add_header ${h[0]} "${h[1]}" always;`).join("\n") },
          { label: "Apache", lang: "apache", code: hs.map((h) => `Header always set ${h[0]} "${h[1]}"`).join("\n") },
        ] }],
      };
    }
    case "og_missing": {
      const code = f.urls.slice(0, 20).map((u) => {
        const p = page(u);
        return `<!-- ${pathOf(u)} -->\n<meta property="og:title" content="${esc(stripBrand(p?.title ?? ""))}">\n<meta property="og:description" content="${esc(p?.meta_description ?? draftDescription(p) ?? "")}">\n<meta property="og:image" content="https://${host?.host ?? ""}/og-image.png"><!-- replace with a real 1200×630 image -->\n<meta property="og:url" content="${esc(p?.final_url ?? u)}">`;
      }).join("\n");
      return { summary: "Add Open Graph tags (title, description, image) to these pages, ideally in the shared layout.", changes: [], code: [headTag(code, "Open Graph tags", "Title and description are filled from each page; set a real share image.")] };
    }
    case "hreflang_issues": {
      const code = f.urls.slice(0, CAP).map((u) => `<!-- ${pathOf(u)} -->\n<link rel="alternate" hreflang="${page(u)?.lang ?? "en"}" href="${esc(page(u)?.final_url ?? u)}">`).join("\n");
      return { summary: "Each language version must also list itself in its hreflang tags.", changes: [], code: [headTag(code, "Missing self-references")] };
    }
    case "images_alt": {
      const pixel = f.urls.some((u) => (page(u)?.images?.missing_alt_samples ?? []).some((s) => /facebook\.com\/tr/.test(s)));
      return {
        summary: pixel ? "Add alt=\"\" to the Facebook tracking pixel (one template change), then describe the real images listed." : "Add a short alt text to each informative image; use alt=\"\" for decorative ones.",
        changes: [],
        code: [{ title: "Alt attributes", variants: [
          ...(pixel ? [{ label: "Tracking pixel", lang: "html", code: `<noscript><img height="1" width="1" style="display:none" alt=""\n  src="https://www.facebook.com/tr?id=YOUR_PIXEL_ID&ev=PageView&noscript=1"/></noscript>` }] : []),
          { label: "Informative image", lang: "html", code: `<img src="…" alt="Short description of what the image shows">` },
          { label: "Decorative image", lang: "html", code: `<img src="…" alt="">` },
        ] }],
      };
    }
    case "images_dimensions":
      return { summary: "Give images a width and height (or a CSS aspect-ratio) so the page does not jump while loading.", changes: [], code: [{ title: "Image size", variants: [{ label: "HTML", lang: "html", code: `<img src="…" width="800" height="450" alt="…">` }, { label: "Next.js", lang: "tsx", code: `<Image src="…" width={800} height={450} alt="…" />` }, { label: "CSS (keeps them responsive)", lang: "css", code: `img { max-width: 100%; height: auto; }` }] }] };
    case "sitemap_bad_urls": {
      const changes = f.urls.slice(0, CAP).map((u) => {
        const p = page(u);
        return p?.kind === "redirect" && p.final_url ? { page: null, text: "Replace in the sitemap.", find: u, replace: p.final_url } : { page: null, text: "Remove from the sitemap (it errors or is noindex).", find: u };
      });
      return { summary: "Update the sitemap generator so it lists only final, indexable addresses.", changes, code: [] };
    }
    case "duplicate_content": {
      const groups = (f.detail?.groups as string[][]) ?? [];
      const code = groups.map((g) => {
        const keep = [...g].sort((x, y) => x.length - y.length)[0];
        return g.filter((u) => u !== keep).map((u) => `<!-- on ${pathOf(u)} -->\n<link rel="canonical" href="${esc(keep)}">`).join("\n");
      }).join("\n");
      return { summary: "Point duplicates at the main version with a canonical tag (or redirect them).", changes: [], code: code ? [headTag(code, "Canonical tags for duplicates")] : [] };
    }
    case "schema_required":
      return {
        summary: "Add the missing required properties to the structured data, then test in Google's Rich Results Test.",
        changes: [],
        code: [{ title: "SoftwareApplication example", note: "Only include ratings and prices that are real and visible on the page.", variants: [{ label: "JSON-LD", lang: "json", code: `{\n  "@context": "https://schema.org",\n  "@type": "SoftwareApplication",\n  "name": "…",\n  "applicationCategory": "BusinessApplication",\n  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },\n  "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.6", "ratingCount": "120" }\n}` }] }],
      };
    default:
      return null;
  }
}

function devTask(f: EngineFinding, site: string, k: Omit<FixKit, "devTask">, tier: string, owner: string): string {
  const L: string[] = [];
  L.push(`## [${tier}] ${f.title} — ${site}`);
  L.push("");
  L.push(`**Owner:** ${owner}  `);
  L.push(`**Do this:** ${k.summary}`);
  if (k.changes.length) {
    L.push("");
    L.push("**Changes:**");
    for (const c of k.changes.slice(0, 25)) {
      const where = c.page ? `\`${pathOf(c.page)}\`: ` : "";
      const fr = c.find && c.replace ? ` \`${c.find}\` → \`${c.replace}\`` : c.find ? ` (\`${c.find}\`)` : c.replace ? ` → \`${c.replace}\`` : "";
      L.push(`- ${where}${c.text}${fr}`);
    }
    if (k.changes.length > 25) L.push(`- …and ${k.changes.length - 25} more (see AuditPilot).`);
  }
  for (const c of k.code.slice(0, 2)) {
    L.push("");
    L.push(`**${c.title}** (${c.variants[0].label}):`);
    L.push("```" + c.variants[0].lang);
    L.push(c.variants[0].code);
    L.push("```");
  }
  L.push("");
  L.push(`**Done when:** ${DAY_TASK_CHECK}`);
  return L.join("\n");
}

export function buildFixKit(a: EngineAudit, f: EngineFinding, groups: Ctx["groups"], tier: string, owner: string): FixKit | null {
  const pages = new Map(a.pages.map((p) => [p.url, p]));
  const k = kit({ a, f, pages, groups });
  if (!k) return null;
  return { ...k, devTask: devTask(f, a.site.domain, k, tier, owner) };
}
