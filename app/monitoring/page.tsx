"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import {
  AlertTriangle, SearchCheck, ArrowDownRight, ArrowRight, ArrowUpRight, CheckCircle2, ChevronDown, Clock, FileSearch, Loader2, Pause, Play, Plus, Radar, RefreshCw, Sparkles, Trash2, TrendingDown, TrendingUp, Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/common/page-header";
import { SectionCard } from "@/components/common/section-card";
import { ErrorState } from "@/components/common/error-state";
import { LoadingSkeleton } from "@/components/common/loading-skeleton";
import { GradeBadge } from "@/components/common/grade-badge";
import { SeverityBadge } from "@/components/common/severity-badge";
import { FilterChip } from "@/components/common/filter-chip";
import { FindingDetailDrawer } from "@/components/audit/finding-detail-drawer";
import { UrlLink } from "@/components/audit/finding-breakdown-view";
import { useApi } from "@/hooks/use-api";
import { api, ApiError, type MonitorEvent, type MonitorSite } from "@/lib/api";
import { formatDate, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

const INTERVAL_LABEL: Record<number, string> = { 6: "Every 6 hours", 12: "Every 12 hours", 24: "Every day", 48: "Every 2 days", 168: "Every week" };

function untilText(iso: string | null): string {
  if (!iso) return "Paused";
  const ms = Date.parse(iso) - Date.now();
  if (ms <= 60_000) return "Starting soon";
  const total = Math.round(ms / 60_000);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h ? `in ${h} h ${m} min` : `in ${m} min`;
}

function Sparkline({ points }: { points: Array<{ score: number | null }> }) {
  const vals = points.map((p) => p.score).filter((v): v is number => v != null);
  if (vals.length < 2) return <div className="h-9 text-[0.7rem] text-muted-foreground">Trend appears after the next audit</div>;
  const min = Math.min(...vals, 100) - 5;
  const max = Math.max(...vals) + 5;
  const w = 160;
  const h = 36;
  const xy = vals.map((v, i) => [(i / (vals.length - 1)) * w, h - ((v - min) / (max - min || 1)) * h] as const);
  const up = vals.at(-1)! >= vals[0];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-9 w-40" aria-label={`Score trend: ${vals.join(", ")}`}>
      <polyline fill="none" stroke={up ? "var(--success)" : "var(--critical)"} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" points={xy.map((p) => p.join(",")).join(" ")} />
      <circle cx={xy.at(-1)![0]} cy={xy.at(-1)![1]} r="3" fill={up ? "var(--success)" : "var(--critical)"} />
    </svg>
  );
}

function SiteCard({ s, onChanged }: { s: MonitorSite; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const act = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    try {
      await fn();
      if (ok) toast.success(ok);
      onChanged();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };
  const last = s.lastAudit;
  const delta = s.history.length >= 2 && s.history.at(-1)!.score != null && s.history.at(-2)!.score != null ? s.history.at(-1)!.score! - s.history.at(-2)!.score! : null;
  return (
    <div className={cn("surface flex flex-col gap-4 p-5", !s.enabled && "opacity-70")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn("size-2 shrink-0 rounded-full", s.running ? "animate-pulse bg-info" : s.enabled ? "bg-success" : "bg-muted-foreground")} aria-hidden />
            <a href={s.url} target="_blank" rel="noreferrer noopener" className="truncate text-base font-semibold hover:underline">{s.domain}</a>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {s.running ? (
              <Link href={`/audits/${encodeURIComponent(s.running.id)}/progress`} className="font-medium text-info hover:underline">Auditing now →</Link>
            ) : s.enabled ? (
              <>Next audit {untilText(s.nextRunAt)}</>
            ) : (
              "Paused"
            )}
            {s.pagesCounted != null && <> · {s.pagesCounted.toLocaleString()} pages in sitemap</>}
          </p>
        </div>
        {last && (
          <div className="flex shrink-0 items-center gap-2">
            {delta != null && delta !== 0 && (
              <span className={cn("inline-flex items-center text-xs font-semibold", delta > 0 ? "text-success" : "text-critical")}>
                {delta > 0 ? <TrendingUp className="mr-0.5 size-3.5" /> : <TrendingDown className="mr-0.5 size-3.5" />}
                {delta > 0 ? "+" : ""}
                {delta}
              </span>
            )}
            <GradeBadge grade={last.grade} score={last.score} />
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Sparkline points={s.history} />
        <div className="text-right text-xs text-muted-foreground">
          {last ? (
            <>
              <p>Last audit {formatRelative(last.finishedAt)}</p>
              <p>
                {last.pagesCrawled?.toLocaleString() ?? "—"} pages · {last.findingsTotal ?? 0} issues
              </p>
            </>
          ) : (
            <p>No audit yet</p>
          )}
        </div>
      </div>
      {s.search && (
        <Link href={`/search-console?site=${encodeURIComponent(s.domain)}`} className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs transition-colors hover:bg-muted/70">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground"><SearchCheck className="size-3.5" /> Google search, last 28 days</span>
          {s.search.clicks != null ? (
            <span className="font-medium tabular-nums">
              {s.search.clicks.toLocaleString()} clicks · {s.search.impressions?.toLocaleString()} impr.
              {s.search.clicksChange != null && Math.abs(s.search.clicksChange) >= 0.005 && (
                <span className={cn("ml-1.5", s.search.clicksChange > 0 ? "text-success" : "text-critical")}>
                  {s.search.clicksChange > 0 ? "+" : "−"}
                  {Math.round(Math.abs(s.search.clicksChange) * 100)}%
                </span>
              )}
              {s.search.alerts > 0 && <span className="ml-1.5 rounded-full bg-critical px-1.5 text-[0.6rem] font-bold text-white">{s.search.alerts}</span>}
            </span>
          ) : (
            <span className="text-critical">{s.search.error ? "needs access" : "syncing"}</span>
          )}
        </Link>
      )}
      {s.lastAttemptError && (
        <p className="flex items-start gap-1.5 rounded-md bg-critical-soft px-2.5 py-1.5 text-xs text-critical">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> Last scheduled run failed: {s.lastAttemptError}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2 border-t pt-3">
        <Select value={String(s.intervalHours)} onValueChange={(v) => act(() => api.monitorUpdate(s.domain, { intervalHours: Number(v) }), "Schedule updated")} disabled={busy}>
          <SelectTrigger className="h-8 w-36 text-xs" aria-label={`How often to audit ${s.domain}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(INTERVAL_LABEL).map(([k, l]) => (
              <SelectItem key={k} value={k}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" disabled={busy || Boolean(s.running)} onClick={() => act(() => api.monitorRun(s.domain), `Audit of ${s.domain} queued. It starts within a minute, or after the running audit.`)}>
          <RefreshCw className="size-3.5" /> Run now
        </Button>
        <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs" disabled={busy} onClick={() => act(() => api.monitorUpdate(s.domain, { enabled: !s.enabled }), s.enabled ? "Paused" : "Resumed")}>
          {s.enabled ? <Pause className="size-3.5" /> : <Play className="size-3.5" />} {s.enabled ? "Pause" : "Resume"}
        </Button>
        {last && (
          <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs" asChild>
            <Link href={`/audits/${encodeURIComponent(last.id)}/checklist`}>
              <FileSearch className="size-3.5" /> Latest results
            </Link>
          </Button>
        )}
        {!s.builtIn && (
          <Button size="sm" variant="ghost" className="ml-auto h-8 text-xs text-muted-foreground" disabled={busy} onClick={() => act(() => api.monitorRemove(s.domain), "Stopped monitoring")} aria-label={`Stop monitoring ${s.domain}`}>
            <Trash2 className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, tone, children }: { icon: typeof Wrench; title: string; tone: string; children: React.ReactNode }) {
  return (
    <div>
      <p className={cn("mb-1.5 flex items-center gap-1.5 text-xs font-semibold", tone)}>
        <Icon className="size-3.5" /> {title}
      </p>
      {children}
    </div>
  );
}

function IssueList({ items, auditId, onOpen, mode }: { items: NonNullable<MonitorEvent["diff"]>["newIssues"]; auditId: string | null; onOpen: (a: string, f: string) => void; mode: "new" | "worse" | "fixed" | "better" }) {
  return (
    <ul className="divide-y rounded-lg border">
      {items.map((i) => (
        <li key={i.id}>
          <button type="button" disabled={mode === "fixed" || !auditId} onClick={() => auditId && onOpen(auditId, i.id)} className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors enabled:hover:bg-muted/50">
            <SeverityBadge severity={i.severity} />
            <span className={cn("min-w-0 flex-1 truncate", mode === "fixed" && "text-muted-foreground line-through")}>{i.title}</span>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {mode === "new" ? `${i.after} page${i.after === 1 ? "" : "s"}` : mode === "fixed" ? `was ${i.before}` : `${i.before} → ${i.after}`}
            </span>
            {mode !== "fixed" && auditId && <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />}
          </button>
        </li>
      ))}
    </ul>
  );
}

function Changes({ label, rows }: { label: string; rows: Array<{ url: string; before: string | null; after: string | null }> }) {
  if (!rows.length) return null;
  return (
    <div>
      <p className="mb-1 text-xs font-medium">{label}</p>
      <ul className="space-y-1.5">
        {rows.slice(0, 10).map((r) => (
          <li key={r.url} className="rounded-md border p-2 text-xs">
            <UrlLink url={r.url} compact />
            <p className="mt-1 text-muted-foreground line-through">{r.before ?? "(none)"}</p>
            <p>{r.after ?? "(none)"}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function UrlBlock({ label, urls, total, tone }: { label: string; urls: string[]; total: number; tone?: string }) {
  if (!total) return null;
  return (
    <div>
      <p className={cn("mb-1 text-xs font-medium", tone)}>
        {label} ({total.toLocaleString()})
      </p>
      <ul className="max-h-40 space-y-0.5 overflow-y-auto rounded-md border p-2 text-xs">
        {urls.map((u) => (
          <li key={u}>
            <UrlLink url={u} compact />
          </li>
        ))}
        {total > urls.length && <li className="text-muted-foreground">+{(total - urls.length).toLocaleString()} more</li>}
      </ul>
    </div>
  );
}

function EventDetails({ e, onOpen }: { e: MonitorEvent; onOpen: (a: string, f: string) => void }) {
  const d = e.diff;
  if (e.search) {
    const a = e.search;
    return (
      <div className="space-y-3 text-sm">
        <p className="flex flex-wrap items-center gap-2">
          <span className={cn("rounded px-1.5 py-0.5 font-mono text-[0.65rem] font-semibold", a.priority === "P0" ? "bg-critical-soft text-critical" : a.priority === "P1" ? "bg-warning-soft text-warning-ink" : "bg-muted")}>{a.priority}</span>
          <span className="text-xs text-muted-foreground">Owner: {a.owner}</span>
        </p>
        <p className="break-words text-muted-foreground">{a.detail}</p>
        {a.urls.length > 0 && <UrlBlock label="Pages" urls={a.urls.slice(0, 50)} total={a.urls.length} />}
        <Link href={`/search-console?site=${encodeURIComponent(e.domain)}`} className="inline-flex items-center gap-1 text-xs font-medium text-info hover:underline">
          Open Search Console data for {e.domain} <ArrowRight className="size-3" />
        </Link>
      </div>
    );
  }
  if (e.change) {
    const c = e.change;
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">Found by the between-audits check (homepage and sitemaps only, no crawl). The next full audit shows the SEO impact.</p>
        {c.homepage.length > 0 && (
          <div className="space-y-1.5">
            {c.homepage.map((h) => (
              <div key={h.field} className="rounded-md border p-2 text-xs">
                <p className="font-medium">Homepage {h.field.toLowerCase()}</p>
                <p className="mt-1 text-muted-foreground line-through">{h.before ?? "(none)"}</p>
                <p>{h.after ?? "(none)"}</p>
              </div>
            ))}
          </div>
        )}
        {c.sitemap && (
          <div className="grid gap-3 md:grid-cols-2">
            <UrlBlock label="New in the sitemap" urls={c.sitemap.added} total={c.sitemap.addedCount} tone="text-success" />
            <UrlBlock label="Removed from the sitemap" urls={c.sitemap.removed} total={c.sitemap.removedCount} tone="text-critical" />
          </div>
        )}
      </div>
    );
  }
  if (!d) return null;
  const pc = d.pageChanges;
  return (
    <div className="space-y-4">
      {e.kind === "audit" && d.quiet && <p className="flex items-center gap-1.5 text-sm text-success"><CheckCircle2 className="size-4" /> Nothing got worse since the previous audit.</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        {d.newIssues.length > 0 && (
          <Section icon={AlertTriangle} title={`New problems (${d.newIssues.length})`} tone="text-critical">
            <IssueList items={d.newIssues} auditId={e.auditId} onOpen={onOpen} mode="new" />
          </Section>
        )}
        {d.worse.length > 0 && (
          <Section icon={ArrowDownRight} title={`Got worse (${d.worse.length})`} tone="text-warning-ink">
            <IssueList items={d.worse} auditId={e.auditId} onOpen={onOpen} mode="worse" />
          </Section>
        )}
        {d.resolved.length > 0 && (
          <Section icon={CheckCircle2} title={`Fixed (${d.resolved.length})`} tone="text-success">
            <IssueList items={d.resolved} auditId={e.auditId} onOpen={onOpen} mode="fixed" />
          </Section>
        )}
        {d.better.length > 0 && (
          <Section icon={ArrowUpRight} title={`Improved (${d.better.length})`} tone="text-success">
            <IssueList items={d.better} auditId={e.auditId} onOpen={onOpen} mode="better" />
          </Section>
        )}
      </div>
      {e.kind === "audit" && (pc.counts.broke + pc.counts.recovered + pc.counts.title + pc.counts.description + pc.counts.noindexAdded + pc.counts.found > 0) && (
        <Section icon={Sparkles} title="Page changes" tone="text-info">
          <div className="grid gap-3 lg:grid-cols-2">
            {pc.broke.length > 0 && <Changes label={`Now broken (${pc.counts.broke})`} rows={pc.broke.map((r) => ({ url: r.url, before: `HTTP ${r.before}`, after: `HTTP ${r.after}` }))} />}
            {pc.recovered.length > 0 && <Changes label={`Working again (${pc.counts.recovered})`} rows={pc.recovered.map((r) => ({ url: r.url, before: `HTTP ${r.before}`, after: `HTTP ${r.after}` }))} />}
            <Changes label={`Title changed (${pc.counts.title})`} rows={pc.title} />
            <Changes label={`Meta description changed (${pc.counts.description})`} rows={pc.description} />
            <UrlBlock label="Now marked noindex" urls={pc.noindexAdded} total={pc.counts.noindexAdded} tone="text-critical" />
            <UrlBlock label="New pages found" urls={pc.found} total={pc.counts.found} />
            <UrlBlock label="Page text changed" urls={pc.content} total={pc.counts.content} />
            <UrlBlock label="Not reached this time (removed, or beyond the crawl limit)" urls={pc.notReached} total={pc.counts.notReached} />
          </div>
        </Section>
      )}
      {d.todo.length > 0 && e.auditId && (
        <Section icon={Wrench} title={e.kind === "baseline" ? "What needs fixing, most important first" : "Still to fix, most important first"} tone="text-foreground">
          <ul className="divide-y rounded-lg border">
            {d.todo.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => onOpen(e.auditId!, t.id)} className="flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50">
                  <span className="mt-0.5 rounded bg-muted px-1.5 py-0.5 font-mono text-[0.65rem] font-semibold">{t.priority}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{t.title}</span>
                    <span className="block text-xs text-muted-foreground">{t.fix}</span>
                    {t.verdict?.tone === "good" && <span className="mt-1 inline-block rounded-full bg-success-soft px-2 py-0.5 text-[0.65rem] font-medium text-success">{t.verdict.title}</span>}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{t.count} page{t.count === 1 ? "" : "s"}</span>
                </button>
              </li>
            ))}
          </ul>
          <Link href={`/audits/${encodeURIComponent(e.auditId)}/checklist`} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-info hover:underline">
            Full Google checklist for this audit <ArrowRight className="size-3" />
          </Link>
          <Link href={`/progress?site=${encodeURIComponent(e.domain)}`} className="mt-2 ml-4 inline-flex items-center gap-1 text-xs font-medium text-info hover:underline">
            Fixed vs still open over time <ArrowRight className="size-3" />
          </Link>
        </Section>
      )}
    </div>
  );
}

const KIND_META: Record<MonitorEvent["kind"], { icon: typeof Radar; cls: string; label: string }> = {
  audit: { icon: RefreshCw, cls: "bg-info-soft text-info", label: "Daily audit" },
  baseline: { icon: Sparkles, cls: "bg-brand-soft text-brand-strong", label: "First audit" },
  change: { icon: Radar, cls: "bg-warning-soft text-warning-ink", label: "Change detected" },
  error: { icon: AlertTriangle, cls: "bg-critical-soft text-critical", label: "Problem" },
  search: { icon: SearchCheck, cls: "bg-brand-soft text-brand-strong", label: "Search Console" },
};

function EventCard({ e, fresh, onOpen, defaultOpen }: { e: MonitorEvent; fresh: boolean; onOpen: (a: string, f: string) => void; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const K = KIND_META[e.kind];
  const delta = e.diff?.score.delta ?? null;
  const expandable = e.kind !== "error";
  return (
    <li className={cn("surface overflow-hidden", fresh && "ring-1 ring-brand/40")}>
      <button type="button" onClick={() => expandable && setOpen((o) => !o)} aria-expanded={expandable ? open : undefined} className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-muted/30">
        <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg", K.cls)}>
          <K.icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{e.domain}</span>
            <span>{K.label}</span>
            <span title={formatDate(e.at)}>{formatRelative(e.at)}</span>
            {fresh && <span className="rounded-full bg-brand px-1.5 py-0.5 text-[0.6rem] font-semibold text-white">NEW</span>}
          </div>
          <p className="mt-0.5 text-sm font-medium">{e.title}</p>
        </div>
        {e.score != null && (
          <div className="flex shrink-0 items-center gap-2">
            {delta != null && delta !== 0 && (
              <span className={cn("text-xs font-semibold tabular-nums", delta > 0 ? "text-success" : "text-critical")}>
                {delta > 0 ? "+" : ""}
                {delta}
              </span>
            )}
            <GradeBadge grade={e.grade} score={e.score} />
          </div>
        )}
        {expandable && <ChevronDown className={cn("mt-1 size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />}
      </button>
      <AnimatePresence initial={false}>
        {open && expandable && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
            <div className="border-t p-4">
              <EventDetails e={e} onOpen={onOpen} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

export default function MonitoringPage() {
  const { data, error, reload } = useApi(() => api.monitor(), []);
  const [site, setSite] = useState<string>("all");
  const [adding, setAdding] = useState("");
  const [busy, setBusy] = useState(false);
  const [drawer, setDrawer] = useState<{ auditId: string; findingId: string } | null>(null);
  // Events unread when the page opened stay highlighted for this visit.
  const freshIds = useRef<Set<string> | null>(null);
  if (data && !freshIds.current) freshIds.current = new Set(data.events.filter((e) => !e.seen).map((e) => e.id));
  useEffect(() => {
    if (!data?.unseen) return;
    const t = setTimeout(() => void api.monitorSeen().catch(() => undefined), 1500);
    return () => clearTimeout(t);
  }, [data?.unseen]);
  useEffect(() => {
    const t = setInterval(reload, 30_000);
    return () => clearInterval(t);
  }, [reload]);
  const events = useMemo(() => (data ? data.events.filter((e) => site === "all" || e.domain === site) : []), [data, site]);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <LoadingSkeleton />;

  const add = async () => {
    setBusy(true);
    try {
      await api.monitorAdd(adding.trim());
      toast.success("Site added. Its first audit starts shortly.");
      setAdding("");
      reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not add the site");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={<span className="inline-flex items-center gap-1.5"><Radar className="size-3.5" /> Automatic</span>}
        title="Site monitoring"
        description="Each site is audited automatically on its schedule (daily by default), with a quick check of its homepage and sitemaps every 3 hours in between. Every new audit is compared with the previous one, so you see what broke, what was fixed and what to do next."
      />
      {!data.enabled && (
        <p className="rounded-lg border border-warning/30 bg-warning-soft p-3 text-sm">Monitoring is turned off on this server (AUDITPILOT_MONITOR=0). Remove that setting and restart to enable it.</p>
      )}
      <p className="flex items-start gap-2 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
        <Clock className="mt-0.5 size-3.5 shrink-0" />
        Scheduled audits run while AuditPilot is running. If it was closed when an audit was due, the audit starts within a minute of the next start. Your own audits always go first; scheduled ones wait their turn.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        {data.sites.map((s) => (
          <SiteCard key={s.domain} s={s} onChanged={reload} />
        ))}
      </div>
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (adding.trim()) void add();
        }}
      >
        <Input value={adding} onChange={(e) => setAdding(e.target.value)} placeholder="Monitor another site: https://example.com" className="h-9 sm:max-w-md" aria-label="Site to monitor" />
        <Button type="submit" size="sm" className="h-9 gap-1.5" disabled={busy || !adding.trim()}>
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />} Add site
        </Button>
      </form>

      <SectionCard
        title="What changed"
        description="Newest first. Open an entry to see the details; click any issue for exactly where it is and how to fix it."
        actions={
          <div className="flex flex-wrap gap-1.5">
            <FilterChip active={site === "all"} onClick={() => setSite("all")}>All sites</FilterChip>
            {data.sites.map((s) => (
              <FilterChip key={s.domain} active={site === s.domain} onClick={() => setSite(s.domain)}>{s.domain}</FilterChip>
            ))}
          </div>
        }
      >
        {events.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nothing yet. The first entries appear within a few minutes of AuditPilot starting.</p>
        ) : (
          <ul className="space-y-3">
            {events.map((e, i) => (
              <EventCard key={e.id} e={e} fresh={freshIds.current?.has(e.id) ?? false} onOpen={(auditId, findingId) => setDrawer({ auditId, findingId })} defaultOpen={i === 0} />
            ))}
          </ul>
        )}
      </SectionCard>
      {drawer && <FindingDetailDrawer auditId={drawer.auditId} findingId={drawer.findingId} onClose={() => setDrawer(null)} />}
    </div>
  );
}
