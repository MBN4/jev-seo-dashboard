import { cn } from "@/lib/utils";
import { gradeTone } from "@/lib/format";

const TONE = {
  good: "bg-success-soft text-brand-strong ring-brand/25",
  ok: "bg-warning-soft text-[oklch(0.5_0.12_62)] ring-warning/30",
  poor: "bg-high-soft text-high ring-high/25",
  bad: "bg-critical-soft text-critical ring-critical/25",
  none: "bg-neutral-soft text-muted-foreground ring-border",
};

export function GradeBadge({ grade, score, className }: { grade: string | null | undefined; score?: number | null; className?: string }) {
  if (!grade) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={cn("inline-flex items-center gap-1.5 tabular", className)}>
      <span className={cn("inline-grid size-6 place-items-center rounded-md text-xs font-semibold ring-1 ring-inset", TONE[gradeTone(grade)])} aria-label={`Grade ${grade}`}>
        {grade}
      </span>
      {score != null && <span className="font-medium">{score}</span>}
    </span>
  );
}
