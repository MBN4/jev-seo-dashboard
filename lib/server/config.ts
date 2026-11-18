import "server-only";
import fs from "node:fs";
import path from "node:path";

/**
 * Where the dashboard finds the jev-seo engine and where it keeps its own state.
 * Everything is overridable through environment variables (see .env.example).
 */
function resolveDir(p: string): string {
  if (p.startsWith("~/")) p = path.join(process.env.HOME ?? "", p.slice(2));
  return path.resolve(p);
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
  return resolveDir(process.env.JEVSEO_DIR ?? path.join(process.cwd(), "..", "jev-seo"));
}

/** Python interpreter that runs `-m jevseo`. Prefers the engine's own virtualenv. */
export function enginePython(): string {
  if (process.env.JEVSEO_PYTHON) return resolveDir(process.env.JEVSEO_PYTHON);
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
  return resolveDir(process.env.JEVSEO_REPORTS_DIR ?? path.join(engineDir(), "jev-seo-reports"));
}

/** Dashboard-owned state: app-state JSON, secrets file, job logs. Never inside report folders. */
export function dataDir(): string {
  return resolveDir(process.env.JEVSEO_DATA_DIR ?? path.join(process.cwd(), "data"));
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
  const n = Number(process.env.JEVSEO_MAX_CONCURRENT ?? 1);
  return Number.isFinite(n) && n >= 1 ? Math.min(Math.floor(n), 4) : 1;
}

/** Hard ceiling for one audit process (engine crawl budget is separate). */
export function maxAuditSeconds(): number {
  const n = Number(process.env.JEVSEO_MAX_AUDIT_SECONDS ?? 3600);
  return Number.isFinite(n) && n >= 60 ? n : 3600;
}

export function ensureDir(dir: string, mode = 0o700): void {
  fs.mkdirSync(dir, { recursive: true, mode });
}
