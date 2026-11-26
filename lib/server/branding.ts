import "server-only";
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { dataDir, engineDir, enginePython, ensureDir } from "./config";
import { auditFolder } from "./paths";
import { BRAND } from "@/lib/brand";
import { ACTION_ID_PREFIX } from "@/lib/engine-protocol";

const run = promisify(execFile);

/**
 * Branded report copies.
 *
 * The engine writes its own report.pdf/xlsx/md. AuditPilot serves branded copies instead, built
 * by scripts/brand_report.py from the engine's files (which are only read, never changed).
 * Copies live in data/branded/<audit id>/ and are rebuilt when the source files or the brand
 * name change.
 */

export type BrandedType = "pdf" | "xlsx" | "md" | "digest";
export const BRANDED_FILES: Record<BrandedType, string> = { pdf: "report.pdf", xlsx: "report.xlsx", md: "report.md", digest: "digest.md" };
const SOURCE_FILES = ["report.html", "report.xlsx", "report.md", "digest.md", "audit.json"];
const SCRIPT = path.join(process.cwd(), "scripts", "brand_report.py");
const VERSION = 1;

const g = globalThis as unknown as { __auditpilotBranding?: Map<string, Promise<void>> };
const inflight: Map<string, Promise<void>> = (g.__auditpilotBranding ??= new Map());

export function brandedDir(id: string): string {
  return path.join(dataDir(), "branded", id);
}

function signature(folder: string): string {
  const parts = SOURCE_FILES.map((f) => {
    try {
      const st = fs.statSync(path.join(folder, f));
      return `${f}:${st.size}:${Math.round(st.mtimeMs)}`;
    } catch {
      return `${f}:-`;
    }
  });
  return JSON.stringify({ v: VERSION, brand: BRAND.name, prefix: ACTION_ID_PREFIX, parts });
}

function stampPath(id: string) {
  return path.join(brandedDir(id), ".stamp");
}

export function brandedReady(id: string): boolean {
  const folder = auditFolder(id);
  if (!folder) return false;
  try {
    return fs.readFileSync(stampPath(id), "utf8") === signature(folder);
  } catch {
    return false;
  }
}

export function isBuilding(id: string): boolean {
  return inflight.has(id);
}

/** Build (or reuse) the branded copies. Concurrent callers share one build. */
export function ensureBranded(id: string): Promise<void> {
  if (brandedReady(id)) return Promise.resolve();
  const existing = inflight.get(id);
  if (existing) return existing;
  const folder = auditFolder(id);
  if (!folder) return Promise.reject(Object.assign(new Error("Audit not found."), { status: 404 }));
  const out = brandedDir(id);
  const p = (async () => {
    ensureDir(out);
    const sig = signature(folder);
    // Start clean so a stale copy can never be served for a format that now fails.
    for (const f of [...Object.values(BRANDED_FILES), ".errors.json", ".stamp"]) fs.rmSync(path.join(out, f), { force: true });
    await run(enginePython(), [SCRIPT, "--src", folder, "--out", out, "--name", BRAND.name, "--prefix", ACTION_ID_PREFIX.replace(/-$/, ""), "--formats", "pdf,xlsx,md,digest"], {
      cwd: process.cwd(),
      timeout: 5 * 60_000,
      maxBuffer: 4 * 1024 * 1024,
      env: { PATH: process.env.PATH ?? "/usr/bin:/bin", HOME: process.env.HOME ?? "", LANG: "C.UTF-8", PYTHONPATH: engineDir() } as unknown as NodeJS.ProcessEnv,
    }).catch((e: Error & { code?: number }) => {
      // Exit code 3 = some formats failed; the others were written and are usable.
      if (e.code !== 3) throw e;
    });
    fs.writeFileSync(stampPath(id), sig);
  })().finally(() => inflight.delete(id));
  inflight.set(id, p);
  return p;
}

/** Fire-and-forget pre-build, e.g. right after an audit completes. Errors are logged only. */
export function prebuildBranded(id: string): void {
  if ((process.env.AUDITPILOT_BRANDED_PREBUILD ?? process.env.RANKORA_BRANDED_PREBUILD) === "0") return; // e.g. in tests; downloads still build on demand
  ensureBranded(id).catch((e) => console.error("[auditpilot] branded reports failed for", id, (e as Error).message));
}

/** Formats whose branded copy failed in the last build (with the reason). */
export function brandedErrors(id: string): Partial<Record<BrandedType, string>> {
  try {
    return JSON.parse(fs.readFileSync(path.join(brandedDir(id), ".errors.json"), "utf8"));
  } catch {
    return {};
  }
}

export function brandedFile(id: string, type: BrandedType): string | null {
  const file = path.join(brandedDir(id), BRANDED_FILES[type]);
  return fs.existsSync(file) ? file : null;
}
