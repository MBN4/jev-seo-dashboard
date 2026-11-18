import type { AuditOptions } from "@/lib/schemas";

export type AuditStatus = "queued" | "running" | "completed" | "failed" | "cancelled" | "interrupted";
export type ReportType = "pdf" | "xlsx" | "md" | "json" | "digest";

export interface ReportFile {
  type: ReportType;
  label: string;
  filename: string;
  size: number;
  modifiedAt: string;
}

export interface SeverityCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}

export interface AuditSummary {
  id: string;
  url: string;
  domain: string;
  status: AuditStatus;
  /** "dashboard" = launched from this app; "imported" = found in the reports folder */
  origin: "dashboard" | "imported";
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  engineVersion: string | null;
  score: number | null;
  grade: string | null;
  partial: string[];
  completeness: { scored: number; total: number } | null;
  pagesCrawled: number | null;
  htmlPages: number | null;
  sitemapUrls: number | null;
  findingsTotal: number | null;
  severity: SeverityCounts | null;
  actionsTotal: number | null;
  passedRules: number | null;
  rulesEvaluated: number | null;
  reports: ReportType[];
  error: string | null;
  options: Partial<AuditOptions> | null;
  hasResults: boolean;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
