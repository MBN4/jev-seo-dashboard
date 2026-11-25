import "server-only";
import { CHECKLIST, MANUAL_REASON, type ChecklistItem, type ItemStatus } from "@/lib/google-checklist";
import { runExtraChecks } from "./extra-checks";
import { requireAudit } from "./results";
import { readState } from "./state";
import type { EngineAudit, Severity } from "@/types/engine";

/**
 * Grades every Google checklist item for one audit from real results:
 * an engine/extra/AI/PageSpeed/DataForSEO finding -> fail, a check that ran clean -> pass,
 * a check whose data source was unavailable -> not checked (with the reason).
 */

export interface GradedItem extends ChecklistItem {
  status: ItemStatus;
  severity: Severity | null;
  reason: string | null;
  evidence: string | null;
  fix: string | null;
  urls: string[];
  urlCount: number;
  /** Where the details live in the UI */
  link: "technical" | "extra" | "ai" | "performance" | null;
}

export interface GradedSection {
  key: string;
  title: string;
  summary: string;
  doc: string;
  items: GradedItem[];
  counts: Record<ItemStatus, number>;
  /** passed / (passed + failed); null when nothing could be checked */
  score: number | null;
}

export interface Checklist {
  sections: GradedSection[];
  totals: Record<ItemStatus, number> & { checked: number; total: number };
  score: number | null;
  topFailures: GradedItem[];
}

const SEV_RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

export function gradeChecklist(audit: EngineAudit, keywords: string[] = []): Checklist {
  const findings = new Map(audit.findings.map((f) => [f.id, f]));
  const passedRules = new Set(audit.passed_rules ?? []);
  const extra = runExtraChecks(audit, keywords);
  const extraFindings = new Map(extra.findings.map((f) => [f.id, f]));
  const extraPassed = new Set(extra.passed);
  const extraSkipped = new Map(extra.skipped.map((s) => [s.id, s.reason]));
  const aiOn = Boolean(audit.ai?.available);
  const psiRuns = audit.performance?.runs ?? [];
  const psiOk = psiRuns.some((r) => !r.error && r.strategy === "mobile");
  const psi429 = psiRuns.some((r) => /429/.test(r.error ?? ""));
  const dfsOn = Boolean((audit.dataforseo as { available?: boolean } | null)?.available);

  const grade = (item: ChecklistItem): GradedItem => {
    const base = { ...item, severity: null, reason: null, evidence: null, fix: null, urls: [] as string[], urlCount: 0 };
    if (item.source === "manual") return { ...base, status: "manual", reason: MANUAL_REASON, link: null };
    if (item.source === "extra") {
      const f = extraFindings.get(item.id);
      if (f) return { ...base, status: f.severity === "info" ? "note" : "fail", severity: f.severity, evidence: f.evidence, fix: f.fix, urls: f.urls.slice(0, 20), urlCount: f.count, link: "extra" };
      if (extraSkipped.has(item.id)) return { ...base, status: "not_checked", reason: "Add focus keywords on the Extra Checks tab to run this.", link: "extra" };
      return { ...base, status: extraPassed.has(item.id) ? "pass" : "not_checked", link: "extra" };
    }
    const f = findings.get(item.id);
    const link = item.source === "ai" ? "ai" : item.source === "pagespeed" ? "performance" : "technical";
    if (f) return { ...base, status: f.severity === "info" ? "note" : "fail", severity: f.severity, evidence: f.evidence, fix: f.fix, urls: f.urls.slice(0, 20), urlCount: f.count, link };
    if (item.source === "ai" && !aiOn) return { ...base, status: "not_checked", reason: "Needs AI judgments (add TYPESAFE_API_KEY in Settings).", link: "ai" };
    if (item.source === "pagespeed" && !psiOk) {
      return { ...base, status: "not_checked", reason: psi429 ? "PageSpeed was rate limited (HTTP 429). Add a free PAGESPEED_API_KEY." : "PageSpeed did not run for this audit.", link: "performance" };
    }
    if (item.source === "dataforseo" && !dfsOn) return { ...base, status: "not_checked", reason: "Needs DataForSEO full mode (paid).", link: null };
    if (item.source === "rule" && !passedRules.has(item.id)) return { ...base, status: "not_checked", reason: "This check did not run in this audit.", link };
    return { ...base, status: "pass", link };
  };

  const sections: GradedSection[] = CHECKLIST.map((s) => {
    const items = s.items.map(grade);
    const counts = { pass: 0, fail: 0, note: 0, not_checked: 0, manual: 0 } as Record<ItemStatus, number>;
    items.forEach((it) => counts[it.status]++);
    const denom = counts.pass + counts.fail;
    return { key: s.key, title: s.title, summary: s.summary, doc: s.doc, items, counts, score: denom ? Math.round((counts.pass / denom) * 100) : null };
  });
  const totals = { pass: 0, fail: 0, note: 0, not_checked: 0, manual: 0, checked: 0, total: 0 };
  for (const s of sections) for (const k of Object.keys(s.counts) as ItemStatus[]) totals[k] += s.counts[k];
  totals.checked = totals.pass + totals.fail + totals.note;
  totals.total = sections.reduce((a, s) => a + s.items.length, 0);
  const topFailures = sections
    .flatMap((s) => s.items)
    .filter((i) => i.status === "fail")
    .sort((a, b) => SEV_RANK[a.severity ?? "info"] - SEV_RANK[b.severity ?? "info"] || b.urlCount - a.urlCount)
    .slice(0, 5);
  const denom = totals.pass + totals.fail;
  return { sections, totals, score: denom ? Math.round((totals.pass / denom) * 100) : null, topFailures };
}

export function checklistFor(id: string): Checklist {
  return gradeChecklist(requireAudit(id), readState().keywords[id] ?? []);
}
