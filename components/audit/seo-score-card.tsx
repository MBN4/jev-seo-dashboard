import { AlertTriangle } from "lucide-react";
import { ScoreGauge } from "@/components/charts/score-gauge";
import { GrowBar } from "@/components/motion/primitives";
import type { EngineScores } from "@/types/engine";

/** Score + grade + completeness exactly as the engine computed them (not recalculated by the dashboard). */
export function SeoScoreCard({ scores }: { scores: EngineScores }) {
  const c = scores.completeness;
  const pct = c ? Math.round((c.categories_scored / c.categories_total) * 100) : null;
  return (
    <div className="relative flex h-full flex-col items-center gap-5 overflow-hidden surface p-6 sm:flex-row lg:flex-col">
      <ScoreGauge score={scores.overall} grade={scores.grade} />
      <div className="w-full min-w-0 flex-1 space-y-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Audit completeness</p>
          {c ? (
            <>
              <p className="text-sm">
                <span className="font-semibold tabular">{c.categories_scored}</span> of {c.categories_total} categories scored
              </p>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct ?? 0} aria-valuemin={0} aria-valuemax={100} aria-label="Audit completeness">
                <GrowBar pct={pct ?? 0} delay={0.2} className="h-full rounded-full bg-gradient-to-r from-brand/70 to-brand" />
              </div>
              <ul className="mt-2 flex flex-wrap gap-1.5 text-[0.7rem]">
                {[
                  ["AI judgments", c.ai],
                  ["PageSpeed", c.pagespeed],
                  ["DataForSEO", c.dataforseo],
                ].map(([label, ok]) => (
                  <li key={label as string} className={ok ? "rounded bg-success-soft px-1.5 py-0.5 text-brand-strong" : "rounded bg-muted px-1.5 py-0.5 text-muted-foreground"}>
                    {label as string}: {ok ? "included" : "not included"}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Not reported by this engine version.</p>
          )}
        </div>
        {(scores.partial?.length || scores.caps?.length) ? (
          <div className="space-y-1 rounded-md bg-warning-soft/70 p-2.5 text-xs">
            {scores.partial?.length ? (
              <p className="flex items-center gap-1 font-medium text-warning-ink">
                <AlertTriangle className="size-3.5" aria-hidden /> Partial audit
              </p>
            ) : null}
            {[...(scores.partial ?? []), ...(scores.caps ?? [])].map((t) => (
              <p key={t} className="text-muted-foreground">
                {t}
              </p>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
