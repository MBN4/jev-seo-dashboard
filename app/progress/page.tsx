"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCheck, CheckCircle2, ChevronDown, Download, HardDrive, History, Info, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/common/page-header";
import { SectionCard } from "@/components/common/section-card";
import { ErrorState } from "@/components/common/error-state";
import { LoadingSkeleton } from "@/components/common/loading-skeleton";
import { FilterChip } from "@/components/common/filter-chip";
import { GradeBadge } from "@/components/common/grade-badge";
import { ChartTooltip } from "@/components/charts/chart-tooltip";
import { FindingDetailDrawer } from "@/components/audit/finding-detail-drawer";
import { UrlLink } from "@/components/audit/finding-breakdown-view";
import { useApi } from "@/hooks/use-api";
import { api, ApiError, type ProgressOpen, type ProgressView } from "@/lib/api";
import { formatBytes, formatDate } from "@/lib/format";
import { TIER_LABEL, type Tier } from "@/lib/priorities";
import { cn } from "@/lib/utils";

const TIER_CLS: Record<Tier, string> = {
  P0: "bg-critical text-white",
  P1: "bg-critical-soft text-critical",
  P2: "bg-warning-soft text-warning-ink",
  Weekly: "bg-muted text-muted-foreground",
  Ignore: "bg-muted text-muted-foreground",
  Manual: "bg-muted text-muted-foreground",
};
const day = (d: string) => formatDate(`${d}T12:00:00Z`, false);

function TierBadge({ tier }: { tier: Tier }) {
  return <span className={cn("inline-flex shrink-0 items-center rounded px-1.5 py-0.5 font-mono text-[0.65rem] font-semibold", TIER_CLS[tier])} title={TIER_LABEL[tier]}>{tier === "Weekly" ? "WK" : tier}</span>;
}

function Spark({ series }: { series: Array<{ count: number }> }) {
  if (series.length < 2) return <span className="text-[0.7rem] text-muted-foreground">—</span>;
  const vals = series.slice(-14).map((s) => s.count);
  const max = Math.max(...vals, 1);
  const w = 70;
  const h = 18;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * w},${h - (v / max) * (h - 2) - 1}`).join(" ");
  const down = vals.at(-1)! <= vals[0];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-[18px] w-[70px]" aria-label={`Pages affected per report: ${vals.join(", ")}`}>
      <polyline points={pts} fill="none" stroke={down ? "var(--success)" : "var(--critical)"} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "good" | "bad" | "warn" }) {
  return (
    <div className="surface p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-3xl font-semibold tracking-tight tabular-nums", tone === "good" && "text-success", tone === "bad" && "text-critical", tone === "warn" && "text-warning-ink")}>{value}</p>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function OpenRow({ i, onOpen, sinceLast }: { i: ProgressOpen; onOpen: (id: string) => void; sinceLast: boolean }) {
  const [open, setOpen] = useState(false);
  const diff = i.prevCount == null ? null : i.count - i.prevCount;
  return (
    <li className="border-b last:border-b-0">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap">
        <TierBadge tier={i.tier} />
        <button type="button" onClick={() => onOpen(i.id)} className="min-w-0 flex-1 text-left">
          <p className="truncate text-sm font-medium hover:underline">{i.title}</p>
          <p className="text-xs text-muted-foreground">
            {i.owner} · open {i.daysOpen === 0 ? "since today" : `${i.daysOpen} day${i.daysOpen === 1 ? "" : "s"}`} ({i.reportsOpen} report{i.reportsOpen === 1 ? "" : "s"})
            {i.reopened && <span className="ml-1.5 inline-flex items-center gap-0.5 text-critical"><RotateCcw className="size-3" /> came back after a fix</span>}
          </p>
        </button>
        <Spark series={i.series} />
        <div className="w-28 shrink-0 text-right">
          <p className="text-sm font-semibold tabular-nums">{i.count.toLocaleString()} page{i.count === 1 ? "" : "s"}</p>
          {sinceLast && (
            <p className={cn("text-xs tabular-nums", diff == null ? "text-critical" : diff > 0 ? "text-critical" : diff < 0 ? "text-success" : "text-muted-foreground")}>
              {diff == null ? "new" : diff === 0 ? "no change" : `${diff > 0 ? "+" : ""}${diff} vs last`}
            </p>
          )}
        </div>
        {(i.pagesFixedCount > 0 || i.pagesNewCount > 0) && (
          <button type="button" onClick={() => setOpen((o) => !o)} className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted" aria-label="Show pages fixed and newly affected">
            <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
          </button>
        )}
      </div>
      {open && (
        <div className="grid gap-3 px-4 pb-4 md:grid-cols-2">
          {i.pagesFixedCount > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-success">Pages fixed since last report ({i.pagesFixedCount})</p>
              <ul className="max-h-40 space-y-0.5 overflow-y-auto rounded-md border p-2 text-xs">{i.pagesFixed.map((u) => <li key={u}><UrlLink url={u} compact /></li>)}</ul>
            </div>
          )}
          {i.pagesNewCount > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-critical">Newly affected pages ({i.pagesNewCount})</p>
              <ul className="max-h-40 space-y-0.5 overflow-y-auto rounded-md border p-2 text-xs">{i.pagesNew.map((u) => <li key={u}><UrlLink url={u} compact /></li>)}</ul>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function Timeline({ data }: { data: ProgressView["timeline"] }) {
  if (data.length < 2) return <p className="py-8 text-center text-sm text-muted-foreground">The trend appears after the second daily report.</p>;
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 4, left: -16, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
          <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} minTickGap={28} tickFormatter={(d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric" })} />
          <YAxis yAxisId="n" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} allowDecimals={false} />
          <YAxis yAxisId="s" orientation="right" domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
          <Tooltip content={<ChartTooltip labelFormatter={(l) => day(String(l))} />} />
          <Area yAxisId="n" type="monotone" stackId="t" dataKey="P0" name="Critical open" stroke="var(--critical)" fill="var(--critical)" fillOpacity={0.55} />
          <Area yAxisId="n" type="monotone" stackId="t" dataKey="P1" name="High open" stroke="var(--high)" fill="var(--high)" fillOpacity={0.35} />
          <Area yAxisId="n" type="monotone" stackId="t" dataKey="P2" name="Important open" stroke="var(--warning)" fill="var(--warning)" fillOpacity={0.25} />
          <Line yAxisId="s" type="monotone" dataKey="score" name="Score" stroke="var(--brand)" strokeWidth={2.4} dot={{ r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function SiteProgress({ p, domain, onChanged }: { p: ProgressView; domain: string; onChanged: () => void }) {
  const [owner, setOwner] = useState<"all" | "Dev" | "SEO" | "Content">("all");
  const [weekly, setWeekly] = useState(false);
  const [drawer, setDrawer] = useState<string | null>(null);
  const [showIntended, setShowIntended] = useState(false);
  const list = useMemo(() => p.open.filter((i) => (weekly || i.tier !== "Weekly") && (owner === "all" || i.owner.includes(owner))), [p.open, owner, weekly]);
  if (!p.latest) {
    return (
      <SectionCard>
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <History className="size-8 text-muted-foreground" />
          <p className="text-sm">No reports recorded yet. History starts with the next completed audit (existing audits are added within a few minutes of starting AuditPilot).</p>
        </div>
      </SectionCard>
    );
  }
  const sl = p.sinceLast;
  const scoreDelta = p.previous && p.latest.score != null && p.previous.score != null ? p.latest.score - p.previous.score : null;
  const extraLink = (id: string) => /^(kw_|eeat_|url_|schema_breadcrumb|schema_article|links_|readability|images_lazy|social_|keyword_stuffing|title_h1)/.test(id);
  const openIssue = (id: string) => {
    if (extraLink(id)) window.location.href = `/audits/${encodeURIComponent(p.latest!.auditId)}/extra`;
    else setDrawer(id);
  };
  const actionable = p.open.filter((i) => i.tier !== "Weekly").length;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Latest report <b className="text-foreground">{day(p.latest.date)}</b>
          {p.previous ? <> compared with <b className="text-foreground">{day(p.previous.date)}</b></> : " (first report: nothing to compare yet)"} · {p.reports} daily report{p.reports === 1 ? "" : "s"} stored since {day(p.first!.date)}
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" asChild>
            <a href={api.progressReportUrl(domain)}><Download className="size-3.5" /> Download report</a>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href={`/audits/${encodeURIComponent(p.latest.auditId)}/checklist`}>Latest audit</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Fixed since last report" value={sl ? sl.fixed.length : "—"} tone={sl && sl.fixed.length ? "good" : undefined} sub={sl ? `+ ${sl.pagesFixed.toLocaleString()} page${sl.pagesFixed === 1 ? "" : "s"} fixed inside open issues` : "after the next report"} />
        <Stat label="New since last report" value={sl ? sl.newIssues.length : "—"} tone={sl && sl.newIssues.length ? "bad" : undefined} sub={sl ? `${sl.worse.length} got worse · ${sl.better.length} improved` : "after the next report"} />
        <Stat
          label="Still to fix"
          value={actionable}
          tone={p.openByTier.P0 ? "bad" : p.openByTier.P1 ? "warn" : undefined}
          sub={<span className="flex flex-wrap gap-1.5"><span>{p.openByTier.P0} critical</span>·<span>{p.openByTier.P1} high</span>·<span>{p.openByTier.P2} important</span>·<span>{p.openByTier.Weekly} weekly</span></span>}
        />
        <Stat
          label="Score"
          value={<span className="inline-flex items-center gap-2">{p.latest.score ?? "—"} <GradeBadge grade={p.latest.grade} /></span>}
          sub={
            <>
              {scoreDelta != null && scoreDelta !== 0 && <span className={scoreDelta > 0 ? "text-success" : "text-critical"}>{scoreDelta > 0 ? <ArrowUpRight className="inline size-3" /> : <ArrowDownRight className="inline size-3" />}{Math.abs(scoreDelta)} vs last · </span>}
              {p.totals.scoreChange != null ? `${p.totals.scoreChange >= 0 ? "+" : ""}${p.totals.scoreChange} since ${day(p.first!.date)}` : ""}
            </>
          }
        />
      </div>

      <SectionCard title="Progress over time" description={`Open issues by priority (stacked) and the score, one point per daily report. ${p.totals.fixedEver} issue${p.totals.fixedEver === 1 ? "" : "s"} fixed since ${day(p.first!.date)}.`}>
        <Timeline data={p.timeline} />
      </SectionCard>

      {sl && sl.fixed.length > 0 && (
        <SectionCard title={`Fixed since the last report (${sl.fixed.length})`} description="Problems that were in the previous report and are gone now.">
          <ul className="divide-y rounded-xl border">
            {sl.fixed.map((f) => (
              <li key={f.id} className="flex items-center gap-3 px-4 py-2.5">
                <CheckCircle2 className="size-4 shrink-0 text-success" />
                <TierBadge tier={f.tier} />
                <span className="min-w-0 flex-1 truncate text-sm">{f.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{f.owner} · was on {f.count} page{f.count === 1 ? "" : "s"} · open {f.daysOpen} day{f.daysOpen === 1 ? "" : "s"}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      <SectionCard
        title={`Still to fix (${list.length})`}
        description="Most important first, then longest open. Click an issue for exactly where it is and how to fix it; open the arrow to see which pages were fixed or newly affected since the last report."
        actions={
          <div className="flex flex-wrap gap-1.5">
            {(["all", "Dev", "SEO", "Content"] as const).map((o) => (
              <FilterChip key={o} active={owner === o} onClick={() => setOwner(o)}>{o === "all" ? "Everyone" : o}</FilterChip>
            ))}
            <FilterChip active={weekly} onClick={() => setWeekly((w) => !w)}>Include weekly</FilterChip>
          </div>
        }
        bodyClassName="p-0"
      >
        {list.length === 0 ? (
          <p className="flex items-center justify-center gap-2 py-10 text-sm text-success"><Sparkles className="size-4" /> Nothing left to fix here.</p>
        ) : (
          <ul>
            {list.map((i) => <OpenRow key={i.id} i={i} onOpen={openIssue} sinceLast={Boolean(sl)} />)}
          </ul>
        )}
      </SectionCard>

      {p.intended.length > 0 && (
        <div className="rounded-xl border">
          <button type="button" onClick={() => setShowIntended((s) => !s)} className="flex w-full items-center gap-2 p-3 text-left text-sm">
            <ChevronDown className={cn("size-4 transition-transform", showIntended && "rotate-180")} />
            <Info className="size-4 text-info" /> {p.intended.length} finding{p.intended.length === 1 ? " looks" : "s look"} intentional and {p.intended.length === 1 ? "is" : "are"} not counted
          </button>
          {showIntended && (
            <ul className="space-y-1 border-t p-3 text-sm">
              {p.intended.map((i) => <li key={i.id}>{i.title} <span className="text-muted-foreground">({i.count} page{i.count === 1 ? "" : "s"})</span></li>)}
            </ul>
          )}
        </div>
      )}

      {p.fixLog.length > 0 && (
        <SectionCard title="Fix log" description="Every issue that disappeared between two reports, newest first.">
          <ol className="relative space-y-3 border-l pl-5">
            {p.fixLog.slice(0, 60).map((f) => (
              <li key={`${f.id}-${f.fixedOn}`} className="relative">
                <span className="absolute top-1 -left-[1.6rem] flex size-3 items-center justify-center rounded-full bg-success ring-4 ring-background" />
                <p className="text-xs text-muted-foreground">{day(f.fixedOn)}</p>
                <p className="text-sm"><TierBadge tier={f.tier} /> <span className="ml-1">{f.title}</span> <span className="text-xs text-muted-foreground">· {f.owner} · open {f.daysOpen} day{f.daysOpen === 1 ? "" : "s"}</span></p>
              </li>
            ))}
          </ol>
        </SectionCard>
      )}

      {p.search.history.length > 0 && (
        <SectionCard title="Google search traffic per day" description="Clicks and pages not indexed (from Search Console), recorded with each daily sync.">
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-[0.7rem] text-muted-foreground uppercase">
                <tr><th className="px-3 py-2 text-left">Synced</th><th className="px-3 py-2 text-right">Clicks (28 d)</th><th className="px-3 py-2 text-right">Impressions (28 d)</th><th className="px-3 py-2 text-right">Avg position</th><th className="px-3 py-2 text-right">Not indexed</th></tr>
              </thead>
              <tbody className="divide-y">
                {[...p.search.history].reverse().slice(0, 30).map((g) => (
                  <tr key={g.date}><td className="px-3 py-1.5">{day(g.date)}</td><td className="px-3 py-1.5 text-right tabular-nums">{g.clicks28.toLocaleString()}</td><td className="px-3 py-1.5 text-right tabular-nums">{g.impressions28.toLocaleString()}</td><td className="px-3 py-1.5 text-right tabular-nums">{g.position28?.toFixed(1) ?? "—"}</td><td className={cn("px-3 py-1.5 text-right tabular-nums", g.notIndexed && "text-critical")}>{g.notIndexed}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      <Storage p={p} onChanged={onChanged} />
      {drawer && <FindingDetailDrawer auditId={p.latest.auditId} findingId={drawer} onClose={() => setDrawer(null)} />}
    </div>
  );
}

function Storage({ p, onChanged }: { p: ProgressView; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const change = async (v: string) => {
    setBusy(true);
    try {
      await api.setRetention(v === "forever" ? null : Number(v));
      toast.success(v === "forever" ? "Full audit files are kept forever" : `Scheduled audits older than ${v} days will be cleaned up. Daily history stays.`);
      onChanged();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="surface flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <HardDrive className="mt-0.5 size-4 text-muted-foreground" />
        <div className="text-sm">
          <p>
            <b>{p.storage.audits}</b> full audit{p.storage.audits === 1 ? "" : "s"} stored ({formatBytes(p.storage.auditBytes)}) · daily history {formatBytes(p.storage.historyBytes)}
          </p>
          <p className="text-xs text-muted-foreground">The daily history (issues, pages, score, search numbers) is always kept. Full audit files are large; you can let AuditPilot clean up old scheduled ones. Your own audits and the two newest per site are never removed.</p>
        </div>
      </div>
      <Select value={p.storage.keepAuditDays == null ? "forever" : String(p.storage.keepAuditDays)} onValueChange={change} disabled={busy}>
        <SelectTrigger className="h-8 w-56 shrink-0 text-xs" aria-label="Keep full audit files for"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="forever">Keep full audit files forever</SelectItem>
          {[365, 180, 90, 30, 14].map((d) => <SelectItem key={d} value={String(d)}>Keep full files for {d} days</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

export default function ProgressPage() {
  const { data: ov, error, reload } = useApi(() => api.siteProgress(), []);
  const [domain, setDomain] = useState<string | null>(null);
  useEffect(() => {
    if (!domain && ov?.sites.length) {
      const q = new URLSearchParams(window.location.search).get("site");
      setDomain(ov.sites.find((s) => s.domain === q)?.domain ?? ov.sites[0].domain);
    }
  }, [ov, domain]);
  const site = useApi(domain ? () => api.siteProgressDetail(domain) : null, [domain]);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!ov) return <LoadingSkeleton />;
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={<span className="inline-flex items-center gap-1.5"><CheckCheck className="size-3.5" /> Stored daily</span>}
        title="Progress"
        description="Every daily audit is stored as a report. Each new report is compared with the previous one: what got fixed, what is new, and what is still open and for how long, so every issue can be followed until it is gone."
      />
      <div className="flex flex-wrap gap-2">
        {ov.sites.map((s) => (
          <button
            key={s.domain}
            type="button"
            onClick={() => setDomain(s.domain)}
            className={cn("surface flex min-w-44 flex-col items-start rounded-xl px-3 py-2 text-left transition-shadow", domain === s.domain ? "ring-2 ring-brand" : "hover:ring-1 hover:ring-border")}
          >
            <span className="flex w-full items-center justify-between gap-2 text-sm font-semibold">
              {s.domain}
              {s.openByTier.P0 > 0 && <span className="inline-flex items-center gap-0.5 rounded-full bg-critical px-1.5 text-[0.6rem] font-bold text-white"><AlertTriangle className="size-2.5" />{s.openByTier.P0}</span>}
            </span>
            <span className="text-xs text-muted-foreground">
              {s.latest ? (
                <>
                  {s.open} open
                  {s.fixedSinceLast != null && <> · <span className="text-success">{s.fixedSinceLast} fixed</span></>}
                  {s.newSinceLast != null && s.newSinceLast > 0 && <> · <span className="text-critical">{s.newSinceLast} new</span></>}
                </>
              ) : (
                "no reports yet"
              )}
            </span>
          </button>
        ))}
      </div>
      {site.error && <ErrorState error={site.error} onRetry={site.reload} />}
      {!site.data && !site.error && <LoadingSkeleton />}
      {site.data && domain && site.data.domain === domain && <SiteProgress p={site.data} domain={domain} onChanged={() => { site.reload(); reload(); }} />}
    </div>
  );
}
