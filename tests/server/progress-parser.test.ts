import { describe, expect, it } from "vitest";
import { parseEngineLog, summarizeProgress } from "@/lib/progress";

const LOG = `[jevseo 00:00] Auditing https://example.com: up to 60 pages.
[jevseo 00:00] == 1/7 Crawl: robots.txt, sitemaps, then pages
[jevseo 00:05] crawled 30/60 URLs, 12 queued
[jevseo 00:20] crawled 60/60 URLs, 0 queued
[jevseo 00:21] == 2/7 Rule checks
[jevseo 00:21] 12 rule findings from 52 rules
[jevseo 00:21] == 3/7 DataForSEO: skipped (add --full for rankings, keywords and backlinks)
[jevseo 00:21] == 4/7 Jev judgments: 20 pages, budget $0.25
[jevseo 00:30] Jev: 10/20 pages judged, $0.0040 so far
`;

describe("engine log parser", () => {
  it("extracts stages, counters and skipped stages from real engine lines", () => {
    const ev = parseEngineLog(LOG);
    expect(ev.filter((e) => e.kind === "stage").map((e) => e.stage)).toEqual([1, 2, 3, 4]);
    expect(ev.find((e) => e.stage === 3 && e.kind === "stage")?.skipped).toBe(true);
    const crawl = ev.filter((e) => e.counter?.kind === "pages").at(-1);
    expect(crawl?.counter).toEqual({ kind: "pages", current: 60, total: 60, totalIsCap: true });
    const p = summarizeProgress(ev, "running");
    expect(p.stages.map((s) => s.state)).toEqual(["done", "done", "skipped", "active", "pending", "pending", "pending"]);
    expect(p.currentStage).toBe(4);
    expect(p.completedStages).toBe(3);
    expect(p.pagesCrawled).toBe(60);
    expect(p.stages[3].counter).toEqual({ kind: "jev", current: 10, total: 20 });
  });

  it("marks a stage skipped when the engine reports a missing key", () => {
    const ev = parseEngineLog(`[jevseo 00:01] == 4/7 Jev judgments: 5 pages, budget $0.25
[jevseo 00:01] TYPESAFE_API_KEY not found: Jev judgments skipped; semantic sections will be marked not assessed.
[jevseo 00:02] == 5/7 PageSpeed: 1 pages`);
    const p = summarizeProgress(ev, "running");
    expect(p.stages[3].state).toBe("skipped");
    expect(p.warnings).toHaveLength(1);
  });

  it("flags rate limits as warnings and tracebacks as errors", () => {
    const ev = parseEngineLog(`[jevseo 00:02] PageSpeed 1/2: mobile https://x/ (HTTP 429)
[jevseo 00:02] PageSpeed Insights: 0/2 runs succeeded
Traceback (most recent call last):
  File "x.py", line 1
ModuleNotFoundError: No module named 'matplotlib'`);
    const p = summarizeProgress(ev, "failed");
    expect(p.warnings.map((w) => w.message)).toHaveLength(2);
    expect(p.errors.length).toBeGreaterThanOrEqual(3);
  });

  it("never reports progress beyond what the engine logged", () => {
    const p = summarizeProgress(parseEngineLog("[jevseo 00:00] == 1/7 Crawl"), "failed");
    expect(p.stages[0].state).toBe("failed");
    expect(p.completedStages).toBe(0);
    expect(p.currentStage).toBeNull();
  });

  it("finishes all active stages on completion", () => {
    const p = summarizeProgress(parseEngineLog("[jevseo 00:00] == 7/7 Render: pdf"), "completed");
    expect(p.stages[6].state).toBe("done");
  });
});
