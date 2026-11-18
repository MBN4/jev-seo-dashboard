/** Response types for the dashboard API (inferred from the server projections). */
import type { overview, findings, finding, pages, pageDetail, aiContent, performance, recommendations } from "@/lib/server/results";
import type { progressSnapshot } from "@/lib/server/progress";
import type { secretStatuses } from "@/lib/server/secrets";
import type { diagnostics } from "@/lib/server/diagnostics";
import type { AuditOptions } from "@/lib/schemas";
import type { AuditSummary, Paginated, ReportFile } from "@/types/api";

export type OverviewData = ReturnType<typeof overview>;
export type FindingsData = ReturnType<typeof findings>;
export type FindingListItem = FindingsData["items"][number];
export type FindingDetail = NonNullable<ReturnType<typeof finding>>;
export type PagesData = ReturnType<typeof pages>;
export type PageRowData = PagesData["items"][number];
export type PageDetailData = NonNullable<ReturnType<typeof pageDetail>>;
export type AiData = ReturnType<typeof aiContent>;
export type PerformanceData = ReturnType<typeof performance>;
export type Recommendation = ReturnType<typeof recommendations>[number];
export type ProgressSnapshot = NonNullable<ReturnType<typeof progressSnapshot>>;
export type SecretStatus = ReturnType<typeof secretStatuses>[number];
export type Diagnostics = Awaited<ReturnType<typeof diagnostics>>;
export interface SettingsData {
  secrets: SecretStatus[];
  defaults: AuditOptions;
}
export interface HistoryData {
  domains: string[];
  points: Array<{ id: string; domain: string; date: string | null; score: number; grade: string | null }>;
}
export type AuditList = Paginated<AuditSummary>;
export type { AuditSummary, ReportFile };
