"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SeverityBadge } from "@/components/common/severity-badge";
import { LoadingSkeleton } from "@/components/common/loading-skeleton";
import { ErrorState } from "@/components/common/error-state";
import { AffectedUrls, FindingBreakdownView } from "./finding-breakdown-view";
import { PageDetailsDrawer } from "./page-details-drawer";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const EFFORT = ["", "Quick fix", "Small job", "Some work", "Big project"];

export function FindingDetailDrawer({ auditId, findingId, onClose }: { auditId: string; findingId: string | null; onClose: () => void }) {
  const { data: f, error } = useApi(findingId ? () => api.finding(auditId, findingId) : null, [auditId, findingId]);
  const [inspect, setInspect] = useState<string | null>(null);
  const [raw, setRaw] = useState(false);
  const ready = f && f.id === findingId;
  return (
    <Sheet open={Boolean(findingId)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-2xl lg:max-w-3xl">
        <SheetHeader className="sticky top-0 z-10 border-b bg-background/95 p-5 backdrop-blur">
          {ready && (
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
              <SeverityBadge severity={f.severity} />
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs">{f.categoryName}</span>
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs">{f.origin === "ai" ? "AI judgment" : f.origin === "dataforseo" ? "DataForSEO" : "Crawl check"}</span>
              {f.heuristic && <span className="rounded-md bg-warning-soft px-1.5 py-0.5 text-xs text-warning-ink">Heuristic: verify before acting</span>}
            </div>
          )}
          <SheetTitle className="pr-6 text-lg leading-snug">{ready ? f.title : "Finding"}</SheetTitle>
          <SheetDescription className="sr-only">Plain-language explanation of this finding, where it occurs and how to fix it.</SheetDescription>
        </SheetHeader>
        <div className="space-y-6 p-5 text-sm">
          {error && <ErrorState error={error} />}
          {!ready && !error && <LoadingSkeleton variant="panel" />}
          {ready && (
            <>
              {f.action && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    ["Priority", f.action.priority],
                    ["Impact", `${f.action.impact}/100`],
                    ["Effort", EFFORT[f.action.effort] ?? `${f.action.effort}/4`],
                    ["Pages", f.urls.length.toLocaleString()],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-lg border px-3 py-2">
                      <p className="text-[0.7rem] text-muted-foreground">{k}</p>
                      <p className="font-semibold tabular-nums">{v}</p>
                    </div>
                  ))}
                </div>
              )}
              <FindingBreakdownView b={f.breakdown} guidance={f.source} onInspect={setInspect} />
              {f.urls.length > 0 && <AffectedUrls urls={f.urls} name={`${auditId}-${f.id}`} onInspect={setInspect} />}
              <section className="rounded-xl border">
                <button type="button" onClick={() => setRaw((r) => !r)} className="flex w-full items-center gap-2 p-3 text-left text-xs font-medium text-muted-foreground hover:text-foreground">
                  <ChevronDown className={cn("size-4 transition-transform", raw && "rotate-180")} />
                  Technical details (check ID, raw evidence)
                </button>
                {raw && (
                  <div className="space-y-2 border-t p-3 text-xs">
                    <p>
                      <span className="text-muted-foreground">Check ID:</span> <code>{f.id}</code>
                      {f.action && (
                        <>
                          {" "}
                          · <span className="text-muted-foreground">Action:</span> <code>{f.action.action_id}</code>
                        </>
                      )}
                    </p>
                    <p className="break-words text-muted-foreground">{f.evidence}</p>
                    {f.detail && Object.keys(f.detail).length > 0 && <pre className="max-h-64 overflow-auto rounded-md bg-muted/60 p-3 text-[0.7rem]">{JSON.stringify(f.detail, null, 2)}</pre>}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </SheetContent>
      <PageDetailsDrawer auditId={auditId} url={inspect} onClose={() => setInspect(null)} />
    </Sheet>
  );
}
