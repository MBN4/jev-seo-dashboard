import { Ban, CheckCircle2, CircleDashed, Loader2, OctagonX, PauseCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AuditStatus } from "@/types/api";

const META: Record<AuditStatus, { label: string; className: string; icon: typeof Ban; spin?: boolean }> = {
  queued: { label: "Queued", className: "bg-neutral-soft text-muted-foreground ring-border", icon: CircleDashed },
  running: { label: "Running", className: "bg-info-soft text-info ring-info/20", icon: Loader2, spin: true },
  completed: { label: "Completed", className: "bg-success-soft text-brand-strong ring-brand/20", icon: CheckCircle2 },
  failed: { label: "Failed", className: "bg-critical-soft text-critical ring-critical/20", icon: OctagonX },
  cancelled: { label: "Cancelled", className: "bg-neutral-soft text-muted-foreground ring-border", icon: Ban },
  interrupted: { label: "Interrupted", className: "bg-warning-soft text-warning-ink ring-warning/25", icon: PauseCircle },
};

export function StatusBadge({ status, className }: { status: AuditStatus | string; className?: string }) {
  const m = META[status as AuditStatus] ?? META.queued;
  const Icon = m.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap", m.className, className)}>
      <Icon className={cn("size-3", m.spin && "animate-spin")} aria-hidden />
      {m.label}
    </span>
  );
}
