"use client";
import Link from "next/link";
import { AlertTriangle, Gauge, KeyRound, OctagonX, Smartphone, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/common/section-card";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { LoadingSkeleton } from "@/components/common/loading-skeleton";
import { SeverityBadge } from "@/components/common/severity-badge";
import { PerformanceMetricCard } from "@/components/audit/performance-metric-card";
import { ScoreGauge } from "@/components/charts/score-gauge";
import { useAudit } from "@/components/audit/audit-context";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { shortUrl } from "@/lib/format";
import type { PerformanceData } from "@/lib/api-types";

type Run = PerformanceData["runs"][number];

function psiGrade(score: number | undefined) {
  if (score == null) return null;
  return score >= 90 ? "A" : score >= 50 ? "C" : "F";
}

function RunCard({ run }: { run: Run }) {
  const Icon = run.strategy === "mobile" ? Smartphone : Monitor;
  const head = (
    <span className="inline-flex items-center gap-1.5"><Icon className="size-4" /> {run.strategy === "mobile" ? "Mobile" : "Desktop"} · <span className="font-mono text-xs font-normal">{shortUrl(run.url)}</span></span>
  );
  if (run.outcome !== "ok") {
    return (
      <SectionCard title={head}>
        <div className="flex gap-3 text-sm">
          {run.outcome === "rate_limited" ? <AlertTriangle className="size-5 shrink-0 text-warning" /> : <OctagonX className="size-5 shrink-0 text-critical" />}
          <div>
            <p className="font-medium">{run.outcome === "rate_limited" ? "Rate limited by Google (HTTP 429)" : `Request failed: ${run.error}`}</p>
            <p className="text-xs text-muted-foreground">
              {run.outcome === "rate_limited"
                ? "PageSpeed Insights refused the request because the shared, unkeyed quota was exhausted. Add a free PAGESPEED_API_KEY in Settings (Google Cloud console → PageSpeed Insights API) and re-run the audit. No metrics are shown because none were measured."
                : "No metrics were measured for this run."}
            </p>
          </div>
        </div>
      </SectionCard>
    );
  }
  const field = run.field_url ?? run.field_origin;
  const fieldLevel = run.field_url ? "URL-level" : run.field_origin ? "origin-level" : null;
  const lab = run.lab ?? {};
  const perf = run.scores?.performance;
  return (
    <SectionCard title={head} description={run.fetched_at ? `Lighthouse ${run.lighthouse_version ?? ""} · ${new Date(run.fetched_at).toLocaleString()}` : undefined}>
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex shrink-0 flex-col items-center gap-2">
          <ScoreGauge score={perf ?? null} grade={psiGrade(perf)} size={112} label="Lighthouse performance" />
          <div className="grid grid-cols-3 gap-2 text-center text-[0.7rem] text-muted-foreground">
            {(["accessibility", "best-practices", "seo"] as const).map((k) => (
              <div key={k}><p className="font-semibold text-foreground tabular">{run.scores?.[k] ?? "—"}</p><p>{k === "best-practices" ? "Best pr." : k === "seo" ? "SEO" : "A11y"}</p></div>
            ))}
          </div>
        </div>
        <div className="flex-1 space-y-3">
          <div>
            <p className="mb-1.5 text-xs font-medium">Lab metrics (one synthetic load)</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(["FCP", "LCP", "TBT", "CLS", "Speed Index"] as const).map((m) => (
                <PerformanceMetricCard key={m} label={m} value={lab[m]?.display ?? null} />
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium">Core Web Vitals, real users (p75, 28 days){fieldLevel && <span className="font-normal text-muted-foreground"> · {fieldLevel}</span>}</p>
            {field ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {(["LCP", "INP", "CLS", "FCP", "TTFB"] as const).map((m) => {
                  const f = field.metrics[m];
                  return <PerformanceMetricCard key={m} label={m} value={f ? f.p75 : null} unit={f?.unit} rating={f?.rating} />;
                })}
              </div>
            ) : <p className="text-xs text-muted-foreground">No Chrome UX Report field data: the page or origin does not have enough real-user traffic.</p>}
          </div>
          {run.opportunities && run.opportunities.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium">Top opportunities</p>
              <ul className="space-y-1 text-xs">
                {run.opportunities.map((o) => <li key={o.id} className="flex justify-between gap-2"><span>{o.title}</span><span className="text-muted-foreground tabular">~{(o.savings_ms / 1000).toFixed(1)} s</span></li>)}
              </ul>
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

export default function PerformanceTab() {
  const { audit } = useAudit();
  const { data, error, reload } = useApi(() => api.performance(audit.id), [audit.id]);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <LoadingSkeleton />;
  const ok = data.runs.filter((r) => r.outcome === "ok").length;
  const limited = data.runs.filter((r) => r.outcome === "rate_limited").length;
  const failed = data.runs.filter((r) => r.outcome === "failed").length;
  const mobile = data.runs.filter((r) => r.strategy === "mobile");
  const desktop = data.runs.filter((r) => r.strategy === "desktop");

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <PerformanceMetricCard label="Performance category score" value={data.score} sub={data.note ?? undefined} />
        <PerformanceMetricCard label="PageSpeed runs succeeded" value={data.skipped ? null : `${ok} / ${data.runs.length}`} sub={data.skipped ? "Skipped" : data.keyed ? "Keyed requests" : "Unkeyed requests"} />
        <PerformanceMetricCard label="Rate limited (HTTP 429)" value={data.skipped ? null : limited} />
        <PerformanceMetricCard label="Other failures" value={data.skipped ? null : failed} />
      </div>
      {data.skipped ? (
        <SectionCard><EmptyState icon={Gauge} title="PageSpeed analysis was skipped" description={data.skippedReason} /></SectionCard>
      ) : (
        <>
          {limited > 0 && (
            <div role="status" className="flex flex-wrap items-center gap-3 rounded-lg border border-warning/30 bg-warning-soft/60 p-4 text-sm">
              <KeyRound className="size-5 shrink-0 text-warning" />
              <p className="flex-1">{limited} PageSpeed request(s) were rate limited. Without an API key Google shares a small quota across all unkeyed callers.</p>
              <Button asChild size="sm" variant="outline"><Link href="/settings">Add PAGESPEED_API_KEY</Link></Button>
            </div>
          )}
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="space-y-4"><h2 className="flex items-center gap-1.5 text-sm font-semibold"><Smartphone className="size-4" /> Mobile</h2>{mobile.map((r) => <RunCard key={r.url + r.strategy} run={r} />)}</div>
            <div className="space-y-4"><h2 className="flex items-center gap-1.5 text-sm font-semibold"><Monitor className="size-4" /> Desktop</h2>{desktop.map((r) => <RunCard key={r.url + r.strategy} run={r} />)}</div>
          </div>
        </>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Slowest server responses (crawl TTFB)" description="Measured by the crawler for every page">
          {data.ttfb.length ? (
            <ul className="space-y-1.5 text-sm">
              {data.ttfb.map((t) => (
                <li key={t.url} className="flex items-center justify-between gap-3"><span className="truncate font-mono text-xs" title={t.url}>{shortUrl(t.url)}</span><span className="shrink-0 tabular">{t.ttfbMs} ms</span></li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted-foreground">No timing data.</p>}
        </SectionCard>
        <SectionCard title="Performance findings">
          {data.perfFindings.length ? (
            <ul className="space-y-2 text-sm">
              {data.perfFindings.map((f) => <li key={f.id} className="flex items-start gap-2"><SeverityBadge severity={f.severity} /><div><p className="font-medium">{f.title}</p><p className="text-xs text-muted-foreground">{f.evidence}</p></div></li>)}
            </ul>
          ) : <p className="text-sm text-muted-foreground">No performance findings.</p>}
        </SectionCard>
      </div>
    </div>
  );
}
