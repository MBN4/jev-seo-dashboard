import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ErrorState({ error, onRetry, title = "Something went wrong" }: { error: Error | string; onRetry?: () => void; title?: string }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-critical/25 bg-critical-soft/60 p-4 sm:flex-row sm:items-center">
      <AlertTriangle className="size-5 shrink-0 text-critical" aria-hidden />
      <div className="flex-1 text-sm">
        <p className="font-medium text-critical">{title}</p>
        <p className="text-muted-foreground">{typeof error === "string" ? error : error.message}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw className="size-3.5" /> Retry
        </Button>
      )}
    </div>
  );
}
