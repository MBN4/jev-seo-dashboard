// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { setPathname } from "./test-utils";
import { SidebarNav } from "@/components/layout/app-sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { navHref, NAV, isActive } from "@/components/layout/nav";

describe("navigation", () => {
  it("renders every section in order", () => {
    setPathname("/");
    render(<TooltipProvider><SidebarNav /></TooltipProvider>);
    const labels = screen.getAllByRole("link").map((a) => a.textContent);
    expect(labels).toEqual(["Overview", "New Audit", "Audit History", "Monitoring", "Search Console", "Google Checklist", "Site Explorer", "Technical SEO", "Extra Checks", "Page Analysis", "AI Content Analysis", "Performance", "Recommendations", "Reports", "Settings"]);
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
  });

  it("scopes analysis links to the audit being viewed", () => {
    setPathname("/audits/site.org-2026-01-01-0000/pages");
    render(<TooltipProvider><SidebarNav /></TooltipProvider>);
    expect(screen.getByRole("link", { name: "Technical SEO" })).toHaveAttribute("href", "/audits/site.org-2026-01-01-0000/technical");
    expect(screen.getByRole("link", { name: "Page Analysis" })).toHaveAttribute("aria-current", "page");
  });

  it("falls back to latest-audit routes outside an audit", () => {
    const tech = NAV.find((n) => n.label === "Technical SEO")!;
    expect(navHref(tech, "/settings")).toBe("/technical");
    expect(isActive(tech, "/technical")).toBe(true);
  });
});
