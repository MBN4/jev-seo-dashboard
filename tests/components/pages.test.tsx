// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockFetch, setPathname } from "./test-utils";
import { summary } from "./fixtures";
import { AuditCtx } from "@/components/audit/audit-context";
import OverviewPage from "@/app/page";
import TechnicalPage from "@/app/audits/[id]/technical/page";
import PagesTab from "@/app/audits/[id]/pages/page";
import AiTab from "@/app/audits/[id]/ai/page";

const withAudit = (ui: React.ReactNode) => <AuditCtx.Provider value={{ audit: summary({ id: "a" }), reload: () => {} }}>{ui}</AuditCtx.Provider>;

describe("overview dashboard", () => {
  it("shows a professional empty state when there are no audits", async () => {
    setPathname("/");
    mockFetch({ "GET /api/audits": { items: [], total: 0, page: 1, pageSize: 100 } });
    render(<OverviewPage />);
    expect(await screen.findByText("No completed audits yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /start an audit/i })).toHaveAttribute("href", "/audits/new");
  });
});

const findingsPayload = (items: unknown[]) => ({
  items, total: items.length, page: 1, pageSize: 20, passedRules: ["robots_missing"],
  facets: { severity: { critical: 0, high: 1, medium: 0, low: 0, info: 0 }, category: [{ key: "security", name: "Security and trust", count: 1 }], origin: ["rule"] },
});
const F = { id: "no_https", key: "no_https", origin: "rule", category: "security", categoryName: "Security and trust", severity: "high", title: "Site not served over HTTPS", fix: "Use HTTPS", evidence: "HTTP 200", effort: 2, urls: ["https://a.org/"], urlCount: 1, count: 1 };

describe("technical findings", () => {
  it("sends severity filters to the API and opens the detail drawer", async () => {
    const calls = mockFetch({
      "GET /api/audits/a/findings/no_https": { ...F, urls: ["https://a.org/"], action: null, source: "https://developers.google.com" },
      "GET /api/audits/a/findings": findingsPayload([F]),
    });
    render(withAudit(<TechnicalPage />));
    expect(await screen.findByText("Site not served over HTTPS")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /High/ }));
    await waitFor(() => expect(calls.some((c) => c.url.includes("severity=high"))).toBe(true));
    await userEvent.click(screen.getByRole("button", { name: "Site not served over HTTPS" }));
    expect(await screen.findByText("Recommended fix")).toBeInTheDocument();
    expect(screen.getByText("Use HTTPS")).toBeInTheDocument();
  });
});

describe("page analysis", () => {
  it("lazy-loads page details when a row is selected", async () => {
    const row = { url: "https://a.org/about", status: 200, error: null, kind: "page", title: "About us", metaDescription: null, canonical: null, h1: "About", h1Count: 1, wordCount: 320, indexable: true, indexabilityNote: null, depth: 1, inlinks: 3, internalLinks: 8, externalLinks: 1, issueCount: 2, inSitemap: true, ttfbMs: 40, rendered: false, jevJudged: false };
    const calls = mockFetch({
      "GET /api/audits/a/pages/detail": { url: row.url, finalUrl: row.url, status: 200, error: null, kind: "page", fetchedAt: null, ttfbMs: 40, bytes: 1000, contentType: "text/html", redirectChain: [], rendered: false, jsDependent: false, depth: 1, inlinks: 3, inSitemap: true, indexable: true, indexabilityNote: null,
        meta: { title: "About us", titleLength: 8, titleCount: 1, description: null, descriptionLength: null, canonical: null, robots: null, xRobots: null, lang: "en", viewport: null, og: {}, twitterCard: null, hreflang: [] },
        headings: { h1: ["About"], outline: ["h1: About", "h2: Team"], skips: 0 }, content: { wordCount: 320, rawWordCount: 400, excerpt: "", callsToAction: [], images: null },
        links: { internal: [], internalTotal: 0, external: [], externalTotal: 0, nofollow: 0, linkStatus: {} }, structured: { types: [], errors: [] }, mixedContent: [], findings: [], jev: null },
      "GET /api/audits/a/pages": { items: [row], total: 1, page: 1, pageSize: 25 },
    });
    render(withAudit(<PagesTab />));
    expect(await screen.findByText("/about")).toBeInTheDocument();
    expect(calls.some((c) => c.url.includes("/pages/detail"))).toBe(false);
    await userEvent.click(screen.getByText("/about"));
    expect(await screen.findByRole("tab", { name: "Metadata" })).toBeInTheDocument();
    expect(calls.some((c) => c.url.includes("/pages/detail?url=https%3A%2F%2Fa.org%2Fabout"))).toBe(true);
  });
});

describe("AI content", () => {
  it("shows an unavailable state instead of mock judgments", async () => {
    mockFetch({ "GET /api/audits/a/ai": { available: false, skipped: null, ledger: {}, site: [], dimensions: [], pages: [], notJudged: [], pairs: [], findings: [], contentScore: null, contentNote: null } });
    render(withAudit(<AiTab />));
    expect(await screen.findByText(/was not available for this audit/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });
});
