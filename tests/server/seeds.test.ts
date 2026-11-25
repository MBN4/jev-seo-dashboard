import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { installAudit, makeSandbox } from "../helpers";

let sb: ReturnType<typeof makeSandbox>;
const ID = "seeded.example.org-2026-01-01-0000";
let seedDir: string;

beforeAll(() => {
  sb = makeSandbox();
  // Build a seed archive from a fixture audit, in a fake app cwd.
  const staging = path.join(sb.root, "staging");
  installAudit(staging, ID);
  seedDir = path.join(sb.root, "app", "seed");
  fs.mkdirSync(seedDir, { recursive: true });
  execFileSync("tar", ["-cJf", path.join(seedDir, `${ID}.tar.xz`), "-C", staging, ID]);
  fs.writeFileSync(path.join(seedDir, "not-an-archive.txt"), "x");
});
afterAll(() => sb.cleanup());

describe("seed audits", () => {
  it("unpacks seeds once, never overwrites, and respects history removal", async () => {
    const cwd = process.cwd();
    process.chdir(path.join(sb.root, "app"));
    try {
      const { importSeeds } = await import("@/lib/server/seeds");
      expect(await importSeeds()).toEqual([ID]);
      const audit = path.join(sb.reports, ID, "audit.json");
      expect(fs.existsSync(audit)).toBe(true);
      // second start: already present, untouched
      fs.writeFileSync(path.join(sb.reports, ID, "marker"), "keep");
      expect(await importSeeds()).toEqual([]);
      expect(fs.readFileSync(path.join(sb.reports, ID, "marker"), "utf8")).toBe("keep");
      // removed from history and deleted from disk: not re-added
      const { updateState } = await import("@/lib/server/state");
      await updateState((s) => void (s.hidden[ID] = new Date().toISOString()));
      fs.rmSync(path.join(sb.reports, ID), { recursive: true });
      expect(await importSeeds()).toEqual([]);
      expect(fs.readdirSync(sb.reports).filter((n) => n.startsWith(".seed-"))).toEqual([]);
    } finally {
      process.chdir(cwd);
    }
  });
});
