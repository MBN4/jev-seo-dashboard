"use client";
import { useEffect, useState } from "react";
import { AuditStageIndicator } from "./audit-stage-indicator";
import { formatDuration } from "@/lib/format";
import type { ProgressView } from "@/lib/progress";

export function useElapsed(startedAt: string | null, finishedAt: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (finishedAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [finishedAt]);
  if (!startedAt) return null;
  const end = finishedAt ? new Date(finishedAt).getTime() : now;
  return (end - new Date(startedAt).getTime()) / 1000;
}

/**
 * Stage list driven by the engine's own "== n/7" lines. The bar shows stages finished out
 * of seven (measured), never an invented percentage; per-stage counters are shown where the
 * engine logs them (URLs crawled, pages judged, PageSpeed runs).
 */
export function AuditProgressTracker({ progress }: { progress: ProgressView }) {
  const pct = Math.round((progress.completedStages / progress.stages.length) * 100);
  return (
    <div className="space-y-5">
      <div>
        <div className="mb-1.5 flex items-baseline justify-between text-xs text-muted-foreground">
          <span>
            <span className="font-medium text-foreground tabular">{progress.completedStages}</span> of {progress.stages.length} stages finished
          </span>
          <span className="tabular">{pct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={progress.completedStages} aria-valuemin={0} aria-valuemax={progress.stages.length} aria-label="Stages finished">
          <div className="h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <ol aria-label="Audit stages">
        {progress.stages.map((s, i) => (
          <AuditStageIndicator key={s.key} stage={s} last={i === progress.stages.length - 1} />
        ))}
      </ol>
    </div>
  );
}

export { formatDuration };
