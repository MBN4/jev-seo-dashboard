import type { AuditOptions } from "@/lib/schemas";
import type { RecommendationStatus } from "@/lib/server/state";
import type { ExtraResult } from "@/lib/server/extra-checks";
import type { SiteSize } from "@/lib/server/site-size";
import type { monitorOverview } from "@/lib/server/monitor";
import type { FixedIssue, IssueRecord, OpenIssue, Progress } from "@/lib/issue-progress";
import type { GscAlert, MetricRow, SitemapInfo, kpis as gscKpis, opportunities as gscOpportunities, indexing as gscIndexing } from "@/lib/gsc-insights";

export type MonitorData = ReturnType<typeof monitorOverview>;
export type MonitorSite = MonitorData["sites"][number];
export type MonitorEvent = MonitorData["events"][number];

type WithCount<T> = T & { urlCount: number };
export type ProgressOpen = OpenIssue & { urlCount: number; pagesFixedCount: number; pagesNewCount: number };
export interface ProgressView extends Omit<Progress, "open" | "fixLog" | "sinceLast" | "intended"> {
  open: ProgressOpen[];
  fixLog: Array<WithCount<FixedIssue>>;
  sinceLast: { fixed: Array<WithCount<FixedIssue>>; newIssues: string[]; worse: string[]; better: string[]; pagesFixed: number; pagesNew: number } | null;
  intended: Array<WithCount<IssueRecord>>;
  storage: { audits: number; auditBytes: number; historyBytes: number; keepAuditDays: number | null };
}
export interface ProgressSites {
  sites: Array<{ domain: string; url: string; reports: number; latest: Progress["latest"]; previous: Progress["previous"]; open: number; openByTier: Progress["openByTier"]; fixedSinceLast: number | null; newSinceLast: number | null; fixedEver: number }>;
}

export interface GscConnection { configured: boolean; clientEmail: string | null; projectId: string | null; source: string | null }
export interface GscOverview {
  connection: GscConnection;
  sites: Array<{ domain: string; url: string; property: string | null; fetchedAt: string | null; error: string | null; alerts: number; kpis: ReturnType<typeof gscKpis> }>;
}
export interface GscTest { ok: boolean; clientEmail: string | null; error?: string; properties: Array<{ siteUrl: string; permissionLevel: string }>; sites: Array<{ domain: string; property: string | null }> }
export interface GscSiteView {
  domain: string;
  synced: boolean;
  property: string | null;
  fetchedAt: string | null;
  error: string | null;
  endDate?: string;
  days?: number;
  kpis?: NonNullable<ReturnType<typeof gscKpis>>;
  series?: MetricRow[];
  history?: MetricRow[];
  queries?: MetricRow[];
  pages?: MetricRow[];
  countries?: MetricRow[];
  devices?: MetricRow[];
  appearance?: MetricRow[];
  searchTypes?: MetricRow[];
  opportunities?: NonNullable<ReturnType<typeof gscOpportunities>>;
  indexing?: ReturnType<typeof gscIndexing>;
  sitemaps?: SitemapInfo[];
  alerts?: GscAlert[];
}
import type { Checklist } from "@/lib/server/checklist";
import type { Column, ExplorerOverview, FilterKind, Row } from "@/lib/server/explorer";

export interface ExplorerRowsResult {
  tab: string;
  columns: Column[];
  filter: { key: string; label: string; help: string; kind: FilterKind } | null;
  total: number;
  page: number;
  pageSize: number;
  rows: Row[];
}
import type {
  AiData, AuditList, AuditSummary, Diagnostics, FindingDetail, FindingsData, HistoryData, OverviewData,
  PageDetailData, PagesData, PerformanceData, ProgressSnapshot, Recommendation, ReportFile, SettingsData,
} from "@/lib/api-types";

/** Typed client for the dashboard's own API routes. */

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers }, cache: "no-store" });
  } catch {
    throw new ApiError(0, "Cannot reach the dashboard server. Is it still running?");
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, data?.error?.message ?? `Request failed (${res.status})`, data?.error?.details);
  return data as T;
}

const enc = encodeURIComponent;
export type Query = Record<string, string | number | undefined | null | string[]>;

export function qs(params: Query): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === "") continue;
    if (Array.isArray(v)) v.forEach((x) => sp.append(k, x));
    else sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const api = {
  listAudits: (q: Query = {}) => request<AuditList>(`/api/audits${qs(q)}`),
  getAudit: (id: string) => request<AuditSummary>(`/api/audits/${enc(id)}`),
  createAudit: (body: { url: string; options: Partial<AuditOptions>; confirmPaid?: boolean; keywords?: string[] }) =>
    request<{ id: string; status: string; warnings: string[] }>(`/api/audits`, { method: "POST", body: JSON.stringify(body) }),
  cancelAudit: (id: string) => request<{ id: string; status: string }>(`/api/audits/${enc(id)}/cancel`, { method: "POST" }),
  hideAudit: (id: string) => request<{ id: string; hidden: boolean }>(`/api/audits/${enc(id)}`, { method: "DELETE" }),
  importAudits: (body: { restoreAll?: boolean; restore?: string[] } = {}) =>
    request<{ discovered: number; visible: number; restored: string[]; hidden: string[] }>(`/api/audits/import`, { method: "POST", body: JSON.stringify(body) }),
  hiddenAudits: () => request<{ discovered: number; hidden: Array<{ id: string; hiddenAt: string }> }>(`/api/audits/import`),
  progress: (id: string) => request<ProgressSnapshot>(`/api/audits/${enc(id)}/progress`),
  overview: (id: string) => request<OverviewData>(`/api/audits/${enc(id)}/results`),
  findings: (id: string, q: Query) => request<FindingsData>(`/api/audits/${enc(id)}/findings${qs(q)}`),
  finding: (id: string, fid: string) => request<FindingDetail>(`/api/audits/${enc(id)}/findings/${enc(fid)}`),
  pages: (id: string, q: Query) => request<PagesData>(`/api/audits/${enc(id)}/pages${qs(q)}`),
  pageDetail: (id: string, url: string) => request<PageDetailData>(`/api/audits/${enc(id)}/pages/detail${qs({ url })}`),
  ai: (id: string) => request<AiData>(`/api/audits/${enc(id)}/ai`),
  performance: (id: string) => request<PerformanceData>(`/api/audits/${enc(id)}/performance`),
  recommendations: (id: string) => request<{ items: Recommendation[] }>(`/api/audits/${enc(id)}/recommendations`),
  updateRecommendation: (id: string, key: string, body: { status?: RecommendationStatus; notes?: string }) =>
    request<{ key: string; status: RecommendationStatus; notes: string; updatedAt: string }>(`/api/audits/${enc(id)}/recommendations/${enc(key)}`, { method: "PATCH", body: JSON.stringify(body) }),
  siteSize: (url: string) => request<SiteSize>(`/api/site-size`, { method: "POST", body: JSON.stringify({ url }) }),
  explorer: (id: string) => request<ExplorerOverview>(`/api/audits/${enc(id)}/explorer`),
  explorerRows: (id: string, tab: string, q: Query) => request<ExplorerRowsResult>(`/api/audits/${enc(id)}/explorer/${enc(tab)}${qs(q)}`),
  explorerCsvUrl: (id: string, tab: string, q: Query) => `/api/audits/${enc(id)}/explorer/${enc(tab)}${qs({ ...q, format: "csv" })}`,
  checklist: (id: string) => request<Checklist>(`/api/audits/${enc(id)}/checklist`),
  extra: (id: string) => request<ExtraResult>(`/api/audits/${enc(id)}/extra`),
  setKeywords: (id: string, keywords: string[]) => request<{ keywords: string[] }>(`/api/audits/${enc(id)}/keywords`, { method: "PUT", body: JSON.stringify({ keywords }) }),
  reports: (id: string) => request<{ items: ReportFile[]; branded: { ready: boolean; building: boolean } }>(`/api/audits/${enc(id)}/reports`),
  reportUrl: (id: string, type: string, inline = false) => `/api/audits/${enc(id)}/reports/${enc(type)}${inline ? "?inline=1" : ""}`,
  history: (domain?: string) => request<HistoryData>(`/api/history${qs({ domain })}`),
  settings: () => request<SettingsData>(`/api/settings`),
  saveSettings: (body: { secrets?: Record<string, string | null>; defaults?: Partial<AuditOptions> }) =>
    request<SettingsData>(`/api/settings`, { method: "PUT", body: JSON.stringify(body) }),
  verifyKey: (service: "pagespeed" | "dataforseo") =>
    request<{ service: string; ok: boolean; status: string; message: string }>(`/api/settings/verify`, { method: "POST", body: JSON.stringify({ service }) }),
  monitor: () => request<MonitorData>(`/api/monitor`),
  monitorAdd: (url: string) => request<unknown>(`/api/monitor/sites`, { method: "POST", body: JSON.stringify({ url }) }),
  monitorUpdate: (domain: string, body: { enabled?: boolean; intervalHours?: number }) => request<unknown>(`/api/monitor/sites/${enc(domain)}`, { method: "PATCH", body: JSON.stringify(body) }),
  monitorRemove: (domain: string) => request<unknown>(`/api/monitor/sites/${enc(domain)}`, { method: "DELETE" }),
  monitorRun: (domain: string) => request<{ queued: boolean }>(`/api/monitor/sites/${enc(domain)}/run`, { method: "POST" }),
  monitorSeen: (ids?: string[]) => request<{ ok: boolean }>(`/api/monitor/seen`, { method: "POST", body: JSON.stringify(ids ? { ids } : {}) }),
  siteProgress: () => request<ProgressSites>(`/api/progress`),
  siteProgressDetail: (domain: string) => request<ProgressView>(`/api/progress/${enc(domain)}`),
  progressReportUrl: (domain: string) => `/api/progress/${enc(domain)}/report`,
  setRetention: (keepAuditDays: number | null) => request<{ keepAuditDays: number | null }>(`/api/monitor/settings`, { method: "PATCH", body: JSON.stringify({ keepAuditDays }) }),
  gsc: () => request<GscOverview>(`/api/gsc`),
  gscSite: (domain: string, days: number) => request<GscSiteView>(`/api/gsc/sites/${enc(domain)}${qs({ days })}`),
  gscSaveKey: (json: string) => request<GscConnection>(`/api/gsc/credentials`, { method: "PUT", body: JSON.stringify({ json }) }),
  gscRemoveKey: () => request<GscConnection>(`/api/gsc/credentials`, { method: "DELETE" }),
  gscTest: () => request<GscTest>(`/api/gsc/test`, { method: "POST" }),
  gscSync: (domain?: string) => request<{ ok: boolean; error?: string; started?: boolean; newAlerts?: GscAlert[] }>(`/api/gsc/sync`, { method: "POST", body: JSON.stringify(domain ? { domain } : {}) }),
  health: () => request<{ status: string; engineFound: boolean; running: Array<{ id: string; domain: string; startedAt: string | null }> }>(`/api/system/health`),
  diagnostics: (refresh = false) => request<Diagnostics>(`/api/system/diagnostics${refresh ? "?refresh=1" : ""}`),
};
