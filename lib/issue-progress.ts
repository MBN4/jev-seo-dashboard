/**
 * Issue progress over time, from the daily history records: what was fixed since the last
 * report, what is new, what is still open and for how long, and the long-run trend.
 * Pure functions, shared by the server, the report export and tests.
 */
import { TIER_ORDER, type Owner, type Tier } from "@/lib/priorities";

export interface IssueRecord {
  id: string;
  title: string;
  severity: string;
  source: "rule" | "extra" | "ai" | "dataforseo";
  tier: Tier;
  owner: Owner;
  count: number;
  urls: string[];
  /** The data shows this is probably intentional (e.g. noindex on pagination) */
  intended: boolean;
}

export interface DayRecord {
  version: 1;
  domain: string;
  date: string;
  auditId: string;
  finishedAt: string | null;
  score: number | null;
  grade: string | null;
  pages: number;
  issues: IssueRecord[];
}

export interface GscDayRecord {
  version: 1;
  domain: string;
  date: string;
  dataUntil: string;
  clicks28: number;
  impressions28: number;
  ctr28: number;
  position28: number | null;
  clicks7: number;
  indexed: number;
  notIndexed: number;
  notIndexedUrls: string[];
  alerts: Array<{ id: string; title: string; priority: string }>;
  topQueries: Array<{ key: string; clicks: number; impressions: number; position: number }>;
}

/** Issues that count as work to do (not intended, not information-only or manual). */
export const actionable = (i: IssueRecord) => !i.intended && i.tier !== "Ignore" && i.tier !== "Manual";

const DAY = 86_400_000;
const days = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);
const byTier = (a: { tier: Tier; count?: number }, b: { tier: Tier; count?: number }) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier] || (b.count ?? 0) - (a.count ?? 0);

export interface OpenIssue extends IssueRecord {
  /** Date this issue (in its current, unbroken run) was first seen */
  since: string;
  daysOpen: number;
  reportsOpen: number;
  /** Count in the previous report (null if it was not open then) */
  prevCount: number | null;
  /** Pages fixed since the last report (were affected, now are not) */
  pagesFixed: string[];
  /** Pages newly affected since the last report */
  pagesNew: string[];
  /** Count per report, oldest first */
  series: Array<{ date: string; count: number }>;
  /** Was fixed before and came back */
  reopened: boolean;
}

export interface FixedIssue {
  id: string;
  title: string;
  tier: Tier;
  owner: Owner;
  severity: string;
  /** Pages it affected in the last report where it was open */
  count: number;
  urls: string[];
  fixedOn: string;
  /** How long it had been open */
  daysOpen: number;
}

export interface Progress {
  domain: string;
  reports: number;
  first: { date: string; score: number | null } | null;
  latest: { date: string; auditId: string; score: number | null; grade: string | null; pages: number } | null;
  previous: { date: string; auditId: string; score: number | null } | null;
  sinceLast: {
    fixed: FixedIssue[];
    newIssues: OpenIssue[];
    worse: OpenIssue[];
    better: OpenIssue[];
    pagesFixed: number;
    pagesNew: number;
  } | null;
  open: OpenIssue[];
  intended: IssueRecord[];
  openByTier: Record<Tier, number>;
  /** Every fix since history started, newest first */
  fixLog: FixedIssue[];
  timeline: Array<{ date: string; score: number | null; P0: number; P1: number; P2: number; Weekly: number; fixed: number; added: number; clicks28: number | null }>;
  totals: { fixedEver: number; reopened: number; scoreChange: number | null; openChange: number | null };
  search: { latest: GscDayRecord | null; previous: GscDayRecord | null; history: Array<{ date: string; clicks28: number; impressions28: number; position28: number | null; notIndexed: number }> };
}

const emptyTiers = (): Record<Tier, number> => ({ P0: 0, P1: 0, P2: 0, Weekly: 0, Ignore: 0, Manual: 0 });

export function buildProgress(domain: string, recordsIn: DayRecord[], gsc: GscDayRecord[] = []): Progress {
  const records = [...recordsIn].sort((a, b) => a.date.localeCompare(b.date));
  const latest = records.at(-1) ?? null;
  const previous = records.at(-2) ?? null;
  const act = (r: DayRecord) => new Map(r.issues.filter(actionable).map((i) => [i.id, i]));

  // Walk the history once: fix log, per-issue runs, timeline.
  const fixLog: FixedIssue[] = [];
  const runStart = new Map<string, string>();
  const everFixed = new Set<string>();
  const reopenedIds = new Set<string>();
  const series = new Map<string, Array<{ date: string; count: number }>>();
  const timeline: Progress["timeline"] = [];
  const gscByDate = new Map(gsc.map((g) => [g.date, g]));
  let prevMap = new Map<string, IssueRecord>();
  for (const r of records) {
    const cur = act(r);
    let fixed = 0;
    let added = 0;
    for (const [id, i] of cur) {
      if (!prevMap.has(id)) {
        runStart.set(id, r.date);
        if (everFixed.has(id)) reopenedIds.add(id);
        if (timeline.length) added++;
      }
      (series.get(id) ?? series.set(id, []).get(id)!).push({ date: r.date, count: i.count });
    }
    for (const [id, i] of prevMap) {
      if (!cur.has(id)) {
        fixed++;
        everFixed.add(id);
        fixLog.push({ id, title: i.title, tier: i.tier, owner: i.owner, severity: i.severity, count: i.count, urls: i.urls, fixedOn: r.date, daysOpen: days(runStart.get(id) ?? r.date, r.date) });
        reopenedIds.delete(id);
      }
    }
    const tiers = emptyTiers();
    for (const i of cur.values()) tiers[i.tier]++;
    const g = gscByDate.get(r.date) ?? [...gsc].reverse().find((x) => x.date <= r.date) ?? null;
    timeline.push({ date: r.date, score: r.score, P0: tiers.P0, P1: tiers.P1, P2: tiers.P2, Weekly: tiers.Weekly, fixed, added, clicks28: g ? g.clicks28 : null });
    prevMap = cur;
  }

  const latestMap = latest ? act(latest) : new Map<string, IssueRecord>();
  const prevActMap = previous ? act(previous) : new Map<string, IssueRecord>();
  const open: OpenIssue[] = [...latestMap.values()]
    .map((i) => {
      const p = prevActMap.get(i.id);
      const prevUrls = new Set(p?.urls ?? []);
      const nowUrls = new Set(i.urls);
      const s = series.get(i.id) ?? [];
      const since = runStart.get(i.id) ?? latest!.date;
      return {
        ...i,
        since,
        daysOpen: days(since, latest!.date),
        reportsOpen: s.filter((x) => x.date >= since).length,
        prevCount: p ? p.count : null,
        pagesFixed: p ? (p.urls ?? []).filter((u) => !nowUrls.has(u)) : [],
        pagesNew: p ? i.urls.filter((u) => !prevUrls.has(u)) : [],
        series: s,
        reopened: reopenedIds.has(i.id),
      };
    })
    .sort((a, b) => byTier(a, b) || b.daysOpen - a.daysOpen);

  const sinceLast = previous && latest
    ? {
        fixed: fixLog.filter((f) => f.fixedOn === latest.date).sort(byTier),
        newIssues: open.filter((i) => i.prevCount == null),
        worse: open.filter((i) => i.prevCount != null && i.count > i.prevCount),
        better: open.filter((i) => i.prevCount != null && i.count < i.prevCount),
        pagesFixed: open.reduce((a, i) => a + i.pagesFixed.length, 0),
        pagesNew: open.reduce((a, i) => a + i.pagesNew.length, 0),
      }
    : null;

  const openByTier = emptyTiers();
  for (const i of open) openByTier[i.tier]++;
  const first = records[0] ?? null;
  const gs = [...gsc].sort((a, b) => a.date.localeCompare(b.date));
  return {
    domain,
    reports: records.length,
    first: first ? { date: first.date, score: first.score } : null,
    latest: latest ? { date: latest.date, auditId: latest.auditId, score: latest.score, grade: latest.grade, pages: latest.pages } : null,
    previous: previous ? { date: previous.date, auditId: previous.auditId, score: previous.score } : null,
    sinceLast,
    open,
    intended: latest ? latest.issues.filter((i) => i.intended) : [],
    openByTier,
    fixLog: fixLog.reverse(),
    timeline,
    totals: {
      fixedEver: fixLog.length,
      reopened: open.filter((i) => i.reopened).length,
      scoreChange: first && latest && first.score != null && latest.score != null ? latest.score - first.score : null,
      openChange: timeline.length >= 2 ? open.length - act(first!).size : null,
    },
    search: {
      latest: gs.at(-1) ?? null,
      previous: gs.at(-2) ?? null,
      history: gs.map((g) => ({ date: g.date, clicks28: g.clicks28, impressions28: g.impressions28, position28: g.position28, notIndexed: g.notIndexed })),
    },
  };
}

/** Plain-text report for sharing (Markdown). */
export function progressMarkdown(p: Progress): string {
  const L: string[] = [];
  const A = (s = "") => L.push(s);
  A(`# SEO progress report: ${p.domain}`);
  A();
  if (!p.latest) {
    A("No audits recorded yet.");
    return L.join("\n");
  }
  A(`Latest audit: ${p.latest.date} · score ${p.latest.score ?? "—"} (${p.latest.grade ?? "—"}) · ${p.latest.pages} pages`);
  if (p.previous) A(`Compared with: ${p.previous.date} · score ${p.previous.score ?? "—"}`);
  A(`History: ${p.reports} report(s) since ${p.first?.date}. ${p.totals.fixedEver} issue(s) fixed in that time.`);
  A();
  A(`## Open issues: ${p.open.length}`);
  A();
  A(`| Critical (P0) | High (P1) | Important (P2) | Weekly |`);
  A(`|---|---|---|---|`);
  A(`| ${p.openByTier.P0} | ${p.openByTier.P1} | ${p.openByTier.P2} | ${p.openByTier.Weekly} |`);
  A();
  if (p.sinceLast) {
    A(`## Since the last report (${p.previous!.date} → ${p.latest.date})`);
    A();
    A(`- **Fixed:** ${p.sinceLast.fixed.length} issue(s)${p.sinceLast.fixed.length ? `: ${p.sinceLast.fixed.map((f) => `${f.title} (${f.tier})`).join("; ")}` : ""}`);
    A(`- **New:** ${p.sinceLast.newIssues.length} issue(s)${p.sinceLast.newIssues.length ? `: ${p.sinceLast.newIssues.map((f) => `${f.title} (${f.tier}, ${f.count} pages)`).join("; ")}` : ""}`);
    A(`- **Got worse:** ${p.sinceLast.worse.length}${p.sinceLast.worse.length ? `: ${p.sinceLast.worse.map((f) => `${f.title} ${f.prevCount} → ${f.count}`).join("; ")}` : ""}`);
    A(`- **Improved:** ${p.sinceLast.better.length}${p.sinceLast.better.length ? `: ${p.sinceLast.better.map((f) => `${f.title} ${f.prevCount} → ${f.count}`).join("; ")}` : ""}`);
    A(`- **Pages fixed inside open issues:** ${p.sinceLast.pagesFixed}; newly affected: ${p.sinceLast.pagesNew}`);
    A();
  }
  A("## Still to fix (most important first)");
  A();
  A("| Priority | Issue | Owner | Pages now | Change | Open for |");
  A("|---|---|---|---|---|---|");
  for (const i of p.open.filter((x) => x.tier !== "Weekly"))
    A(`| ${i.tier} | ${i.title} \`${i.id}\` | ${i.owner} | ${i.count} | ${i.prevCount == null ? "new" : i.count - i.prevCount === 0 ? "same" : `${i.count - i.prevCount > 0 ? "+" : ""}${i.count - i.prevCount}`} | ${i.daysOpen} day(s)${i.reopened ? ", came back" : ""} |`);
  const weekly = p.open.filter((x) => x.tier === "Weekly");
  if (weekly.length) {
    A();
    A(`Weekly-digest items (${weekly.length}): ${weekly.map((i) => `${i.title} (${i.count})`).join("; ")}`);
  }
  if (p.search.latest) {
    const s = p.search.latest;
    A();
    A("## Google Search (last 28 days)");
    A();
    A(`${s.clicks28.toLocaleString()} clicks · ${s.impressions28.toLocaleString()} impressions · average position ${s.position28?.toFixed(1) ?? "—"} · ${s.notIndexed} inspected page(s) not indexed`);
    if (p.search.previous) A(`Previous sync (${p.search.previous.date}): ${p.search.previous.clicks28.toLocaleString()} clicks, ${p.search.previous.impressions28.toLocaleString()} impressions`);
  }
  if (p.fixLog.length) {
    A();
    A("## Fix log");
    A();
    for (const f of p.fixLog.slice(0, 50)) A(`- ${f.fixedOn}: ${f.title} (${f.tier}, open ${f.daysOpen} day(s))`);
  }
  return L.join("\n") + "\n";
}
