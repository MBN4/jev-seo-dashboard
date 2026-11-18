"use client";
import { ExternalLink } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SeverityBadge } from "@/components/common/severity-badge";
import { LoadingSkeleton } from "@/components/common/loading-skeleton";
import { ErrorState } from "@/components/common/error-state";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";

export function FindingDetailDrawer({ auditId, findingId, onClose }: { auditId: string; findingId: string | null; onClose: () => void }) {
  const { data: f, error } = useApi(findingId ? () => api.finding(auditId, findingId) : null, [auditId, findingId]);
  return (
    <Sheet open={Boolean(findingId)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-xl">
        <SheetHeader className="border-b p-5">
          <SheetTitle className="pr-6 text-base leading-snug">{f?.title ?? "Finding"}</SheetTitle>
          <SheetDescription className="font-mono text-xs">{findingId}</SheetDescription>
        </SheetHeader>
        <div className="space-y-5 p-5 text-sm">
          {error && <ErrorState error={error} />}
          {!f && !error && <LoadingSkeleton variant="panel" />}
          {f && f.id === findingId && (
            <>
              <div className="flex flex-wrap gap-2">
                <SeverityBadge severity={f.severity} />
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs">{f.categoryName}</span>
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs">Source: {f.origin === "jev" ? "Jev AI" : f.origin === "dataforseo" ? "DataForSEO" : "Rule"}</span>
                {f.heuristic && <span className="rounded-md bg-warning-soft px-1.5 py-0.5 text-xs">Heuristic</span>}
                {f.action && <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">{f.action.action_id} · {f.action.priority}</span>}
              </div>
              <section>
                <h3 className="mb-1 text-xs font-semibold text-muted-foreground uppercase">Evidence</h3>
                <p className="rounded-md bg-muted/60 p-3 text-[0.82rem] break-words">{f.evidence || "—"}</p>
              </section>
              <section>
                <h3 className="mb-1 text-xs font-semibold text-muted-foreground uppercase">Recommended fix</h3>
                <p>{f.fix}</p>
                {f.source && (
                  <a href={f.source} target="_blank" rel="noreferrer noopener" className="mt-1 inline-flex items-center gap-1 text-xs text-info hover:underline">
                    Google guidance <ExternalLink className="size-3" />
                  </a>
                )}
              </section>
              {f.action && (
                <section className="grid grid-cols-3 gap-3 rounded-md border p-3 text-xs">
                  <div><p className="text-muted-foreground">Impact</p><p className="font-semibold tabular">{f.action.impact}/100</p></div>
                  <div><p className="text-muted-foreground">Effort</p><p className="font-semibold tabular">{f.action.effort}/4</p></div>
                  <div><p className="text-muted-foreground">Quick win</p><p className="font-semibold">{f.action.quick_win ? "Yes" : "No"}</p></div>
                </section>
              )}
              <section>
                <h3 className="mb-1 text-xs font-semibold text-muted-foreground uppercase">Affected URLs ({f.urls.length})</h3>
                <ul className="max-h-72 space-y-1 overflow-y-auto rounded-md border p-2 font-mono text-xs">
                  {f.urls.map((u) => (
                    <li key={u} className="truncate">
                      <a href={u} target="_blank" rel="noreferrer noopener" className="hover:underline" title={u}>{u}</a>
                    </li>
                  ))}
                </ul>
              </section>
              {f.detail && Object.keys(f.detail).length > 0 && (
                <section>
                  <h3 className="mb-1 text-xs font-semibold text-muted-foreground uppercase">Engine detail</h3>
                  <pre className="max-h-64 overflow-auto rounded-md bg-muted/60 p-3 text-[0.7rem]">{JSON.stringify(f.detail, null, 2)}</pre>
                </section>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
