import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function MetricCard({ label, value, hint, icon: Icon, tone = "default", className }: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  tone?: "default" | "critical" | "warning" | "info" | "success";
  className?: string;
}) {
  const toneCls = {
    default: "text-muted-foreground bg-muted",
    critical: "text-critical bg-critical-soft",
    warning: "text-[oklch(0.5_0.12_62)] bg-warning-soft",
    info: "text-info bg-info-soft",
    success: "text-brand-strong bg-success-soft",
  }[tone];
  return (
    <div className={cn("rounded-lg border bg-card p-4 shadow-[var(--shadow-card)]", className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {Icon && (
          <span className={cn("grid size-7 place-items-center rounded-md", toneCls)}>
            <Icon className="size-3.5" aria-hidden />
          </span>
        )}
      </div>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
