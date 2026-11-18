import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Diagnostics } from "@/lib/api-types";

type Check = Diagnostics["checks"][number];

export function SystemStatusCard({ check }: { check: Check }) {
  const Icon = check.state === "ok" ? CheckCircle2 : check.state === "warning" ? AlertTriangle : XCircle;
  return (
    <li className="flex gap-3 rounded-lg border bg-card p-3">
      <Icon className={cn("mt-0.5 size-4 shrink-0", check.state === "ok" ? "text-brand" : check.state === "warning" ? "text-warning" : "text-critical")} aria-hidden />
      <div className="min-w-0">
        <p className="text-sm font-medium">{check.label} <span className="sr-only">: {check.state}</span></p>
        <p className="text-xs break-words text-muted-foreground">{check.detail}</p>
        {check.action && <p className="mt-1 text-xs"><span className="font-medium">Action:</span> <span className="font-mono text-[0.7rem]">{check.action}</span></p>}
      </div>
    </li>
  );
}
