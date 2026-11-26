import "server-only";
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { ensureDir, reportsDir } from "./config";
import { isValidAuditId } from "./paths";
import { readState } from "./state";

const run = promisify(execFile);

/**
 * Seed audits: real audits of your own sites that ship with AuditPilot (seed/<audit id>.tar.xz).
 * On server start each one is unpacked into the reports folder unless it is already there or
 * was removed from history. Existing folders are never overwritten.
 */
export const SEED_DIR = path.join(process.cwd(), "seed");

export function seedArchives(): Array<{ id: string; file: string }> {
  let names: string[];
  try {
    names = fs.readdirSync(SEED_DIR);
  } catch {
    return [];
  }
  return names
    .filter((n) => n.endsWith(".tar.xz"))
    .map((n) => ({ id: n.slice(0, -".tar.xz".length), file: path.join(SEED_DIR, n) }))
    .filter((s) => isValidAuditId(s.id));
}

export async function importSeeds(): Promise<string[]> {
  if ((process.env.AUDITPILOT_SEEDS ?? process.env.RANKORA_SEEDS) === "0") return [];
  const root = reportsDir();
  const hidden = readState().hidden;
  const imported: string[] = [];
  for (const s of seedArchives()) {
    if (hidden[s.id] || fs.existsSync(path.join(root, s.id))) continue;
    ensureDir(root, 0o755);
    // Unpack into a temporary folder first, then move into place, so a half-extracted seed
    // never appears as an audit.
    const tmp = fs.mkdtempSync(path.join(root, `.seed-${s.id}-`));
    try {
      await run("tar", ["-xJf", s.file, "-C", tmp, "--no-same-owner", "--no-overwrite-dir"], { timeout: 120_000 });
      const src = path.join(tmp, s.id);
      if (!fs.existsSync(path.join(src, "audit.json"))) throw new Error("archive has no audit.json");
      fs.renameSync(src, path.join(root, s.id));
      imported.push(s.id);
    } catch (e) {
      console.error("[auditpilot] seed import failed", s.id, (e as Error).message);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }
  if (imported.length) console.log(`[auditpilot] added ${imported.length} seed audit(s): ${imported.join(", ")}`);
  return imported;
}
