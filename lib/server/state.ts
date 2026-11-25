import "server-only";
import fs from "node:fs";
import path from "node:path";
import { dataDir, ensureDir, stateFile } from "./config";
import { DEFAULT_AUDIT_OPTIONS, auditOptionsSchema, type AuditOptions } from "@/lib/schemas";
import { migrateOptionKeys } from "./engine-adapter";

/**
 * Dashboard-owned state, stored as one JSON file in the data directory.
 * It never holds audit results (those stay in the engine's report folders)
 * and never holds API secrets (those live in secrets.env, mode 600).
 */
export type RecommendationStatus = "pending" | "in_progress" | "completed";

export interface RecommendationState {
  status: RecommendationStatus;
  notes: string;
  updatedAt: string;
}

export interface AppState {
  version: 1;
  /** Audit IDs removed from the dashboard history. Report folders are left untouched. */
  hidden: Record<string, string>;
  /** auditId -> recommendation key (finding id) -> user workflow state */
  recommendations: Record<string, Record<string, RecommendationState>>;
  /** auditId -> focus keywords for the extra checks layer */
  keywords: Record<string, string[]>;
  defaults: AuditOptions;
  updatedAt: string;
}

function emptyState(): AppState {
  return { version: 1, hidden: {}, recommendations: {}, keywords: {}, defaults: { ...DEFAULT_AUDIT_OPTIONS }, updatedAt: new Date().toISOString() };
}

export function readState(): AppState {
  try {
    const raw = JSON.parse(fs.readFileSync(stateFile(), "utf8"));
    const base = emptyState();
    const defaults = auditOptionsSchema.safeParse({ ...base.defaults, ...(migrateOptionKeys(raw.defaults) ?? {}) });
    return {
      version: 1,
      hidden: typeof raw.hidden === "object" && raw.hidden ? raw.hidden : {},
      recommendations: typeof raw.recommendations === "object" && raw.recommendations ? raw.recommendations : {},
      keywords: typeof raw.keywords === "object" && raw.keywords ? raw.keywords : {},
      defaults: defaults.success ? defaults.data : base.defaults,
      updatedAt: raw.updatedAt ?? base.updatedAt,
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      // Corrupt file: keep a copy for the user, start fresh rather than crash.
      try {
        fs.copyFileSync(stateFile(), `${stateFile()}.corrupt-${Date.now()}`);
      } catch {
        /* ignore */
      }
    }
    return emptyState();
  }
}

function writeAtomic(file: string, content: string) {
  ensureDir(path.dirname(file));
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, content, { mode: 0o600 });
  fs.renameSync(tmp, file);
}

let chain: Promise<unknown> = Promise.resolve();

/** Serialised read-modify-write so concurrent requests never lose updates. */
export function updateState<T>(fn: (s: AppState) => T): Promise<T> {
  const next = chain.then(() => {
    const s = readState();
    const result = fn(s);
    s.updatedAt = new Date().toISOString();
    writeAtomic(stateFile(), JSON.stringify(s, null, 2));
    return result;
  });
  chain = next.catch(() => undefined);
  return next;
}

export function stateWritable(): { ok: boolean; detail: string } {
  try {
    ensureDir(dataDir());
    fs.accessSync(dataDir(), fs.constants.W_OK);
    return { ok: true, detail: "Writable" };
  } catch (err) {
    return { ok: false, detail: (err as Error).message };
  }
}

export { writeAtomic };
