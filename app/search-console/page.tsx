"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  AlertOctagon, AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2, ExternalLink, Eye, Info, Loader2, MousePointerClick, Percent, RefreshCw, Search, SearchCheck, Settings, Target, TrendingDown, TrendingUp, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/common/page-header";
import { SectionCard } from "@/components/common/section-card";
import { ErrorState } from "@/components/common/error-state";
import { LoadingSkeleton } from "@/components/common/loading-skeleton";
import { FilterChip } from "@/components/common/filter-chip";
import { UrlLink } from "@/components/audit/finding-breakdown-view";
import { ChartTooltip } from "@/components/charts/chart-tooltip";
import { useApi } from "@/hooks/use-api";
import { api, ApiError, type GscSiteView } from "@/lib/api";
import { formatDate, formatRelative } from "@/lib/format";
import { coverageHelp, type MetricRow } from "@/lib/gsc-insights";
import { cn } from "@/lib/utils";

const nf = (n: number) => Math.round(n).toLocaleString();
const pct = (n: number) => `${(n * 100).toFixed(n < 0.1 ? 1 : 0)}%`;
const pos = (n: number | null | undefined) => (n == null ? "—" : n.toFixed(1));

function Delta({ v, invert, fmt, min = 0.0005 }: { v: number | null | undefined; invert?: boolean; fmt: (n: number) => string; min?: number }) {
  if (v == null || !Number.isFinite(v) || Math.abs(v) < min) return <span className="text-xs text-muted-foreground">no change</span>;
  const good = invert ? v < 0 : v > 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-semibold", good ? "text-success" : "text-critical")}>
      {v > 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
      {fmt(Math.abs(v))}
    </span>
  );
}

function Kpi({ icon: Icon, label, value, delta, hint }: { icon: typeof Eye; label: string; value: string; delta: React.ReactNode; hint: string }) {
  return (
    <div className="surface p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      <div className="mt-0.5 flex items-center gap-1.5">
        {delta}
        <span className="text-[0.7rem] text-muted-foreground">{hint}</span>
      </div>
    </div>
  );
}

type Col = "clicks" | "impressions" | "ctr" | "position";

function MetricTable({ rows, keyLabel, isUrl, emptyText, extra }: { rows: MetricRow[]; keyLabel: string; isUrl?: boolean; emptyText?: string; extra?: (r: MetricRow) => React.ReactNode }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Col>("clicks");
  const [limit, setLimit] = useState(25);
  const list = useMemo(() => {
    const f = q ? rows.filter((r) => r.key.toLowerCase().includes(q.toLowerCase())) : rows;
    return [...f].sort((a, b) => (sort === "position" ? a.position - b.position : b[sort] - a[sort]));
  }, [rows, q, sort]);
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted-foreground">{emptyText ?? "No data for this period."}</p>;
  const Th = ({ c, children }: { c: Col; children: React.ReactNode }) => (
    <th className="px-3 py-2 text-right">
      <button type="button" onClick={() => setSort(c)} className={cn("font-semibold uppercase hover:text-foreground", sort === c && "text-foreground")}>{children}</button>
    </th>
  );
  return (
    <div className="space-y-2">
      {rows.length > 10 && (
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Filter ${keyLabel.toLowerCase()}…`} className="h-8 pl-8 text-sm" />
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-[0.7rem] text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-semibold uppercase">{keyLabel}</th>
              <Th c="clicks">Clicks</Th>
              <Th c="impressions">Impr.</Th>
              <Th c="ctr">CTR</Th>
              <Th c="position">Position</Th>
              {extra && <th className="px-3 py-2 text-left font-semibold uppercase">What to do</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {list.slice(0, limit).map((r) => (
              <tr key={r.key} className="hover:bg-muted/40">
                <td className="max-w-[26rem] px-3 py-2">{isUrl ? <UrlLink url={r.key} compact /> : <span className="break-words">{r.key}</span>}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {nf(r.clicks)}
                  {r.prevClicks != null && r.prevClicks !== r.clicks && (
                    <span className={cn("ml-1 text-[0.7rem]", r.clicks > r.prevClicks ? "text-success" : "text-critical")}>
                      {r.clicks > r.prevClicks ? "+" : ""}
                      {nf(r.clicks - r.prevClicks)}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{nf(r.impressions)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{pct(r.ctr)}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {pos(r.position)}
                  {!!r.prevPosition && !!r.prevImpressions && Math.abs(r.prevPosition - r.position) >= 0.5 && (
                    <span className={cn("ml-1 text-[0.7rem]", r.position < r.prevPosition ? "text-success" : "text-critical")}>{r.position < r.prevPosition ? "▲" : "▼"}{Math.abs(r.prevPosition - r.position).toFixed(1)}</span>
                  )}
                </td>
                {extra && <td className="px-3 py-2 text-xs text-muted-foreground">{extra(r)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Showing {Math.min(limit, list.length)} of {list.length.toLocaleString()} · change shown against the previous period of the same length
        </span>
        {list.length > limit && (
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setLimit((l) => l + 50)}>
            Show more
          </Button>
        )}
      </div>
    </div>
  );
}

function Explain({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 flex gap-2 rounded-lg bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground"><Info className="mt-0.5 size-3.5 shrink-0" /> <span>{children}</span></p>;
}

function Trend({ data, showImpr }: { data: MetricRow[]; showImpr: boolean }) {
  const rows = data.map((r) => ({ date: r.key, clicks: r.clicks, impressions: r.impressions }));
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 10, right: 6, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="gsc-clicks" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
          <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} minTickGap={32} tickFormatter={(d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric" })} />
          <YAxis yAxisId="c" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} allowDecimals={false} />
          {showImpr && <YAxis yAxisId="i" orientation="right" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} allowDecimals={false} />}
          <Tooltip content={<ChartTooltip labelFormatter={(l) => formatDate(`${l}T00:00:00Z`, false)} />} />
          <Area yAxisId="c" type="monotone" dataKey="clicks" name="Clicks" stroke="var(--brand)" strokeWidth={2.2} fill="url(#gsc-clicks)" dot={false} animationDuration={700} />
          {showImpr && <Line yAxisId="i" type="monotone" dataKey="impressions" name="Impressions" stroke="var(--info)" strokeWidth={1.6} dot={false} animationDuration={700} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function Verdict({ v }: { v: string }) {
  return v === "PASS" ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[0.7rem] font-medium text-success"><CheckCircle2 className="size-3" /> Indexed</span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-critical-soft px-2 py-0.5 text-[0.7rem] font-medium text-critical"><XCircle className="size-3" /> Not indexed</span>
  );
}

function SiteView({ v, onSync, syncing }: { v: GscSiteView; onSync: () => void; syncing: boolean }) {
  const [showImpr, setShowImpr] = useState(true);
  const [full, setFull] = useState(false);
  if (!v.synced || !v.kpis) {
    return (
      <SectionCard>
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          {v.error ? <AlertTriangle className="size-8 text-critical" /> : <RefreshCw className="size-8 text-muted-foreground" />}
          <p className="max-w-xl text-sm">{v.error ?? "Not synced yet. The first sync runs automatically within a few minutes, or start it now."}</p>
          <Button size="sm" onClick={onSync} disabled={syncing}>{syncing ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />} Sync now</Button>
        </div>
      </SectionCard>
    );
  }
  const k = v.kpis;
  const o = v.opportunities;
  const ix = v.indexing;
  const label = `vs previous ${v.days} days`;
  return (
    <div className="space-y-6">
      {v.error && (
        <p className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-soft p-3 text-sm"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-ink" /> Last sync failed: {v.error}. Showing data from {formatRelative(v.fetchedAt)}.</p>
      )}
      {(v.alerts?.length ?? 0) > 0 && (
        <div className="space-y-2">
          {v.alerts!.map((a) => (
            <div key={a.id} className={cn("flex gap-3 rounded-xl border p-3.5", a.priority === "P0" ? "border-critical/30 bg-critical-soft/70" : a.priority === "P1" ? "border-warning/30 bg-warning-soft/70" : "border-info/25 bg-info-soft/60")}>
              {a.priority === "P0" ? <AlertOctagon className="mt-0.5 size-5 shrink-0 text-critical" /> : <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning-ink" />}
              <div className="min-w-0 text-sm">
                <p className="font-semibold">
                  <span className="mr-2 rounded bg-background/60 px-1.5 py-0.5 font-mono text-[0.65rem]">{a.priority}</span>
                  {a.title} <span className="font-normal text-muted-foreground">· {a.owner}</span>
                </p>
                <p className="mt-0.5 text-[0.82rem] break-words text-muted-foreground">{a.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={MousePointerClick} label="Clicks from Google" value={nf(k.current.clicks)} delta={<Delta v={k.change.clicks} fmt={pct} />} hint={label} />
        <Kpi icon={Eye} label="Impressions" value={nf(k.current.impressions)} delta={<Delta v={k.change.impressions} fmt={pct} />} hint={label} />
        <Kpi icon={Percent} label="Average CTR" value={pct(k.current.ctr)} delta={<Delta v={k.change.ctr} fmt={(n) => `${(n * 100).toFixed(1)} pts`} />} hint={label} />
        <Kpi icon={Target} label="Average position" value={pos(k.current.position)} delta={<Delta v={k.change.position} invert min={0.05} fmt={(n) => n.toFixed(1)} />} hint={`lower is better · ${label}`} />
      </div>
      <SectionCard
        title="Search traffic over time"
        description={`${formatDate(`${k.period.start}T00:00:00Z`, false)} – ${formatDate(`${k.period.end}T00:00:00Z`, false)}. The last 2–3 days are still being finalised by Google.`}
        actions={
          <div className="flex gap-1.5">
            <FilterChip active={showImpr} onClick={() => setShowImpr((s) => !s)}>Impressions</FilterChip>
            <FilterChip active={full} onClick={() => setFull((s) => !s)}>16 months</FilterChip>
          </div>
        }
      >
        <Trend data={full ? (v.history ?? []) : (v.series ?? [])} showImpr={showImpr} />
      </SectionCard>

      {o && (
        <SectionCard title="Opportunities" description="Where more traffic is most likely, worked out from your own Search Console data.">
          <Tabs defaultValue="striking">
            <TabsList className="mb-3 flex h-auto flex-wrap">
              <TabsTrigger value="striking">Push to page 1 ({o.striking.length})</TabsTrigger>
              <TabsTrigger value="ctr">Low CTR ({o.lowCtr.length})</TabsTrigger>
              <TabsTrigger value="losing">Losing ({o.losingQueries.length + o.losingPages.length})</TabsTrigger>
              <TabsTrigger value="rising">Rising ({o.risingQueries.length})</TabsTrigger>
              <TabsTrigger value="new">New queries ({o.newQueries.length})</TabsTrigger>
              <TabsTrigger value="cannibal">Competing pages ({o.cannibal.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="striking">
              <Explain>Searches where you rank on positions 4–20 with real demand. Small improvements here bring the most new clicks: strengthen the ranking page (content depth, title, internal links from related pages).</Explain>
              <MetricTable rows={o.striking} keyLabel="Query" emptyText="No queries close to the top right now." extra={(r) => (r.position > 10 ? "Page 2: aim for page 1" : "Page 1: aim for the top 3")} />
            </TabsContent>
            <TabsContent value="ctr">
              <Explain>Queries and pages shown often on page 1 but clicked far less than usual for their position (benchmark estimate). Rewrite the title and meta description to match what searchers want.</Explain>
              <MetricTable rows={o.lowCtr} keyLabel="Query or page" isUrl={false} emptyText="No low-CTR outliers." extra={(r) => `≈${nf((r as MetricRow & { missedClicks: number }).missedClicks)} clicks missed (expected ${pct((r as MetricRow & { expectedCtr: number }).expectedCtr)})`} />
            </TabsContent>
            <TabsContent value="losing">
              <Explain>Biggest click losses against the previous period. Check whether the page changed, lost rankings to a competitor, or dropped out of the index (see Index status below).</Explain>
              <div className="grid gap-4 xl:grid-cols-2">
                <MetricTable rows={o.losingQueries} keyLabel="Query" emptyText="No queries lost clicks." />
                <MetricTable rows={o.losingPages} keyLabel="Page" isUrl emptyText="No pages lost clicks." />
              </div>
            </TabsContent>
            <TabsContent value="rising">
              <Explain>Queries gaining clicks. Build on them: link to the ranking page from related pages and cover the topic more fully.</Explain>
              <MetricTable rows={o.risingQueries} keyLabel="Query" emptyText="No rising queries this period." />
            </TabsContent>
            <TabsContent value="new">
              <Explain>Searches that showed your site this period but not the period before. Worth a dedicated section or page if they match your offer.</Explain>
              <MetricTable rows={o.newQueries} keyLabel="Query" emptyText="No new queries." />
            </TabsContent>
            <TabsContent value="cannibal">
              <Explain>One search where several of your pages split the impressions (last 28 days). Google may rotate between them and rank none well. Pick one page for the search, link the others to it, or merge them.</Explain>
              {o.cannibal.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No competing pages found.</p>
              ) : (
                <ul className="space-y-2">
                  {o.cannibal.map((c) => (
                    <li key={c.query} className="rounded-xl border p-3">
                      <p className="text-sm font-medium">“{c.query}” <span className="font-normal text-muted-foreground">· {nf(c.total)} impressions</span></p>
                      <ul className="mt-1.5 space-y-1">
                        {c.pages.map((p) => (
                          <li key={p.page} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <UrlLink url={p.page} compact />
                            <span className="text-muted-foreground tabular-nums">{nf(p.impressions)} impr · pos {pos(p.position)} · {nf(p.clicks)} clicks</span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
          </Tabs>
        </SectionCard>
      )}

      <SectionCard title="Performance details" description={`${label.replace("vs", "Compared with the")}. Sort by any column.`}>
        <Tabs defaultValue="queries">
          <TabsList className="mb-3 flex h-auto flex-wrap">
            <TabsTrigger value="queries">Queries</TabsTrigger>
            <TabsTrigger value="pages">Pages</TabsTrigger>
            <TabsTrigger value="countries">Countries</TabsTrigger>
            <TabsTrigger value="devices">Devices</TabsTrigger>
            <TabsTrigger value="appearance">Search appearance</TabsTrigger>
            <TabsTrigger value="types">Search types</TabsTrigger>
          </TabsList>
          <TabsContent value="queries"><MetricTable rows={v.queries ?? []} keyLabel="Query" /></TabsContent>
          <TabsContent value="pages"><MetricTable rows={v.pages ?? []} keyLabel="Page" isUrl /></TabsContent>
          <TabsContent value="countries"><Explain>Last 28 days. Country codes are ISO 3166 (for example USA, GBR, IND).</Explain><MetricTable rows={(v.countries ?? []).map((r) => ({ ...r, key: r.key.toUpperCase() }))} keyLabel="Country" /></TabsContent>
          <TabsContent value="devices"><Explain>Last 28 days.</Explain><MetricTable rows={(v.devices ?? []).map((r) => ({ ...r, key: r.key.charAt(0) + r.key.slice(1).toLowerCase() }))} keyLabel="Device" /></TabsContent>
          <TabsContent value="appearance"><Explain>Last 28 days. Rich results and other special result types your pages appeared as.</Explain><MetricTable rows={v.appearance ?? []} keyLabel="Appearance" emptyText="No special search appearances recorded." /></TabsContent>
          <TabsContent value="types"><Explain>Last 28 days, by Google surface: web, image, video, news and Discover (where available for the property).</Explain><MetricTable rows={v.searchTypes ?? []} keyLabel="Search type" /></TabsContent>
        </Tabs>
      </SectionCard>

      {ix && (
        <SectionCard
          title="Index status (URL Inspection)"
          description={`Google’s own answer for your homepage and the pages that bring the most clicks (${ix.inspected} checked, refreshed daily).`}
        >
          <div className="mb-4 grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Indexed</p><p className="text-xl font-semibold text-success tabular-nums">{ix.indexed}</p></div>
            <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Not indexed</p><p className={cn("text-xl font-semibold tabular-nums", ix.notIndexed ? "text-critical" : "")}>{ix.notIndexed}</p></div>
            <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Google picked another canonical</p><p className={cn("text-xl font-semibold tabular-nums", ix.canonicalMismatch.length ? "text-warning-ink" : "")}>{ix.canonicalMismatch.length}</p></div>
            <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Rich result errors</p><p className={cn("text-xl font-semibold tabular-nums", ix.richIssues.length ? "text-warning-ink" : "")}>{ix.richIssues.length}</p></div>
          </div>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-[0.7rem] text-muted-foreground uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Page</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Google says</th>
                  <th className="px-3 py-2 text-left">Last crawl</th>
                  <th className="px-3 py-2 text-left">Canonical</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {ix.list.map((i) => {
                  const mismatch = i.googleCanonical && i.userCanonical && i.googleCanonical.replace(/\/$/, "") !== i.userCanonical.replace(/\/$/, "");
                  return (
                    <tr key={i.url} className="align-top hover:bg-muted/40">
                      <td className="max-w-[22rem] px-3 py-2">
                        <UrlLink url={i.url} compact />
                        {i.link && (
                          <a href={i.link} target="_blank" rel="noreferrer noopener" className="mt-0.5 flex items-center gap-1 text-[0.7rem] text-info hover:underline">
                            Open in Search Console <ExternalLink className="size-3" />
                          </a>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Verdict v={i.verdict} />
                        {i.prevVerdict === "PASS" && i.verdict !== "PASS" && <p className="mt-1 text-[0.7rem] font-medium text-critical">Dropped since last check</p>}
                      </td>
                      <td className="max-w-[18rem] px-3 py-2 text-xs">
                        <p className="font-medium">{i.coverageState ?? "—"}</p>
                        {coverageHelp(i.coverageState) && <p className="text-muted-foreground">{coverageHelp(i.coverageState)}</p>}
                        {i.robotsTxtState === "DISALLOWED" && <p className="text-critical">Blocked by robots.txt</p>}
                        {i.pageFetchState && i.pageFetchState !== "SUCCESSFUL" && <p className="text-critical">Fetch: {i.pageFetchState.toLowerCase().replace(/_/g, " ")}</p>}
                        {i.richResults?.items.map((r) => (
                          <p key={r.type} className={r.issues.length ? "text-warning-ink" : "text-muted-foreground"}>
                            {r.type}: {r.issues.length ? `${r.issues.length} issue(s)` : "valid"}
                          </p>
                        ))}
                      </td>
                      <td className="px-3 py-2 text-xs whitespace-nowrap text-muted-foreground">
                        {i.lastCrawlTime ? formatRelative(i.lastCrawlTime) : "never"}
                        {i.crawledAs && <p>{i.crawledAs === "MOBILE" ? "smartphone" : "desktop"} bot</p>}
                      </td>
                      <td className="max-w-[16rem] px-3 py-2 text-xs">
                        {mismatch ? (
                          <span className="text-warning-ink">Google uses <UrlLink url={i.googleCanonical!} compact /></span>
                        ) : (
                          <span className="text-muted-foreground">{i.googleCanonical ? "matches yours" : "—"}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      <SectionCard title="Sitemaps in Search Console" description="What Google reports for the sitemaps you submitted.">
        {(v.sitemaps ?? []).length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">No sitemaps submitted in Search Console for this property. Submit your sitemap there (Indexing → Sitemaps).</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-[0.7rem] text-muted-foreground uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Sitemap</th>
                  <th className="px-3 py-2 text-right">URLs</th>
                  <th className="px-3 py-2 text-right">Errors</th>
                  <th className="px-3 py-2 text-right">Warnings</th>
                  <th className="px-3 py-2 text-left">Last read by Google</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {v.sitemaps!.map((s) => (
                  <tr key={s.path}>
                    <td className="px-3 py-2"><UrlLink url={s.path} compact />{s.isPending && <span className="ml-2 text-[0.7rem] text-muted-foreground">pending</span>}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.submitted ? nf(s.submitted) : "—"}</td>
                    <td className={cn("px-3 py-2 text-right tabular-nums", s.errors && "font-semibold text-critical")}>{s.errors}</td>
                    <td className={cn("px-3 py-2 text-right tabular-nums", s.warnings && "text-warning-ink")}>{s.warnings}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{s.lastDownloaded ? formatRelative(s.lastDownloaded) : "never"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
      <p className="text-xs text-muted-foreground">
        Google&apos;s API does not offer the Page indexing totals, Core Web Vitals, Links, Manual actions or Security issues reports; check those in{" "}
        <a href="https://search.google.com/search-console" target="_blank" rel="noreferrer noopener" className="text-info hover:underline">Search Console</a>. Traffic from other channels (ads, social, direct) needs Google Analytics, not Search Console.
      </p>
    </div>
  );
}

export default function SearchConsolePage() {
  const { data: ov, error, reload } = useApi(() => api.gsc(), []);
  const [domain, setDomain] = useState<string | null>(null);
  const [days, setDays] = useState(28);
  const [syncing, setSyncing] = useState(false);
  useEffect(() => {
    if (!domain && ov?.sites.length) {
      const q = new URLSearchParams(window.location.search).get("site");
      setDomain(ov.sites.find((s) => s.domain === q)?.domain ?? ov.sites[0].domain);
    }
  }, [ov, domain]);
  const site = useApi(domain ? () => api.gscSite(domain, days) : null, [domain, days]);

  const sync = async () => {
    if (!domain) return;
    setSyncing(true);
    try {
      const r = await api.gscSync(domain);
      if (r.ok) toast.success(r.newAlerts?.length ? `Synced. ${r.newAlerts.length} new alert(s).` : "Synced");
      else toast.error(r.error ?? "Sync failed");
      site.reload();
      reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!ov) return <LoadingSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={<span className="inline-flex items-center gap-1.5"><SearchCheck className="size-3.5" /> Google Search Console</span>}
        title="Search Console"
        description="Real Google data for your sites: how often they appear and get clicked, for which searches and pages, and whether Google has indexed them. Synced automatically once a day."
        actions={
          ov.connection.configured && domain ? (
            <Button size="sm" variant="outline" onClick={sync} disabled={syncing}>
              {syncing ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />} Sync now
            </Button>
          ) : null
        }
      />
      {!ov.connection.configured ? (
        <SectionCard>
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <SearchCheck className="size-10 text-brand" />
            <p className="text-lg font-semibold">Connect Google Search Console</p>
            <p className="max-w-lg text-sm text-muted-foreground">Create a Google service account, add it as a user on each of your Search Console properties, and paste its key in Settings. It takes about 5 minutes; the steps are listed there.</p>
            <Button asChild>
              <Link href="/settings#gsc"><Settings className="size-4" /> Set up in Settings</Link>
            </Button>
          </div>
        </SectionCard>
      ) : (
        <>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {ov.sites.map((s) => {
                const c = s.kpis?.change.clicks;
                return (
                  <button
                    key={s.domain}
                    type="button"
                    onClick={() => setDomain(s.domain)}
                    className={cn("surface flex min-w-40 flex-col items-start rounded-xl px-3 py-2 text-left transition-shadow", domain === s.domain ? "ring-2 ring-brand" : "hover:ring-1 hover:ring-border")}
                  >
                    <span className="flex w-full items-center justify-between gap-2 text-sm font-semibold">
                      {s.domain}
                      {s.alerts > 0 && <span className="rounded-full bg-critical px-1.5 text-[0.6rem] font-bold text-white">{s.alerts}</span>}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {s.kpis ? (
                        <>
                          {nf(s.kpis.current.clicks)} clicks / 28 d{" "}
                          {c != null && Math.abs(c) >= 0.005 && <span className={c > 0 ? "text-success" : "text-critical"}>{c > 0 ? <TrendingUp className="inline size-3" /> : <TrendingDown className="inline size-3" />} {pct(Math.abs(c))}</span>}
                        </>
                      ) : s.error ? (
                        <span className="text-critical">needs access</span>
                      ) : (
                        "not synced yet"
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-1.5">
              {[7, 28, 90].map((d) => (
                <FilterChip key={d} active={days === d} onClick={() => setDays(d)}>Last {d} days</FilterChip>
              ))}
            </div>
          </div>
          {site.data && site.data.domain === domain && (
            <p className="text-xs text-muted-foreground">
              {site.data.property && <>Property <code>{site.data.property}</code> · </>}
              {site.data.fetchedAt ? `synced ${formatRelative(site.data.fetchedAt)}` : "not synced yet"}
              {site.data.endDate && ` · data up to ${formatDate(`${site.data.endDate}T00:00:00Z`, false)}`}
            </p>
          )}
          {site.error && <ErrorState error={site.error} onRetry={site.reload} />}
          {!site.data && !site.error && <LoadingSkeleton />}
          {site.data && site.data.domain === domain && <SiteView v={site.data} onSync={sync} syncing={syncing} />}
        </>
      )}
    </div>
  );
}
