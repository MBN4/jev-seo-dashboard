import { describe, expect, it } from "vitest";
import { fixtureAudit } from "../helpers";
import { aiStageArgs, migrateOptionKeys, normalizeAudit } from "@/lib/server/engine-adapter";

describe("engine adapter", () => {
  it("translates engine naming into Rankora's model without leaving the upstream name", () => {
    const raw = fixtureAudit();
    raw.jev = { available: false, skipped: "Jev judgments skipped", site: null, pages: {}, pairs: [], ledger: {}, questions: {} };
    raw.scores.completeness = { ...raw.scores.completeness, jev: false, jev_pages_not_judged: 2 };
    raw.findings.push({ id: "jev_helpfulness", origin: "jev", category: "content", severity: "high", title: "Pages Jev would rewrite", fix: "Jev's editorial judgment", evidence: "Jev helpfulness 0.2", effort: 2, urls: [], count: 0 });
    raw.actions.push({ ...raw.findings.at(-1), action_id: "JEV-012", priority: "P1", impact: 50, quick_win: false, importance: null, needs_review: 0 });
    raw.run.options = { ...raw.run.options, no_jev: true };
    const a = normalizeAudit(raw);
    expect(a.ai.skipped).toBe("AI judgments skipped");
    expect(a.scores.completeness).toMatchObject({ ai: false, ai_pages_not_judged: 2 });
    const f = a.findings.at(-1)!;
    expect(f).toMatchObject({ id: "ai_helpfulness", origin: "ai", title: "Pages AI would rewrite", fix: "the AI's editorial judgment" });
    expect(a.actions.at(-1)!.action_id).toBe("RK-012");
    expect(a.actions.every((x) => x.action_id.startsWith("RK-"))).toBe(true);
    expect(a.run.options?.ai).toBe(false);
    expect(a.tool.name).toBe("audit-engine");
    expect(JSON.stringify({ ...a, pages: [] })).not.toMatch(/jev/i);
  });

  it("maps Rankora AI options to engine flags", () => {
    expect(aiStageArgs({ ai: true, aiPages: 30, aiBudget: 0.5 })).toEqual(["--jev-pages", "30", "--jev-budget", "0.5"]);
    expect(aiStageArgs({ ai: false, aiPages: 30, aiBudget: 0.5 })).toEqual(["--no-jev"]);
  });

  it("migrates option names saved before the rename", () => {
    expect(migrateOptionKeys({ jev: false, jevPages: 10, jevBudget: 0.1, maxPages: 5 })).toEqual({ ai: false, aiPages: 10, aiBudget: 0.1, maxPages: 5 });
  });
});
