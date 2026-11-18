import { cn } from "@/lib/utils";

const RATING = {
  good: { cls: "bg-success-soft text-brand-strong", label: "Good" },
  "needs improvement": { cls: "bg-warning-soft text-[oklch(0.45_0.11_62)]", label: "Needs improvement" },
  poor: { cls: "bg-critical-soft text-critical", label: "Poor" },
} as const;

/** One metric; missing values are shown as unavailable, never as zero. */
export function PerformanceMetricCard({ label, value, unit, rating, sub }: { label: string; value: string | number | null | undefined; unit?: string; rating?: string | null; sub?: string }) {
  const r = rating ? RATING[rating as keyof typeof RATING] : null;
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        {r && <span className={cn("rounded px-1.5 py-0.5 text-[0.65rem] font-medium", r.cls)}>{r.label}</span>}
      </div>
      <p className={cn("mt-1 text-lg font-semibold tabular", value == null && "text-sm font-normal text-muted-foreground")}>
        {value == null ? "Not available" : <>{value}{unit && <span className="ml-0.5 text-xs font-normal text-muted-foreground">{unit}</span>}</>}
      </p>
      {sub && <p className="text-[0.7rem] text-muted-foreground">{sub}</p>}
    </div>
  );
}
