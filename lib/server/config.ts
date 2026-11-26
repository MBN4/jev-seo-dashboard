import "server-only";
import fs from "node:fs";
import path from "node:path";
import { ENGINE_REPORTS_FOLDER } from "@/lib/engine-protocol";

/**
 * Where AuditPilot finds the audit engine and where it keeps its own state.
 * Everything is overridable through environment variables (see .env.example). Settings use the
 * AUDITPILOT_ prefix; the older JEVSEO_ names are still accepted so existing .env.local files work.
 */
function resolveDir(p: string): string {
  if (p.startsWith("~/")) p = path.join(process.env.HOME ?? "", p.slice(2));
  return path.resolve(p);
}

/** Read AUDITPILOT_<name>, falling back to the legacy variable name. */
export function setting(name: string, legacy?: string): string | undefined {
  // AUDITPILOT_* first; the earlier RANKORA_* and JEVSEO_* names keep working.
  const v = process.env[`AUDITPILOT_${name}`] ?? process.env[`RANKORA_${name}`] ?? (legacy ? process.env[legacy] : undefined);
  return v && v.trim() ? v.trim() : undefined;
}

function firstExisting(candidates: string[]): string | undefined {
  return candidates.find((c) => {
    try {
      return fs.statSync(c).isFile();
    } catch {
      return false;
    }
  });
}

export function engineDir(): string {
  return resolveDir(setting("ENGINE_DIR", "JEVSEO_DIR") ?? path.join(process.cwd(), "..", "jev-seo"));
}

/** Python interpreter that runs the engine. Prefers the engine's own virtualenv. */
export function enginePython(): string {
  const configured = setting("ENGINE_PYTHON", "JEVSEO_PYTHON");
  // A bare command (e.g. "python3") is looked up on PATH; anything with a slash is a path.
  if (configured) return configured.includes("/") ? resolveDir(configured) : configured;
  const dir = engineDir();
  return (
    firstExisting([
      path.join(dir, ".venv", "bin", "python"),
      path.join(dir, "venv", "bin", "python"),
      path.join(dir, ".venv", "bin", "python3"),
    ]) ?? "python3"
  );
}

export function reportsDir(): string {
  return resolveDir(setting("REPORTS_DIR", "JEVSEO_REPORTS_DIR") ?? path.join(engineDir(), ENGINE_REPORTS_FOLDER));
}

/** Dashboard-owned state: app-state JSON, secrets file, job logs. Never inside report folders. */
export function dataDir(): string {
  return resolveDir(setting("DATA_DIR", "JEVSEO_DATA_DIR") ?? path.join(process.cwd(), "data"));
}

export function jobsDir(): string {
  return path.join(dataDir(), "jobs");
}

export function secretsFile(): string {
  return path.join(dataDir(), "secrets.env");
}

export function stateFile(): string {
  return path.join(dataDir(), "state.json");
}

export function maxConcurrentAudits(): number {
  const n = Number(setting("MAX_CONCURRENT", "JEVSEO_MAX_CONCURRENT") ?? 1);
  return Number.isFinite(n) && n >= 1 ? Math.min(Math.floor(n), 4) : 1;
}

/** Hard ceiling for one audit process (engine crawl budget is separate). */
export function maxAuditSeconds(): number {
  // Must exceed the largest crawl time budget (5400 s) plus scoring and report generation.
  const n = Number(setting("MAX_AUDIT_SECONDS", "JEVSEO_MAX_AUDIT_SECONDS") ?? 7200);
  return Number.isFinite(n) && n >= 60 ? n : 7200;
}

export function ensureDir(dir: string, mode = 0o700): void {
  fs.mkdirSync(dir, { recursive: true, mode });
}
