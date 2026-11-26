// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockFetch } from "./test-utils";
import { SiteSizeCounter, suggestedTimeBudget } from "@/components/audit/site-size-counter";

const result = (estimate: number) => ({
  inputUrl: "clustox-demo.com", finalUrl: "https://www.clustox-demo.com/", host: "www.clustox-demo.com", robotsFound: true, sitemapsDeclared: 1,
  sitemapFiles: [{ url: "https://www.clustox-demo.com/sitemap.xml", type: "urlset", urls: estimate, error: null }],
  sitemapUrlCount: estimate, homepageLinks: 63, sample: [], truncated: false, estimate, basis: "sitemap", durationMs: 900, notes: [],
});

describe("count pages", () => {
  it("counts a site's pages and applies them as the crawl limit", async () => {
    const calls = mockFetch({ "POST /api/site-size": result(732) });
    const onApply = vi.fn();
    render(<SiteSizeCounter url="clustox-demo.com" currentMax={60} onApply={onApply} />);
    await userEvent.click(screen.getByRole("button", { name: /count pages/i }));
    expect(await screen.findByText(/Pages listed in the site's sitemaps/)).toBeInTheDocument();
    expect(JSON.parse(String(calls[0].init!.body))).toEqual({ url: "clustox-demo.com" });
    await userEvent.click(screen.getByRole("button", { name: /crawl 732 pages/i }));
    expect(onApply).toHaveBeenCalledWith(732, suggestedTimeBudget(732), false);
  });

  it("caps very large sites at the dashboard maximum", async () => {
    mockFetch({ "POST /api/site-size": result(9000) });
    const onApply = vi.fn();
    render(<SiteSizeCounter url="bigsite-demo.com" currentMax={60} onApply={onApply} />);
    await userEvent.click(screen.getByRole("button", { name: /count pages/i }));
    await userEvent.click(await screen.findByRole("button", { name: /crawl 2,000 pages/i }));
    expect(onApply).toHaveBeenCalledWith(2000, suggestedTimeBudget(2000), false);
    expect(screen.getByText(/at most 2,000 pages/)).toBeInTheDocument();
  });

  it("counts automatically and sets the crawl limit when a site is entered", async () => {
    const calls = mockFetch({ "POST /api/site-size": result(49) });
    const onApply = vi.fn();
    render(<SiteSizeCounter url="https://mycoldinbox.com/" currentMax={60} onApply={onApply} auto />);
    expect(await screen.findByText(/Crawl limit set to 49 pages automatically/, {}, { timeout: 3000 })).toBeInTheDocument();
    expect(onApply).toHaveBeenCalledWith(49, suggestedTimeBudget(49), true);
    expect(calls).toHaveLength(1);
  });

  it("is disabled until the URL is valid", () => {
    render(<SiteSizeCounter url="not a url" currentMax={60} onApply={vi.fn()} />);
    expect(screen.getByRole("button", { name: /count pages/i })).toBeDisabled();
  });

  it("keeps time budgets within engine limits", () => {
    expect(suggestedTimeBudget(10)).toBe(600);
    expect(suggestedTimeBudget(732)).toBe(1500);
    expect(suggestedTimeBudget(2000)).toBe(4020);
    expect(suggestedTimeBudget(100000)).toBe(5400);
  });
});
