/**
 * Parses the engine's stderr progress log into structured events.
 *
 * The engine prints lines like (see lib/engine-protocol.ts for the exact format):
 *   [<engine> 01:23] == 4/7 <AI> judgments: 12 pages, budget $0.25
 *   [<engine> 00:41] crawled 30/60 URLs, 12 queued
 * Stage boundaries and counters below are read from those real lines; nothing is estimated.
 * Shared by the server (SSE) and the browser (rendering).
 */

import { ENGINE_AI_COUNTER, ENGINE_LOG_LINE } from "./engine-protocol";

export const STAGES = ["Crawl", "Rule checks", "DataForSEO", "AI judgments", "PageSpeed", "Scoring", "Render"] as const;
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
  kind: "pages" | "ai" | "pagespeed";
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

const LINE = ENGINE_LOG_LINE;
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
    c = msg.match(ENGINE_AI_COUNTER);
    if (c) ev.counter = { kind: "ai", current: +c[1], total: +c[2] };
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
  /** Warnings and notices folded into one actionable item per cause */
  notices: Notice[];
}

export interface Notice {
  key: string;
  level: "error" | "warning" | "info";
  title: string;
  detail?: string;
  count: number;
  items: string[];
  fix?: { label: string; href: string };
}

const PSI_LINE = /^PageSpeed (\d+)\/(\d+): (\w+) (\S+) \((.+)\)$/;

/** Group raw warnings/errors by cause so the same problem is reported once, with its fix. */
export function groupNotices(events: AuditEvent[]): Notice[] {
  const out = new Map<string, Notice>();
  const add = (n: Omit<Notice, "count" | "items">, item?: string) => {
    const cur = out.get(n.key) ?? { ...n, count: 0, items: [] };
    cur.count++;
    if (item && cur.items.length < 50) cur.items.push(item);
    out.set(n.key, cur);
  };
  let psiTotal = 0;
  for (const e of events) {
    const psi = e.message.match(PSI_LINE);
    if (psi) psiTotal = Math.max(psiTotal, Number(psi[2]));
    if (e.kind !== "warning" && e.kind !== "error") continue;
    const m = e.message;
    if (psi && /429/.test(psi[5])) {
      add({ key: "psi-429", level: "warning", title: "PageSpeed requests were rate limited by Google (HTTP 429)", detail: "Without an API key Google shares a tiny quota across all users. A free key fixes this.", fix: { label: "Add PageSpeed key", href: "/settings" } }, `${psi[3]} ${psi[4]}`);
    } else if (psi) {
      add({ key: "psi-failed", level: "warning", title: "Some PageSpeed requests failed", detail: "Those pages have no lab or field metrics in this audit." }, `${psi[3]} ${psi[4]}: ${psi[5]}`);
    } else if (/runs succeeded/.test(m)) {
      continue; // summary line; the per-request lines above already carry the detail
    } else if (/TYPESAFE_API_KEY not found/.test(m)) {
      add({ key: "ai-off", level: "info", title: "AI judgments were off (no TYPESAFE_API_KEY)", detail: "Content quality and E-E-A-T judgments need the key; the rest of the audit is complete.", fix: { label: "Add AI key", href: "/settings" } });
    } else if (/DATAFORSEO_USERNAME or DATAFORSEO_PASSWORD not found/.test(m)) {
      add({ key: "dfs-off", level: "info", title: "Rankings and backlinks were off (no DataForSEO login)", fix: { label: "Add DataForSEO login", href: "/settings" } });
    } else {
      add({ key: `${e.kind}:${m.slice(0, 80)}`, level: e.kind === "error" ? "error" : "warning", title: m });
    }
  }
  const psi = out.get("psi-429");
  if (psi && psiTotal) psi.title = `${psi.count} of ${psiTotal} PageSpeed requests were rate limited by Google (HTTP 429)`;
  const rank = { error: 0, warning: 1, info: 2 };
  return [...out.values()].sort((a, b) => rank[a.level] - rank[b.level] || b.count - a.count);
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
      // e.g. "TYPESAFE_API_KEY not found: ... judgments skipped" — the engine ran the stage as a no-op
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
    notices: groupNotices(events),
  };
}
