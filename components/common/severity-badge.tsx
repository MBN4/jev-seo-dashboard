import { AlertOctagon, AlertTriangle, CircleAlert, Info, MinusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Severity } from "@/types/engine";

export const SEVERITY_META: Record<Severity, { label: string; className: string; dot: string; icon: typeof Info; hex: string }> = {
  critical: { label: "Critical", className: "bg-critical-soft text-critical ring-critical/20", dot: "bg-critical", icon: AlertOctagon, hex: "var(--critical)" },
  high: { label: "High", className: "bg-high-soft text-high ring-high/25", dot: "bg-high", icon: AlertTriangle, hex: "var(--high)" },
  medium: { label: "Medium", className: "bg-warning-soft text-warning-ink ring-warning/25", dot: "bg-warning", icon: CircleAlert, hex: "var(--warning)" },
  low: { label: "Low", className: "bg-info-soft text-info ring-info/20", dot: "bg-info", icon: Info, hex: "var(--info)" },
  info: { label: "Info", className: "bg-neutral-soft text-muted-foreground ring-border", dot: "bg-muted-foreground", icon: MinusCircle, hex: "var(--muted-foreground)" },
};

export function SeverityBadge({ severity, className, showIcon = true }: { severity: Severity | string; className?: string; showIcon?: boolean }) {
  const meta = SEVERITY_META[severity as Severity] ?? SEVERITY_META.info;
  const Icon = meta.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap", meta.className, className)}>
      {showIcon && <Icon className="size-3" aria-hidden />}
      {meta.label}
    </span>
  );
}
