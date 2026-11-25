// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockFetch } from "./test-utils";
import { summary } from "./fixtures";
import { AuditProgressTracker } from "@/components/audit/audit-progress-tracker";
import { SeoScoreCard } from "@/components/audit/seo-score-card";
import { AuditHistoryTable } from "@/components/audit/audit-history-table";
import { RecommendationCard } from "@/components/audit/recommendation-card";
import { ReportDownloadCard } from "@/components/audit/report-download-card";
import { ApiKeyInput } from "@/components/settings/api-key-input";
import { PerformanceMetricCard } from "@/components/audit/performance-metric-card";
import { ScoreGauge } from "@/components/charts/score-gauge";
import { parseEngineLog, summarizeProgress } from "@/lib/progress";
import type { Recommendation } from "@/lib/api-types";

describe("progress tracker", () => {
  it("shows measured stage state and counters from engine events", () => {
    const p = summarizeProgress(parseEngineLog("[jevseo 00:00] == 1/7 Crawl: pages\n[jevseo 00:03] crawled 12/60 URLs, 4 queued"), "running");
    render(<AuditProgressTracker progress={p} />);
    expect(screen.getByText(/0/, { selector: "span.font-medium" })).toBeInTheDocument();
    expect(screen.getByText("12 of up to 60")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Stages finished" })).toHaveAttribute("aria-valuenow", "0");
    expect(screen.getAllByRole("listitem")).toHaveLength(7);
  });
});

describe("dashboard widgets", () => {
  it("renders the engine score, grade, completeness and partial reasons", () => {
    render(
      <SeoScoreCard
        scores={{ overall: 60, grade: "C", partial: ["AI judgments unavailable"], caps: [], categories: {}, category_names: {}, weights: {}, completeness: { categories_scored: 7, categories_total: 9, ai: false, pagespeed: false, dataforseo: false } }}
      />,
    );
    expect(screen.getByRole("img", { name: /60 out of 100, grade C/ })).toBeInTheDocument();
    expect(screen.getByText("Partial audit")).toBeInTheDocument();
    expect(screen.getByText("AI judgments: not included")).toBeInTheDocument();
  });

  it("shows an unavailable gauge rather than zero", () => {
    render(<ScoreGauge score={null} grade={null} />);
    expect(screen.getByRole("img", { name: /not available/ })).toBeInTheDocument();
  });

  it("labels missing performance data as unavailable, never 0", () => {
    render(<PerformanceMetricCard label="LCP" value={null} />);
    expect(screen.getByText("Not available")).toBeInTheDocument();
    expect(screen.queryByText("0")).toBeNull();
  });
});

describe("history table", () => {
  it("lists audits, links running audits to progress and offers removal", async () => {
    const onRemove = vi.fn();
    render(<AuditHistoryTable audits={[summary(), summary({ id: "run.org-2026-01-01-0000", domain: "run.org", status: "running", hasResults: false, score: null, grade: null })]} onRemove={onRemove} />);
    expect(screen.getByRole("link", { name: "example.org" })).toHaveAttribute("href", "/audits/example.org-2026-01-01-0000");
    expect(screen.getByRole("link", { name: "run.org" })).toHaveAttribute("href", "/audits/run.org-2026-01-01-0000/progress");
    await userEvent.click(screen.getByRole("button", { name: "More actions for example.org" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /remove from history/i }));
    expect(onRemove).toHaveBeenCalled();
  });
});

describe("recommendations", () => {
  const rec: Recommendation = {
    key: "meta_missing", actionId: "RK-002", priority: "P2", impact: 45, effort: 1, quickWin: true, importance: null, origin: "rule", category: "onpage", categoryName: "On-page",
    severity: "medium", title: "Pages without a meta description", fix: "Write descriptions.", source: null, evidence: "3 pages", count: 3, urls: ["https://example.org/a"], needsReview: 0, heuristic: false,
    status: "pending", notes: "", updatedAt: null,
  };
  it("saves notes through the API and reports the new state", async () => {
    const calls = mockFetch({ "PATCH /api/audits/a/recommendations/meta_missing": { key: "meta_missing", status: "pending", notes: "Owner: Sam", updatedAt: "2026-01-01T00:00:00Z" } });
    const onChange = vi.fn();
    render(<RecommendationCard auditId="a" rec={rec} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Show details" }));
    await userEvent.type(screen.getByLabelText(/your notes/i), "Owner: Sam");
    await userEvent.click(screen.getByRole("button", { name: /save notes/i }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ notes: "Owner: Sam" })));
    expect(JSON.parse(String(calls[0].init!.body))).toEqual({ notes: "Owner: Sam" });
  });
});

describe("reports and settings", () => {
  it("links downloads to the secure report endpoint", () => {
    render(<ReportDownloadCard auditId="site-2026" report={{ type: "pdf", label: "PDF report", filename: "report.pdf", size: 2048, modifiedAt: "2026-01-01T00:00:00Z" }} />);
    expect(screen.getByRole("link", { name: "Download PDF report" })).toHaveAttribute("href", "/api/audits/site-2026/reports/pdf");
    expect(screen.getByText(/2.0 KB/)).toBeInTheDocument();
  });

  it("API key input is write-only and masked", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<ApiKeyInput status={{ key: "PAGESPEED_API_KEY", configured: true, source: "dashboard", hint: "••••abcd", usedFor: "PSI" }} onSave={onSave} onRemove={vi.fn()} />);
    const input = screen.getByLabelText("PAGESPEED_API_KEY");
    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveValue("");
    expect(screen.getByText("••••abcd")).toBeInTheDocument();
    await userEvent.type(input, "new-key-value-1234567");
    await userEvent.click(within(input.closest("form")!).getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledWith("new-key-value-1234567");
    await waitFor(() => expect(input).toHaveValue(""));
  });
});
