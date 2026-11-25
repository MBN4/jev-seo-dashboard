"use client";
import { useMemo, useState } from "react";
import { ListChecks, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { FilterChip } from "@/components/common/filter-chip";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { LoadingSkeleton } from "@/components/common/loading-skeleton";
import { RecommendationCard } from "@/components/audit/recommendation-card";
import { FindingDetailDrawer } from "@/components/audit/finding-detail-drawer";
import { useAudit } from "@/components/audit/audit-context";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import type { Recommendation } from "@/lib/api-types";

export default function RecommendationsTab() {
  const { audit } = useAudit();
  const { data, error, reload, setData } = useApi(() => api.recommendations(audit.id), [audit.id]);
  const [status, setStatus] = useState<string>("open");
  const [priority, setPriority] = useState<string[]>([]);
  const [quick, setQuick] = useState(false);
  const [q, setQ] = useState("");
  const [explain, setExplain] = useState<string | null>(null);
  const items = useMemo(() => {
    let r = data?.items ?? [];
    if (status === "open") r = r.filter((x) => x.status !== "completed");
    else if (status !== "all") r = r.filter((x) => x.status === status);
    if (priority.length) r = r.filter((x) => priority.includes(x.priority));
    if (quick) r = r.filter((x) => x.quickWin);
    if (q) {
      const s = q.toLowerCase();
      r = r.filter((x) => [x.title, x.fix, x.evidence, x.actionId, x.notes].some((t) => t?.toLowerCase().includes(s)));
    }
    return r;
  }, [data, status, priority, quick, q]);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <LoadingSkeleton />;
  const counts = { pending: 0, in_progress: 0, completed: 0 };
  data.items.forEach((x) => counts[x.status]++);
  const update = (r: Recommendation) => setData({ items: data.items.map((x) => (x.key === r.key ? r : x)) });
  const pct = data.items.length ? Math.round((counts.completed / data.items.length) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="surface p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
          <p><span className="font-semibold tabular">{counts.completed}</span> of {data.items.length} actions completed · {counts.in_progress} in progress · {counts.pending} pending</p>
          <p className="text-xs text-muted-foreground">Ranked by the engine (priority, impact, effort). Your status and notes never modify audit.json.</p>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Actions completed"><div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} /></div>
      </div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {[["open", "Open"], ["pending", "Pending"], ["in_progress", "In progress"], ["completed", "Completed"], ["all", "All"]].map(([k, l]) => (
            <FilterChip key={k} active={status === k} onClick={() => setStatus(k)}>{l}</FilterChip>
          ))}
          <span className="mx-1 w-px bg-border" aria-hidden />
          {["P1", "P2", "P3"].map((p) => <FilterChip key={p} active={priority.includes(p)} onClick={() => setPriority((c) => (c.includes(p) ? c.filter((x) => x !== p) : [...c, p]))}>{p}</FilterChip>)}
          <FilterChip active={quick} onClick={() => setQuick((v) => !v)}>Quick wins</FilterChip>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search actions or notes" aria-label="Search recommendations" className="h-8 pl-8 lg:w-64" />
        </div>
      </div>
      {items.length === 0 ? (
        <EmptyState icon={ListChecks} title={data.items.length ? "Nothing matches these filters" : "No recommended actions"} description={data.items.length ? "Change the filters to see more." : "The engine produced no actions for this audit."} />
      ) : (
        <div className="space-y-3">{items.map((r) => <RecommendationCard key={r.key} auditId={audit.id} rec={r} onChange={update} onExplain={setExplain} />)}</div>
      )}
      <FindingDetailDrawer auditId={audit.id} findingId={explain} onClose={() => setExplain(null)} />
    </div>
  );
}
