import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeSandbox, waitFor } from "../helpers";
import { cancelJob, engineArgs, newAuditId, readJob, refreshJob, runningJobs, startJob } from "@/lib/server/jobs";
import { DEFAULT_AUDIT_OPTIONS } from "@/lib/schemas";
import { progressSnapshot } from "@/lib/server/progress";

let sb: ReturnType<typeof makeSandbox>;
beforeAll(() => (sb = makeSandbox()));
afterAll(() => sb.cleanup());

describe("engine argument building", () => {
  it("maps every option to a real jevseo flag as separate argv entries", () => {
    const args = engineArgs("https://example.com/", "/out/x", { ...DEFAULT_AUDIT_OPTIONS, jev: false, psi: true, full: true, formats: ["pdf"] });
    expect(args.slice(0, 6)).toEqual(["-m", "jevseo", "run", "https://example.com/", "--out", "/out/x"]);
    expect(args).toContain("--no-jev");
    expect(args).toContain("--full");
    expect(args).toContain("--dfs-budget");
    expect(args).not.toContain("--no-psi");
    expect(args[args.indexOf("--formats") + 1]).toBe("pdf");
  });

  it("never reuses an existing report folder name", () => {
    const now = new Date(2026, 0, 2, 3, 4);
    const id = newAuditId("https://www.example.com/", now);
    expect(id).toBe("example.com-2026-01-02-0304");
    fs.mkdirSync(path.join(sb.reports, id));
    expect(newAuditId("https://www.example.com/", now)).toBe("example.com-2026-01-02-0304-2");
  });
});

describe("audit jobs", () => {
  it("runs the engine, streams progress and completes", async () => {
    const job = startJob("https://ok.example.org/", "ok.example.org", { ...DEFAULT_AUDIT_OPTIONS, maxPages: 5 });
    expect(job.status).toBe("running");
    await waitFor(() => readJob(job.id)?.status === "completed");
    const snap = progressSnapshot(job.id)!;
    expect(snap.status).toBe("completed");
    expect(snap.progress!.stages.map((s) => s.state)).toEqual(["done", "done", "skipped", "skipped", "done", "done", "done"]);
    expect(snap.progress!.warnings.some((w) => w.message.includes("HTTP 429"))).toBe(true);
    // server paths are redacted before reaching the client
    expect(JSON.stringify(snap)).not.toContain(sb.reports);
    expect(fs.existsSync(path.join(sb.reports, job.id, "report.pdf"))).toBe(true);
  });

  it("records engine failures with the engine's message", async () => {
    const job = startJob("https://fail.example.org/", "fail.example.org", DEFAULT_AUDIT_OPTIONS);
    await waitFor(() => readJob(job.id)?.status === "failed");
    expect(readJob(job.id)!.error).toContain("Refusing to crawl");
  });

  it("rejects duplicates and enforces the concurrency limit, then cancels only that audit", async () => {
    const job = startJob("https://slow.example.org/", "slow.example.org", DEFAULT_AUDIT_OPTIONS);
    expect(() => startJob("https://slow.example.org/", "slow.example.org", DEFAULT_AUDIT_OPTIONS)).toThrow(/already running/);
    expect(() => startJob("https://other.example.org/", "other.example.org", DEFAULT_AUDIT_OPTIONS)).toThrow(/at once/);
    expect(runningJobs().map((j) => j.id)).toEqual([job.id]);
    cancelJob(job.id);
    await waitFor(() => readJob(job.id)?.status === "cancelled");
    expect(readJob(job.id)!.error).toBe("Cancelled by user.");
  });

  it("recovers jobs orphaned by a dashboard restart", () => {
    const id = "restart.example.org-2026-01-01-0000";
    const dir = path.join(sb.data, "jobs", id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "job.json"), JSON.stringify({ id, url: "https://restart.example.org/", domain: "restart.example.org", status: "running", options: DEFAULT_AUDIT_OPTIONS, pid: 999999, createdAt: "", startedAt: "", finishedAt: null, exitCode: null, signal: null, cancelRequested: false, error: null, note: null }));
    const j = refreshJob(id)!;
    expect(j.status).toBe("interrupted");
    expect(j.error).toMatch(/stopped unexpectedly/);
  });
});
