import { CheckCircle2, Circle, Loader2, MinusCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StageView } from "@/lib/progress";

const STATE_LABEL = { pending: "Pending", active: "In progress", done: "Done", skipped: "Skipped", failed: "Stopped" };

export function AuditStageIndicator({ stage, last }: { stage: StageView; last?: boolean }) {
  const Icon = { pending: Circle, active: Loader2, done: CheckCircle2, skipped: MinusCircle, failed: XCircle }[stage.state];
  const counter = stage.counter;
  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      {!last && <span className={cn("absolute top-6 left-[11px] h-[calc(100%-1.25rem)] w-px", stage.state === "done" || stage.state === "skipped" ? "bg-brand/40" : "bg-border")} aria-hidden />}
      <Icon
        className={cn(
          "relative z-10 mt-0.5 size-[23px] shrink-0 rounded-full bg-card p-0.5",
          stage.state === "done" && "text-brand",
          stage.state === "active" && "animate-spin text-info",
          stage.state === "pending" && "text-border",
          stage.state === "skipped" && "text-muted-foreground",
          stage.state === "failed" && "text-critical",
        )}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className={cn("text-sm font-medium", stage.state === "pending" && "text-muted-foreground")}>
            {stage.index}. {stage.label}
          </p>
          <span className="text-xs text-muted-foreground">{STATE_LABEL[stage.state]}{stage.startedAt ? ` · started at ${stage.startedAt}` : ""}</span>
        </div>
        {stage.detail && stage.state !== "pending" && <p className="mt-0.5 truncate text-xs text-muted-foreground" title={stage.detail}>{stage.detail}</p>}
        {counter && (
          <div className="mt-1.5 max-w-sm">
            <div className="flex justify-between text-[0.7rem] text-muted-foreground">
              <span>
                {counter.kind === "pages" ? "URLs crawled" : counter.kind === "jev" ? "Pages judged" : "PageSpeed runs"}
              </span>
              <span className="tabular">
                {counter.current} {counter.totalIsCap ? "of up to" : "of"} {counter.total}
              </span>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={counter.current} aria-valuemin={0} aria-valuemax={counter.total} aria-label={`${stage.label} measured progress`}>
              <div className="h-full rounded-full bg-info transition-[width]" style={{ width: `${Math.min(100, (counter.current / Math.max(1, counter.total)) * 100)}%` }} />
            </div>
          </div>
        )}
      </div>
    </li>
  );
}
