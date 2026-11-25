import { describe, expect, it } from "vitest";
import { fixtureAudit } from "../helpers";
import { normalizeAudit } from "@/lib/server/engine-adapter";
import { gradeChecklist } from "@/lib/server/checklist";
import { CHECKLIST } from "@/lib/google-checklist";

const audit = () => normalizeAudit(fixtureAudit());

describe("Google checklist", () => {
  it("lists every check exactly once", () => {
    const ids = CHECKLIST.flatMap((s) => s.items.map((i) => i.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("grades rules from the audit's own findings and passed rules", () => {
    const a = audit();
    const c = gradeChecklist(a);
    const items = new Map(c.sections.flatMap((s) => s.items).map((i) => [i.id, i]));
    for (const f of a.findings.filter((x) => x.origin === "rule" && x.severity !== "info")) {
      if (items.has(f.id)) expect(items.get(f.id)!.status, f.id).toBe("fail");
    }
    for (const id of a.passed_rules) if (items.has(id)) expect(items.get(id)!.status, id).toBe("pass");
    // the fixture ran without AI, PageSpeed results or DataForSEO: those are "not checked", never "pass"
    expect(items.get("ai_helpfulness")!.status).toBe("not_checked");
    expect(items.get("ai_helpfulness")!.reason).toMatch(/TYPESAFE_API_KEY/);
    expect(items.get("cwv_field")!.status).toBe("not_checked");
    expect(items.get("dfs_backlink_gap")!.status).toBe("not_checked");
    expect(items.get("kw_title")!.status).toBe("not_checked");
    expect(items.get("manual_cloaking")!.status).toBe("manual");
  });

  it("counts and scores consistently", () => {
    const c = gradeChecklist(audit());
    const sum = c.totals.pass + c.totals.fail + c.totals.note + c.totals.not_checked + c.totals.manual;
    expect(sum).toBe(c.totals.total);
    expect(c.score).toBe(Math.round((c.totals.pass / (c.totals.pass + c.totals.fail)) * 100));
    expect(c.topFailures.length).toBeLessThanOrEqual(5);
    expect(c.topFailures.every((f) => f.status === "fail")).toBe(true);
  });

  it("uses focus keywords when they are set", () => {
    const c = gradeChecklist(audit(), ["domains"]);
    const kw = c.sections.find((s) => s.key === "keywords")!;
    expect(kw.items.every((i) => i.status !== "not_checked")).toBe(true);
  });
});
