"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertOctagon, AlertTriangle, CheckCircle2, FileSearch, Globe, Info, ListChecks, PlusCircle, Radar, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/page-header";
import { MetricCard } from "@/components/common/metric-card";
import { SectionCard } from "@/components/common/section-card";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { LoadingSkeleton } from "@/components/common/loading-skeleton";
import { StatusBadge } from "@/components/common/status-badge";
import { SeoScoreCard } from "@/components/audit/seo-score-card";
import { AuditHistoryTable } from "@/components/audit/audit-history-table";
import { IssueDistributionChart } from "@/components/charts/issue-distribution-chart";
import { CategoryChart } from "@/components/charts/category-chart";
import { ScoreHistoryChart } from "@/components/charts/score-history-chart";
import { CrawlStatusChart } from "@/components/charts/crawl-status-chart";
import { api } from "@/lib/api";
import { useApi } from "@/hooks/use-api";
import { formatDate, formatNumber } from "@/lib/format";
import type { HistoryData, OverviewData } from "@/lib/api-types";

export default function OverviewPage() {
  const audits = useApi(() => api.listAudits({ pageSize: 100 }), []);
  const latest = useMemo(() => audits.data?.items.find((a) => a.hasResults && a.status === "completed") ?? null, [audits.data]);
  const [ov, setOv] = useState<OverviewData | null>(null);
  const [hist, setHist] = useState<HistoryData | null>(null);
  const [ovErr, setOvErr] = useState<Error | null>(null);

  useEffect(() => {
    if (!latest) return;
    setOv(null);
    api.overview(latest.id).then(setOv).catch(setOvErr);
    api.history(latest.domain).then(setHist).catch(() => setHist(null));
  }, [latest]);

  const header = (
    <PageHeader
      title="SEO Overview"
      description="Monitor website health, discover technical issues, and prioritize SEO improvements."
      actions={
        <Button asChild>
          <Link href="/audits/new">
            <PlusCircle className="size-4" /> New Audit
          </Link>
        </Button>
      }
    />
  );

  if (audits.loading && !audits.data) return <div className="space-y-6">{header}<LoadingSkeleton /></div>;
  if (audits.error) return <div className="space-y-6">{header}<ErrorState error={audits.error} onRetry={audits.reload} /></div>;

  const running = audits.data?.items.filter((a) => a.status === "running" || a.status === "queued") ?? [];

  if (!latest) {
    return (
      <div className="space-y-6">
        {header}
        {running.length > 0 && <RunningBanner items={running} />}
        <SectionCard>
          <EmptyState
            icon={Radar}
            title="No completed audits yet"
            description={
              <>Run your first audit to see scores, findings and recommendations here. Existing folders in <code className="rounded bg-muted px-1">jev-seo-reports/</code> are picked up automatically.</>
            }
            action={
              <Button asChild>
                <Link href="/audits/new"><PlusCircle className="size-4" /> Start an audit</Link>
              </Button>
            }
          />
        </SectionCard>
      </div>
    );
  }

  const sev = ov?.bySeverity;
  return (
    <div className="space-y-6">
      {header}
      {running.length > 0 && <RunningBanner items={running} />}

      <SectionCard bodyClassName="p-0" className="overflow-hidden">
        <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["Domain", <Link key="d" href={`/audits/${encodeURIComponent(latest.id)}`} className="font-medium hover:underline">{latest.domain}</Link>],
            ["Last audit", formatDate(latest.finishedAt)],
            ["Status", <StatusBadge key="s" status={latest.status} />],
            ["Pages crawled", formatNumber(latest.pagesCrawled)],
            ["Sitemap URLs", formatNumber(latest.sitemapUrls)],
            ["Rules evaluated", formatNumber(latest.rulesEvaluated)],
          ].map(([label, value]) => (
            <div key={label as string} className="min-w-0 bg-card px-4 py-3">
              <p className="text-xs text-muted-foreground">{label as string}</p>
              <div className="mt-0.5 truncate text-sm">{value}</div>
            </div>
          ))}
        </div>
      </SectionCard>

      {ovErr && <ErrorState error={ovErr} />}
      {!ov ? (
        <LoadingSkeleton variant="cards" />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-1"><SeoScoreCard scores={ov.scores} /></div>
            <div className="grid grid-cols-2 content-start gap-4 lg:col-span-2 xl:grid-cols-4">
              <MetricCard index={0} label="Pages crawled" value={formatNumber(ov.counts.pages)} hint={`${ov.counts.htmlPages} HTML pages (200)`} icon={Globe} />
              <MetricCard index={1} label="Total findings" value={formatNumber(ov.counts.findings)} icon={FileSearch} />
              <MetricCard index={2} label="Critical issues" value={sev!.critical} hint={`${sev!.high} high severity`} icon={AlertOctagon} tone="critical" />
              <MetricCard index={3} label="Warnings" value={sev!.medium} hint="Medium severity" icon={AlertTriangle} tone="warning" />
              <MetricCard index={4} label="Informational" value={sev!.low + sev!.info} hint={`${sev!.low} low · ${sev!.info} info`} icon={Info} tone="info" />
              <MetricCard index={5} label="Passed checks" value={ov.counts.passedRules} hint="Rules with no issue detected" icon={CheckCircle2} tone="success" />
              <MetricCard index={6} label="Recommended actions" value={ov.counts.actions} hint={`${ov.counts.quickWins} quick wins`} icon={ListChecks} />
              <MetricCard index={7} label="Requests made" value={formatNumber(ov.site.requests)} hint="During the crawl" icon={ScrollText} />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Findings by severity" description="All findings in the latest audit">
              <IssueDistributionChart counts={ov.bySeverity} />
            </SectionCard>
            <SectionCard title="Findings by category" description="Engine categories (jevseo/checks.py)">
              {ov.byCategory.length ? <CategoryChart data={ov.byCategory} /> : <EmptyState compact icon={CheckCircle2} title="No findings" />}
            </SectionCard>
            <SectionCard title="SEO score history" description={`Completed audits of ${latest.domain}`}>
              {hist && hist.points.length >= 2 ? (
                <ScoreHistoryChart points={hist.points} />
              ) : (
                <EmptyState compact icon={Radar} title="Not enough history yet" description="Run another audit of this domain to see how the score changes over time." />
              )}
            </SectionCard>
            <SectionCard title="Crawl statistics" description="Fetched URLs by HTTP status">
              <CrawlStatusChart buckets={ov.statusBuckets} />
              <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div><dt className="text-muted-foreground">Crawl time</dt><dd className="font-medium tabular">{ov.run.timings.crawl ?? "—"} s</dd></div>
                <div><dt className="text-muted-foreground">Page cap hit</dt><dd className="font-medium">{ov.site.limits?.hit_page_cap ? "Yes" : "No"}</dd></div>
                <div><dt className="text-muted-foreground">Time budget hit</dt><dd className="font-medium">{ov.site.limits?.hit_time_budget ? "Yes" : "No"}</dd></div>
              </dl>
            </SectionCard>
          </div>
        </>
      )}

      <SectionCard
        title="Recent audits"
        actions={<Button variant="outline" size="sm" asChild><Link href="/audits">View all</Link></Button>}
        bodyClassName="p-0"
      >
        <AuditHistoryTable audits={audits.data!.items.slice(0, 5)} compact />
      </SectionCard>
    </div>
  );
}

function RunningBanner({ items }: { items: Array<{ id: string; domain: string }> }) {
  return (
    <div role="status" className="flex flex-wrap items-center gap-3 rounded-lg border border-info/20 bg-info-soft px-4 py-3 text-sm">
      <span className="font-medium text-info">Audit in progress:</span>
      {items.map((r) => (
        <Link key={r.id} href={`/audits/${encodeURIComponent(r.id)}/progress`} className="text-info underline-offset-2 hover:underline">
          {r.domain}
        </Link>
      ))}
    </div>
  );
}
