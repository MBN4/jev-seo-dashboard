"use client";
import Link from "next/link";
import { AlertOctagon, AlertTriangle, ArrowRight, Bot, CheckCircle2, FileSearch, Globe, ListChecks, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/common/metric-card";
import { SectionCard } from "@/components/common/section-card";
import { SeverityBadge } from "@/components/common/severity-badge";
import { ErrorState } from "@/components/common/error-state";
import { LoadingSkeleton } from "@/components/common/loading-skeleton";
import { SeoScoreCard } from "@/components/audit/seo-score-card";
import { ChecklistOverview } from "@/components/audit/checklist-overview";
import { useAudit } from "@/components/audit/audit-context";
import { IssueDistributionChart } from "@/components/charts/issue-distribution-chart";
import { CategoryChart } from "@/components/charts/category-chart";
import { CategoryScores } from "@/components/charts/category-scores";
import { CrawlStatusChart } from "@/components/charts/crawl-status-chart";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { formatNumber } from "@/lib/format";

export default function AuditOverviewPage() {
  const { audit } = useAudit();
  const { data: ov, error, reload } = useApi(() => api.overview(audit.id), [audit.id]);
  const checklist = useApi(() => api.checklist(audit.id), [audit.id]);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!ov) return <LoadingSkeleton />;
  const s = ov.bySeverity;
  const base = `/audits/${encodeURIComponent(audit.id)}`;
  const aiAllowed = Object.values(ov.site.aiBots).filter(Boolean).length;
  return (
    <div className="space-y-6">
      {ov.site.limits?.hit_page_cap && (
        <div role="status" className="flex flex-col gap-3 rounded-xl border border-warning/30 bg-warning-soft/60 p-4 text-sm sm:flex-row sm:items-center">
          <AlertTriangle className="size-5 shrink-0 text-warning" aria-hidden />
          <p className="flex-1">
            <span className="font-medium">This crawl stopped at its page limit ({ov.site.limits.max_pages} pages).</span>{" "}
            {ov.site.sitemapUrls ? `The site's sitemaps list ${ov.site.sitemapUrls.toLocaleString()} URLs, so most of the site was not audited.` : "The site has more pages than were audited."}
          </p>
          <Button asChild size="sm" variant="outline" className="shrink-0">
            <Link href={`/audits/new?url=${encodeURIComponent(audit.url)}&maxPages=${Math.min(2000, Math.max((ov.site.limits.max_pages ?? 60) * 2, ov.site.sitemapUrls ?? 0))}`}>
              Re-run with a higher limit
            </Link>
          </Button>
        </div>
      )}
      {checklist.data ? <ChecklistOverview data={checklist.data} auditId={audit.id} /> : <LoadingSkeleton variant="panel" />}
      <div className="grid gap-4 lg:grid-cols-3">
        <SeoScoreCard scores={ov.scores} />
        <div className="grid grid-cols-2 content-start gap-4 lg:col-span-2 xl:grid-cols-4">
          <MetricCard index={0} label="Pages crawled" value={formatNumber(ov.counts.pages)} hint={`${ov.counts.htmlPages} HTML pages`} icon={Globe} />
          <MetricCard index={1} label="Total findings" value={ov.counts.findings} icon={FileSearch} />
          <MetricCard index={2} label="Critical findings" value={s.critical} hint={`${s.high} high`} icon={AlertOctagon} tone="critical" />
          <MetricCard index={3} label="Warnings" value={s.medium} hint="Medium severity" icon={AlertTriangle} tone="warning" />
          <MetricCard index={4} label="Passed checks" value={ov.counts.passedRules} icon={CheckCircle2} tone="success" />
          <MetricCard index={5} label="Recommended actions" value={ov.counts.actions} icon={ListChecks} />
          <MetricCard index={6} label="Quick wins" value={ov.counts.quickWins} hint="High impact, low effort" icon={Zap} tone="info" />
          <MetricCard index={7} label="AI pages judged" value={ov.ai.available ? ov.ai.judged : "—"} hint={ov.ai.available ? `${ov.ai.notJudged} not judged` : "AI judgments not available"} icon={Bot} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <SectionCard className="lg:col-span-3" title="Most important issues" description="Highest-priority actions ranked by the engine" actions={<Button variant="ghost" size="sm" asChild><Link href={`${base}/recommendations`}>All actions <ArrowRight className="size-3.5" /></Link></Button>} bodyClassName="p-0">
          {ov.topActions.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No actions: the engine found nothing to fix.</p>
          ) : (
            <ul className="divide-y">
              {ov.topActions.map((x) => (
                <li key={x.action_id} className="flex items-start gap-3 px-4 py-3">
                  <span className="mt-0.5 rounded bg-muted px-1.5 py-0.5 font-mono text-[0.7rem] font-medium">{x.priority}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{x.title}</p>
                    <p className="truncate text-xs text-muted-foreground" title={x.evidence}>{x.evidence}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <SeverityBadge severity={x.severity} />
                    <span className="text-[0.7rem] text-muted-foreground tabular">impact {x.impact} · effort {x.effort}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
        <SectionCard className="lg:col-span-2" title="Category scores" description="Weighted into the overall score">
          <CategoryScores categories={ov.scores.categories} names={ov.scores.category_names} weights={ov.scores.weights} notes={ov.scores.notes} />
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Findings by severity"><IssueDistributionChart counts={s} /></SectionCard>
        <SectionCard title="Findings by category">{ov.byCategory.length ? <CategoryChart data={ov.byCategory} /> : <p className="text-sm text-muted-foreground">No findings.</p>}</SectionCard>
        <SectionCard title="Crawl statistics"><CrawlStatusChart buckets={ov.statusBuckets} /></SectionCard>
        <SectionCard title="Crawlability snapshot">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            {[
              ["HTTPS", ov.site.https == null ? "—" : ov.site.https ? "Yes" : "No"],
              ["robots.txt", ov.site.robotsPresent == null ? "—" : ov.site.robotsPresent ? "Present" : "Missing"],
              ["Sitemap URLs", formatNumber(ov.site.sitemapUrls)],
              ["Sitemap files", formatNumber(ov.site.sitemapFiles)],
              ["llms.txt", ov.site.llmsTxt == null ? "—" : ov.site.llmsTxt ? "Present" : "Missing"],
              ["AI crawlers allowed", `${aiAllowed} of ${Object.keys(ov.site.aiBots).length}`],
              ["Search bots allowed", Object.entries(ov.site.searchBots).map(([k, v]) => `${k} ${v ? "✓" : "✗"}`).join(", ") || "—"],
              ["JS rendering", ov.site.render?.browser_available ? "Available" : ov.site.render?.browser_available === false ? "Unavailable" : "Not needed / not checked"],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </SectionCard>
      </div>
    </div>
  );
}
