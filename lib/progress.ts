/**
 * Parses the engine's stderr progress log into structured events.
 *
 * The engine (jevseo/cli.py) prints lines like:
 *   [jevseo 01:23] == 4/7 Jev judgments: 12 pages, budget $0.25
 *   [jevseo 00:41] crawled 30/60 URLs, 12 queued
 * Stage boundaries and counters below are read from those real lines; nothing is estimated.
 * Shared by the server (SSE) and the browser (rendering).
 */

export const STAGES = ["Crawl", "Rule checks", "DataForSEO", "Jev judgments", "PageSpeed", "Scoring", "Render"] as const;
export const STAGE_LABELS = [
  "Website crawling",
  "SEO rule checks",
  "DataForSEO",
  "AI judgments",
  "PageSpeed Insights",
  "Scoring",
  "Report generation",
] as const;

export type EventKind = "status" | "stage" | "log" | "warning" | "error";

export interface Counter {
  kind: "pages" | "jev" | "pagespeed";
  current: number;
  total: number;
  /** true when total is a cap (e.g. max pages), not a known amount of work */
  totalIsCap?: boolean;
}

export interface AuditEvent {
  seq: number;
  kind: EventKind;
  /** engine elapsed time "mm:ss" when present */
  elapsed?: string;
  /** 1-based stage index when the line belongs to (or starts) a stage */
  stage?: number;
  message: string;
  counter?: Counter;
  skipped?: boolean;
  at?: string;
}

const LINE = /^\[jevseo (\d{2,}:\d{2})\] (.*)$/;
const STAGE_LINE = /^== (\d)\/(\d) ([^:]+?)(?:: (.*))?$/;

export function parseEngineLog(text: string): AuditEvent[] {
  const events: AuditEvent[] = [];
  let stage: number | undefined;
  let seq = 0;
  let inTraceback = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    const m = line.match(LINE);
    if (!m) {
      // Python traceback or other unprefixed output
      if (line.startsWith("Traceback")) inTraceback = true;
      const isErr = inTraceback || /error|exception|refusing|denied/i.test(line);
      events.push({ seq: seq++, kind: isErr ? "error" : "log", stage, message: line });
      continue;
    }
    inTraceback = false;
    const [, elapsed, msg] = m;
    const s = msg.match(STAGE_LINE);
    if (s) {
      stage = Number(s[1]);
      const detail = s[4] ?? "";
      events.push({ seq: seq++, kind: "stage", elapsed, stage, message: detail ? `${s[3]}: ${detail}` : s[3], skipped: /^skipped/i.test(detail) });
      continue;
    }
    const ev: AuditEvent = { seq: seq++, kind: "log", elapsed, stage, message: msg };
    let c = msg.match(/^crawled (\d+)\/(\d+) URLs/);
    if (c) ev.counter = { kind: "pages", current: +c[1], total: +c[2], totalIsCap: true };
    c = msg.match(/^Jev: (\d+)\/(\d+) pages judged/);
    if (c) ev.counter = { kind: "jev", current: +c[1], total: +c[2] };
    c = msg.match(/^PageSpeed (\d+)\/(\d+):/);
    if (c) ev.counter = { kind: "pagespeed", current: +c[1], total: +c[2] };
    if (/WARNING|HTTP 429|rate limit|not found:|failed(?! 0)|unreachable|timeout/i.test(msg) && !/0 failed$/.test(msg)) ev.kind = "warning";
    if (/: 0\/\d+ runs succeeded/.test(msg)) ev.kind = "warning";
    if (/^Refusing|^Traceback|Error:/.test(msg)) ev.kind = "error";
    events.push(ev);
  }
  return events;
}

export type StageState = "pending" | "active" | "done" | "skipped" | "failed";

export interface StageView {
  index: number;
  key: (typeof STAGES)[number];
  label: string;
  state: StageState;
  detail?: string;
  counter?: Counter;
  startedAt?: string;
}

export interface ProgressView {
  stages: StageView[];
  currentStage: number | null;
  completedStages: number;
  lastMessage: string | null;
  pagesCrawled: number | null;
  warnings: AuditEvent[];
  errors: AuditEvent[];
}

/** Derive per-stage state from parsed events and the job's final status. */
export function summarizeProgress(events: AuditEvent[], status: string): ProgressView {
  const stages: StageView[] = STAGES.map((key, i) => ({ index: i + 1, key, label: STAGE_LABELS[i], state: "pending" }));
  let current: number | null = null;
  let pagesCrawled: number | null = null;
  for (const ev of events) {
    if (ev.kind === "stage" && ev.stage) {
      for (const st of stages) if (st.index < ev.stage && st.state === "active") st.state = "done";
      // A stage that the engine later reported as skipped keeps that state.
      const st = stages[ev.stage - 1];
      st.state = ev.skipped ? "skipped" : "active";
      st.detail = ev.message;
      st.startedAt = ev.elapsed;
      current = ev.stage;
    } else if (ev.stage && /not found: .*skipped/i.test(ev.message)) {
      // e.g. "TYPESAFE_API_KEY not found: Jev judgments skipped; ..." — the engine ran the stage as a no-op
      const st = stages[ev.stage - 1];
      st.state = "skipped";
      st.detail = ev.message;
    } else if (ev.counter && ev.stage) {
      stages[ev.stage - 1].counter = ev.counter;
      if (ev.counter.kind === "pages") pagesCrawled = ev.counter.current;
    }
  }
  const terminal = ["completed", "failed", "cancelled", "interrupted"].includes(status);
  if (status === "completed") {
    for (const st of stages) if (st.state === "active") st.state = "done";
  } else if (terminal && current) {
    const st = stages[current - 1];
    if (st.state === "active") st.state = "failed";
  }
  const lastLog = [...events].reverse().find((e) => e.kind !== "stage" || !e.skipped);
  return {
    stages,
    currentStage: terminal ? null : current,
    completedStages: stages.filter((s) => s.state === "done" || s.state === "skipped").length,
    lastMessage: lastLog?.message ?? null,
    pagesCrawled,
    warnings: events.filter((e) => e.kind === "warning"),
    errors: events.filter((e) => e.kind === "error"),
  };
}
