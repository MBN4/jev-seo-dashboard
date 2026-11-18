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
      <div className="grid size-11 place-items-center rounded-xl border bg-card text-muted-foreground shadow-[var(--shadow-card)]">
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
