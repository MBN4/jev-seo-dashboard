// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockFetch } from "./test-utils";
import { summary } from "./fixtures";
import { AuditCtx } from "@/components/audit/audit-context";
import ExtraChecksTab from "@/app/audits/[id]/extra/page";
import { render as _r } from "@testing-library/react";
import { LogoMark } from "@/components/layout/logo";
import { BRAND } from "@/lib/brand";

const payload = (keywords: string[]) => ({
  findings: [
    { id: "eeat_about", group: "eeat", severity: "medium", title: "No About page found", fix: "Publish an About page and link it.", source: "https://developers.google.com/search/docs/fundamentals/creating-helpful-content", heuristic: true, urls: ["https://a.org/"], count: 1, evidence: "No page named About" },
  ],
  passed: ["url_uppercase"],
  skipped: keywords.length ? [] : [{ id: "kw_title", reason: "No focus keywords set for this audit." }],
  keywords,
  keywordReport: keywords.map((k) => ({ keyword: k, targetUrl: "https://a.org/x", targetTitle: "X", checks: { title: true, h1: false, url: true, meta: false, intro: true }, occurrences: 3, densityPct: 1.2, wordCount: 500 })),
  readability: [{ url: "https://a.org/x", score: 45 }],
  notCheckable: [{ topic: "Image formats", why: "Not saved." }],
  checksTotal: 31,
});

describe("extra checks tab", () => {
  it("shows issues with fixes and saves focus keywords, then re-checks", async () => {
    let saved: string[] = [];
    const calls = mockFetch({
      "PUT /api/audits/a/keywords": (init?: RequestInit) => ((saved = JSON.parse(String(init?.body)).keywords), { keywords: saved }),
      "GET /api/audits/a/extra": () => payload(saved),
    });
    render(<AuditCtx.Provider value={{ audit: summary({ id: "a" }), reload: () => {} }}><ExtraChecksTab /></AuditCtx.Provider>);
    expect(await screen.findByText("No About page found")).toBeInTheDocument();
    await userEvent.click(screen.getByText("No About page found"));
    expect(await screen.findByText(/Publish an About page/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Add focus keywords"), "seo audit, rank tracker");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    await userEvent.click(screen.getByRole("button", { name: /save and re-check/i }));
    await waitFor(() => expect(saved).toEqual(["seo audit", "rank tracker"]));
    expect(await screen.findByText("rank tracker", { selector: "td" })).toBeInTheDocument();
    expect(screen.getAllByLabelText("H1: no").length).toBe(2);
    expect(calls.filter((c) => c.url.endsWith("/extra")).length).toBeGreaterThanOrEqual(2);
  });
});

describe("branding", () => {
  it("uses the configured brand, not the upstream engine name", () => {
    expect(BRAND.name).not.toMatch(/jev/i);
    const { container } = _r(<LogoMark />);
    expect(container.textContent).toBe(BRAND.initials);
  });
});
