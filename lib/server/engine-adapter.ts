import "server-only";
import { ACTION_ID_PREFIX, AI_ID_PREFIX, ENGINE_AI_FLAGS, RAW } from "@/lib/engine-protocol";
import { neutralEngineText } from "@/lib/brand";
import type { AuditOptions } from "@/lib/schemas";
import type { EngineAudit } from "@/types/engine";

/**
 * Translates the audit engine's raw audit.json into Rankora's model, in memory.
 * audit.json on disk is never modified.
 *
 * - The AI-judgment block and its completeness flags get Rankora names (`ai`).
 * - AI check ids (`<engine>_helpfulness`) become `ai_helpfulness`; origin becomes "ai".
 * - Action ids become `RK-001`.
 * - Engine-written explanations are reworded so the upstream name never appears.
 */

type Raw = Record<string, unknown> & {
  findings: Array<Record<string, unknown>>;
  actions: Array<Record<string, unknown>>;
  scores: Record<string, unknown> & { completeness?: Record<string, unknown>; partial?: string[]; caps?: string[]; notes?: Record<string, string> };
  run: Record<string, unknown> & { options?: Record<string, unknown> };
  tool?: { name?: string; version?: string };
};

export function aiId(id: string): string {
  return id.startsWith(RAW.aiIdPrefix) ? AI_ID_PREFIX + id.slice(RAW.aiIdPrefix.length) : id;
}

export function actionId(id: string): string {
  return id.startsWith(RAW.actionIdPrefix) ? ACTION_ID_PREFIX + id.slice(RAW.actionIdPrefix.length) : id;
}

const text = (t: unknown) => (typeof t === "string" ? neutralEngineText(t).replace(new RegExp(`\\b${RAW.actionIdPrefix}(\\d+)`, "g"), `${ACTION_ID_PREFIX}$1`) : t);

export function normalizeAudit(raw: Raw): EngineAudit {
  const a = raw as Raw & Record<string, unknown>;
  // AI block
  if (RAW.aiKey in a) {
    a.ai = a[RAW.aiKey];
    delete a[RAW.aiKey];
  }
  const ai = a.ai as { skipped?: string; ledger?: Record<string, unknown> } | undefined;
  if (ai?.skipped) ai.skipped = neutralEngineText(ai.skipped);
  if (ai?.ledger) {
    for (const k of ["model_requested", "model_returned"]) {
      const v = ai.ledger[k];
      if (typeof v === "string") ai.ledger[k] = v.replace(new RegExp(`^${RAW.aiKey}`, "i"), "ai-model");
    }
  }
  // stage timings
  const timings = a.run?.timings_s as Record<string, unknown> | undefined;
  if (timings && RAW.aiKey in timings) {
    timings.ai = timings[RAW.aiKey];
    delete timings[RAW.aiKey];
  }
  // completeness flags
  const c = a.scores?.completeness;
  if (c && RAW.aiCompleteness in c) {
    c.ai = c[RAW.aiCompleteness];
    delete c[RAW.aiCompleteness];
  }
  if (c && RAW.aiNotJudged in c) {
    c.ai_pages_not_judged = c[RAW.aiNotJudged];
    delete c[RAW.aiNotJudged];
  }
  // findings and actions
  for (const f of [...(a.findings ?? []), ...(a.actions ?? [])]) {
    if (f.origin === RAW.aiOrigin) f.origin = "ai";
    if (typeof f.id === "string") f.id = aiId(f.id);
    if (typeof f.action_id === "string") f.action_id = actionId(f.action_id);
    f.title = text(f.title);
    f.fix = text(f.fix);
    f.evidence = text(f.evidence);
  }
  // passed rules can include AI ids
  if (Array.isArray(a.passed_rules)) a.passed_rules = (a.passed_rules as string[]).map(aiId);
  // score explanations
  if (a.scores) {
    a.scores.partial = a.scores.partial?.map((t) => neutralEngineText(t));
    a.scores.caps = a.scores.caps?.map((t) => neutralEngineText(t));
    if (a.scores.notes) for (const k of Object.keys(a.scores.notes)) a.scores.notes[k] = neutralEngineText(a.scores.notes[k]);
  }
  // run options: expose Rankora option names alongside the raw ones
  const o = a.run?.options;
  if (o) {
    if (RAW.aiOffOption in o) {
      o.ai = !o[RAW.aiOffOption];
      delete o[RAW.aiOffOption];
    }
    for (const k of Object.keys(o)) {
      if (k.startsWith(RAW.aiIdPrefix)) {
        o[AI_ID_PREFIX + k.slice(RAW.aiIdPrefix.length)] = o[k];
        delete o[k];
      }
    }
  }
  if (a.tool) a.tool = { ...a.tool, name: "audit-engine" };
  return a as unknown as EngineAudit;
}

/** CLI arguments for the AI stage from Rankora options. */
export function aiStageArgs(o: Pick<AuditOptions, "ai" | "aiPages" | "aiBudget">): string[] {
  return o.ai ? [ENGINE_AI_FLAGS.pages, String(o.aiPages), ENGINE_AI_FLAGS.budget, String(o.aiBudget)] : [ENGINE_AI_FLAGS.off];
}

/**
 * Older saved options (dashboard state, job records) used the engine's names for the AI stage.
 * Map them to Rankora's so nothing saved before the rename is lost.
 */
export function migrateOptionKeys<T extends Record<string, unknown>>(o: T | null | undefined): T | null | undefined {
  if (!o) return o;
  const m: Record<string, unknown> = { ...o };
  for (const [from, to] of [
    ["jev", "ai"],
    ["jevPages", "aiPages"],
    ["jevBudget", "aiBudget"],
  ] as const) {
    if (from in m) {
      if (!(to in m)) m[to] = m[from];
      delete m[from];
    }
  }
  return m as T;
}
