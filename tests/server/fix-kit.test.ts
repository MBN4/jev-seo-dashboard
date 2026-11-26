import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildFixKit, closestPage, redirectCode } from "@/lib/server/fix-kit";
import { findingBreakdown } from "@/lib/server/finding-breakdown";
import type { EngineAudit, EngineFinding } from "@/types/engine";

const B = "https://shop.example.org";
const base = () => JSON.parse(fs.readFileSync(path.join(__dirname, "..", "fixtures", "audit.json"), "utf8")) as EngineAudit;
const page = (url: string, over: Record<string, unknown> = {}) => ({ url, final_url: url, status: 200, kind: "page", title: "Page | Shop", word_count: 300, links_internal: [], links_external: [], images: { total: 0, missing_alt: 0 }, ...over });
const finding = (id: string, urls: string[], over: Partial<EngineFinding> = {}): EngineFinding => ({ id, origin: "rule", category: "links", severity: "high", title: id, fix: "Fix it.", effort: 1, heuristic: false, urls, count: urls.length, evidence: "", detail: {}, ...over });

function audit(pages: unknown[], findings: EngineFinding[], site: Record<string, unknown> = {}): EngineAudit {
  const a = base();
  a.site = { ...a.site, domain: "shop.example.org", final_url: `${B}/`, ...site };
  a.pages = pages as EngineAudit["pages"];
  a.findings = findings;
  return a;
}

describe("fix kit", () => {
  it("finds the page a broken address meant, by title or by URL words", () => {
    const a = audit([page(`${B}/blog/email-warm-up-api`, { title: "Email Warm-Up API: Programmatic Warm-Up for Developers | Shop" }), page(`${B}/pricing-plans`)], []);
    expect(closestPage(a, `${B}/blog/Email%20Warm-Up%20API:%20Programmatic%20Warm-Up%20for%20Developers`)).toMatchObject({ url: `${B}/blog/email-warm-up-api`, why: expect.stringMatching(/title/) });
    expect(closestPage(a, `${B}/pricing-plan`)).toBeNull(); // "plan" ≠ "plans": no weak guesses
    expect(closestPage(a, `${B}/plans/pricing`)).toMatchObject({ url: `${B}/pricing-plans` });
  });

  it("suggests where other links with the same text go, and never the page itself", () => {
    const broken = `${B}/blog/Start%20trial`;
    const a = audit(
      [
        page(`${B}/blog/post`, { links_internal: [{ url: broken, anchor: "Start Your Free Trial" }] }),
        page(`${B}/`, { links_external: [{ url: "https://app.example.org/sign_up", anchor: "Start Your Free Trial" }] }),
        page(`${B}/about`, { links_external: [{ url: "https://app.example.org/sign_up", anchor: "start your free trial" }] }),
      ],
      [finding("broken_internal_links", [`${B}/blog/post`])],
      { link_status: { [broken]: 404 }, external_status: { "https://app.example.org/sign_up": 200 } },
    );
    const b = findingBreakdown(a, a.findings[0]);
    expect(b.groups![0].suggestion?.value.href).toBe("https://app.example.org/sign_up");
    expect(b.fix!.changes[0]).toMatchObject({ page: `${B}/blog/post`, find: "/blog/Start trial", replace: "https://app.example.org/sign_up" });
    expect(b.fix!.devTask).toContain("## [P1] broken_internal_links — shop.example.org");
    expect(b.fix!.devTask).toContain("**Done when:**");
  });

  it("turns Cloudflare email-protection links into one setting change", () => {
    const cf = `${B}/cdn-cgi/l/email-protection`;
    const a = audit([page(`${B}/`, { links_internal: [{ url: cf, anchor: "[email protected]" }] }), page(`${B}/b`, { links_internal: [{ url: cf, anchor: "[email protected]" }] })], [finding("broken_internal_links", [`${B}/`, `${B}/b`])], { link_status: { [cf]: 404 } });
    const k = findingBreakdown(a, a.findings[0]).fix!;
    expect(k.changes).toHaveLength(1);
    expect(k.changes[0]).toMatchObject({ page: null, text: expect.stringMatching(/Email Address Obfuscation.*all 2 pages/) });
    expect(k.code).toEqual([]); // no redirect for a Cloudflare endpoint
  });

  it("writes redirect rules that are safe for each server", () => {
    const c = redirectCode([{ from: `${B}/blog/A:B (x)`, to: `${B}/blog/a-b` }])!;
    const v = Object.fromEntries(c.variants.map((x) => [x.label, x.code]));
    expect(v["Next.js (next.config.js)"]).toContain('source: "/blog/A\\\\:B \\\\(x\\\\)"'); // ":" and "()" are escaped for path-to-regexp
    expect(v.nginx).toBe('location = "/blog/A:B (x)" { return 301 https://shop.example.org/blog/a-b; }');
    expect(v["Apache (.htaccess)"]).toBe('Redirect 301 "/blog/A:B (x)" https://shop.example.org/blog/a-b');
  });

  it("gives host redirects, viewport tags and drafts only from real text", () => {
    const a = audit(
      [
        page(`${B}/docs/a`, { h1: ["Setup guide"], text_excerpt: "Docs Home Pricing Setup guide This guide shows you how to connect your account and verify your first list in a few minutes. More text." }),
        page(`${B}/docs/b`, { h1: ["Other"], text_excerpt: "Services AI Data Product Engineering Cloud Infrastructure View All Services Contact Us Today" }),
      ],
      [finding("viewport_missing", [`${B}/docs/a`, `${B}/docs/b`]), finding("meta_missing", [`${B}/docs/a`, `${B}/docs/b`]), finding("host_variant", [`https://www.shop.example.org/`])],
    );
    const vp = buildFixKit(a, a.findings[0], [], "P1", "Dev")!;
    expect(vp.summary).toContain("every page under /docs/");
    const meta = buildFixKit(a, a.findings[1], [], "P2", "Content")!;
    expect(meta.changes[0].replace).toBe("This guide shows you how to connect your account and verify your first list in a few minutes.");
    expect(meta.changes[1].replace).toBeUndefined(); // menu text is never used as a draft
    const host = buildFixKit(a, a.findings[2], [], "P1", "Dev")!;
    expect(host.summary).toBe("Redirect www.shop.example.org to shop.example.org with a 301 (one host for the whole site).");
    expect(host.code[0].variants.map((x) => x.label)).toEqual(["nginx", "Next.js (next.config.js)", "Apache (.htaccess)", "Cloudflare"]);
  });
});
