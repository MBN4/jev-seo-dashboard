import type { AuditOptions } from "@/lib/schemas";
import type { RecommendationStatus } from "@/lib/server/state";
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
  createAudit: (body: { url: string; options: Partial<AuditOptions>; confirmPaid?: boolean }) =>
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
  reports: (id: string) => request<{ items: ReportFile[] }>(`/api/audits/${enc(id)}/reports`),
  reportUrl: (id: string, type: string, inline = false) => `/api/audits/${enc(id)}/reports/${enc(type)}${inline ? "?inline=1" : ""}`,
  history: (domain?: string) => request<HistoryData>(`/api/history${qs({ domain })}`),
  settings: () => request<SettingsData>(`/api/settings`),
  saveSettings: (body: { secrets?: Record<string, string | null>; defaults?: Partial<AuditOptions> }) =>
    request<SettingsData>(`/api/settings`, { method: "PUT", body: JSON.stringify(body) }),
  health: () => request<{ status: string; engineFound: boolean; running: Array<{ id: string; domain: string; startedAt: string | null }> }>(`/api/system/health`),
  diagnostics: (refresh = false) => request<Diagnostics>(`/api/system/diagnostics${refresh ? "?refresh=1" : ""}`),
};
