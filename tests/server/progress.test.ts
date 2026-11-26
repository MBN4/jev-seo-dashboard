import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { installAudit, jsonReq, makeSandbox } from "../helpers";
import { buildProgress, progressMarkdown, type DayRecord, type IssueRecord } from "@/lib/issue-progress";
import { priorityOf } from "@/lib/priorities";
import type { EngineAudit } from "@/types/engine";

const issue = (id: string, urls: string[], over: Partial<IssueRecord> = {}): IssueRecord => ({
  id, title: id, severity: "high", source: "rule", tier: priorityOf(id).tier, owner: priorityOf(id).owner, count: urls.length, urls, intended: false, ...over,
});
const rec = (date: string, issues: IssueRecord[], score = 80): DayRecord => ({ version: 1, domain: "x.com", date, auditId: `x.com-${date}-0900`, finishedAt: `${date}T09:00:00Z`, score, grade: "B", pages: 10, issues });

describe("issue progress", () => {
  const records = [
    rec("2026-11-20", [issue("http_errors", ["/a", "/b"]), issue("title_duplicate", ["/c", "/d"]), issue("noindex", ["/p/2"], { intended: true }), issue("faq_rich_result_limited", ["/f"])], 80),
    rec("2026-11-21", [issue("http_errors", ["/b"]), issue("meta_missing", ["/e"])], 84),
    rec("2026-11-22", [issue("meta_missing", ["/e", "/g"]), issue("title_duplicate", ["/c"])], 88),
  ];
  const p = buildProgress("x.com", records);

  it("compares the latest report with the previous one", () => {
    expect(p.latest?.date).toBe("2026-11-22");
    expect(p.previous?.date).toBe("2026-11-21");
    expect(p.sinceLast!.fixed.map((f) => f.id)).toEqual(["http_errors"]);
    expect(p.sinceLast!.fixed[0]).toMatchObject({ fixedOn: "2026-11-22", daysOpen: 2, count: 1 });
    expect(p.sinceLast!.newIssues.map((i) => i.id)).toEqual(["title_duplicate"]);
    expect(p.sinceLast!.worse.map((i) => i.id)).toEqual(["meta_missing"]);
  });

  it("tracks how long each issue is open, reopenings and page-level changes", () => {
    const meta = p.open.find((i) => i.id === "meta_missing")!;
    expect(meta).toMatchObject({ since: "2026-11-21", daysOpen: 1, reportsOpen: 2, prevCount: 1, pagesNew: ["/g"], pagesFixed: [] });
    const dup = p.open.find((i) => i.id === "title_duplicate")!;
    expect(dup).toMatchObject({ reopened: true, since: "2026-11-22", daysOpen: 0 });
    expect(p.totals).toMatchObject({ fixedEver: 2, reopened: 1, scoreChange: 8 });
    expect(p.fixLog.map((f) => `${f.fixedOn}:${f.id}`)).toEqual(["2026-11-22:http_errors", "2026-11-21:title_duplicate"]);
  });

  it("leaves out intended and information-only findings, and orders by priority", () => {
    expect(p.intended).toEqual([]); // the latest report has none
    const first = buildProgress("x.com", records.slice(0, 1));
    expect(first.open.map((i) => i.id)).toEqual(["http_errors", "title_duplicate"]);
    expect(first.sinceLast).toBeNull();
    expect(first.intended.map((i) => i.id)).toEqual(["noindex"]);
    expect(p.open.map((i) => i.tier)).toEqual(["P2", "P2"]);
    expect(p.timeline.map((t) => [t.date, t.fixed, t.added])).toEqual([["2026-11-20", 0, 0], ["2026-11-21", 1, 1], ["2026-11-22", 1, 1]]);
  });

  it("writes a shareable report", () => {
    const md = progressMarkdown(p);
    expect(md).toContain("# SEO progress report: x.com");
    expect(md).toContain("- **Fixed:** 1 issue(s): Pages returning HTTP errors (P1)".replace("Pages returning HTTP errors", "http_errors"));
    expect(md).toMatch(/\| P2 \| meta_missing `meta_missing` \| Content \| 2 \| \+1 \| 1 day\(s\) \|/);
    expect(md).toContain("2026-11-21: title_duplicate");
  });
});

describe("daily history storage", () => {
  let sb: ReturnType<typeof makeSandbox>;
  const D = "mycoldinbox.com";
  const audit = (id: string, finished: string, mutate: (a: EngineAudit) => void = () => undefined) =>
    installAudit(sb.reports, id, (a) => {
      a.site = { ...a.site, domain: D, final_url: "https://mycoldinbox.com/" };
      a.run = { ...a.run, started_at: finished, finished_at: finished };
      mutate(a as EngineAudit);
    });
  beforeAll(() => {
    sb = makeSandbox();
  });
  afterAll(() => sb.cleanup());

  it("backfills existing audits, keeps one record per day, and serves progress and the report", async () => {
    const { backfillHistory } = await import("@/lib/server/monitor");
    const { listAudits } = await import("@/lib/server/audits");
    const { readRecords } = await import("@/lib/server/history");
    audit("mycoldinbox.com-2026-11-24-0800", "2026-11-24T08:00:00+00:00");
    audit("mycoldinbox.com-2026-11-25-0800", "2026-11-25T08:00:00+00:00", (a) => void (a.findings = a.findings.slice(2)));
    audit("mycoldinbox.com-2026-11-25-1800", "2026-11-25T18:00:00+00:00", (a) => void (a.findings = a.findings.slice(3)));
    expect(backfillHistory(listAudits({ includeHidden: true }), 10)).toBe(3);
    const recs = readRecords(D);
    expect(recs.map((r) => r.date)).toEqual(["2026-11-24", "2026-11-25"]);
    expect(recs[1].auditId).toBe("mycoldinbox.com-2026-11-25-1800"); // the later audit of the day wins
    expect(backfillHistory(listAudits({ includeHidden: true }), 10)).toBe(0); // the replaced 08:00 audit is remembered, not reloaded
    expect(readRecords(D)[1].auditId).toBe("mycoldinbox.com-2026-11-25-1800");

    const one = await import("@/app/api/progress/[domain]/route");
    const res = await one.GET(jsonReq(`/api/progress/${D}`, "GET"), { params: Promise.resolve({ domain: D }) });
    const p = await res.json();
    expect(p.reports).toBe(2);
    expect(p.sinceLast.fixed.length).toBe(3);
    expect(p.storage.audits).toBe(3);
    expect(p.storage.historyBytes).toBeGreaterThan(0);

    const rep = await import("@/app/api/progress/[domain]/report/route");
    const r = await rep.GET(jsonReq(`/api/progress/${D}/report`, "GET"), { params: Promise.resolve({ domain: D }) });
    expect(r.headers.get("content-disposition")).toMatch(/attachment; filename="auditpilot-progress-mycoldinbox.com-2026-11-25.md"/);
    expect(await r.text()).toContain("## Since the last report (2026-11-24 → 2026-11-25)");

    const bad = await one.GET(jsonReq("/api/progress/evil.com", "GET"), { params: Promise.resolve({ domain: "../../etc" }) });
    expect(bad.status).toBe(404);
  });

  it("cleans up only old scheduled audits when retention is turned on", async () => {
    const { pruneOldAudits, setRetention, updateMonitor, backfillHistory } = await import("@/lib/server/monitor");
    const { listAudits } = await import("@/lib/server/audits");
    audit("mycoldinbox.com-2026-10-01-0800", "2026-10-01T08:00:00+00:00");
    audit("mycoldinbox.com-2026-10-02-0800", "2026-10-02T08:00:00+00:00");
    backfillHistory(listAudits({ includeHidden: true }), 10);
    const now = Date.parse("2026-11-26T12:00:00Z");
    expect(pruneOldAudits(now)).toEqual([]); // off by default
    await updateMonitor((m) => void (m.scheduled = ["mycoldinbox.com-2026-10-01-0800", "mycoldinbox.com-2026-11-24-0800"]));
    const settings = await import("@/app/api/monitor/settings/route");
    expect((await settings.PATCH(jsonReq("/api/monitor/settings", "PATCH", { keepAuditDays: 7 }))).status).toBe(400);
    await setRetention(14);
    const removed = pruneOldAudits(now);
    expect(removed).toEqual(["mycoldinbox.com-2026-10-01-0800"]); // 10-02 was not scheduled; 11-24 is too recent
    expect(fs.existsSync(path.join(sb.reports, "mycoldinbox.com-2026-10-01-0800"))).toBe(false);
    expect(fs.existsSync(path.join(sb.reports, "mycoldinbox.com-2026-10-02-0800"))).toBe(true);
    const { readRecords } = await import("@/lib/server/history");
    expect(readRecords(D).some((r) => r.date === "2026-10-01")).toBe(true); // history stays
  });
});
