import { DEFAULT_AUDIT_OPTIONS } from "@/lib/schemas";
import type { AuditSummary } from "@/types/api";

export const summary = (over: Partial<AuditSummary> = {}): AuditSummary => ({
  id: "example.org-2026-01-01-0000", url: "https://example.org/", domain: "example.org", status: "completed", origin: "imported",
  createdAt: "2026-01-01T00:00:00Z", startedAt: "2026-01-01T00:00:00Z", finishedAt: "2026-01-01T00:02:00Z", engineVersion: "0.1.1",
  score: 72, grade: "C", partial: [], completeness: { scored: 7, total: 9 }, pagesCrawled: 12, htmlPages: 10, sitemapUrls: 30,
  findingsTotal: 9, severity: { critical: 1, high: 2, medium: 3, low: 2, info: 1 }, actionsTotal: 8, passedRules: 40, rulesEvaluated: 52,
  reports: ["pdf", "xlsx", "md", "json"], error: null, options: null, hasResults: true, ...over,
});

export const settings = {
  defaults: DEFAULT_AUDIT_OPTIONS,
  secrets: [
    { key: "TYPESAFE_API_KEY", configured: false, source: null, hint: null, usedFor: "AI judgments" },
    { key: "PAGESPEED_API_KEY", configured: true, source: "dashboard", hint: "••••abcd", usedFor: "PSI" },
    { key: "DATAFORSEO_USERNAME", configured: false, source: null, hint: null, usedFor: "DFS" },
    { key: "DATAFORSEO_PASSWORD", configured: false, source: null, hint: null, usedFor: "DFS" },
  ],
};
