import "server-only";
import fs from "node:fs";
import path from "node:path";
import { reportsDir } from "./config";
import type { ReportType } from "@/types/api";

/** Audit IDs are report folder names. Anything else is rejected before touching the disk. */
export const AUDIT_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;

export function isValidAuditId(id: string): boolean {
  return AUDIT_ID.test(id) && !id.includes("..");
}

/**
 * Resolve a registered audit folder, refusing anything that escapes the reports
 * directory (including through symlinks). Returns null when invalid or missing.
 */
export function auditFolder(id: string): string | null {
  if (!isValidAuditId(id)) return null;
  const root = reportsDir();
  const candidate = path.join(root, id);
  try {
    const realRoot = fs.realpathSync(root);
    const real = fs.realpathSync(candidate);
    if (path.dirname(real) !== realRoot) return null;
    if (!fs.statSync(real).isDirectory()) return null;
    return real;
  } catch {
    return null;
  }
}

/** The only files the dashboard will ever serve. Fixed names; no user-supplied paths. */
export const REPORT_FILES: Record<ReportType, { filename: string; label: string; mime: string }> = {
  pdf: { filename: "report.pdf", label: "PDF report", mime: "application/pdf" },
  xlsx: { filename: "report.xlsx", label: "Excel action tracker", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  md: { filename: "report.md", label: "Markdown report", mime: "text/markdown; charset=utf-8" },
  json: { filename: "audit.json", label: "Audit data (JSON)", mime: "application/json" },
  digest: { filename: "digest.md", label: "Evidence digest", mime: "text/markdown; charset=utf-8" },
};

export function reportPath(id: string, type: ReportType): string | null {
  const folder = auditFolder(id);
  const spec = REPORT_FILES[type];
  if (!folder || !spec) return null;
  const file = path.join(folder, spec.filename);
  try {
    const real = fs.realpathSync(file);
    if (path.dirname(real) !== folder || !fs.statSync(real).isFile()) return null;
    return real;
  } catch {
    return null;
  }
}
