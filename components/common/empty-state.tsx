import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({ icon: Icon, title, description, action, className, compact }: {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "gap-2 px-4 py-8" : "gap-3 px-6 py-14", className)}>
      <div className="relative grid size-12 place-items-center rounded-2xl border bg-card text-brand shadow-[var(--shadow-raised)] motion-safe:animate-[float_4s_ease-in-out_infinite]">
        <span className="absolute inset-0 -z-10 rounded-2xl bg-brand/20 blur-xl" aria-hidden />
        <Icon className="size-5" aria-hidden />
      </div>
      <div className="max-w-md space-y-1">
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && <div className="text-sm text-muted-foreground">{description}</div>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
