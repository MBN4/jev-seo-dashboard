"use client";
import { useState } from "react";
import { CheckCircle2, Search, SearchX } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionCard } from "@/components/common/section-card";
import { FilterChip } from "@/components/common/filter-chip";
import { SEVERITY_META } from "@/components/common/severity-badge";
import { Pagination } from "@/components/common/pagination";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { LoadingSkeleton } from "@/components/common/loading-skeleton";
import { FindingTable } from "@/components/audit/finding-table";
import { FindingDetailDrawer } from "@/components/audit/finding-detail-drawer";
import { useAudit } from "@/components/audit/audit-context";
import { useApi, useDebounced } from "@/hooks/use-api";
import { api } from "@/lib/api";
import type { Severity } from "@/types/engine";

type SortKey = "severity" | "count" | "title" | "category";

export default function TechnicalPage() {
  const { audit } = useAudit();
  const [severity, setSeverity] = useState<string[]>([]);
  const [category, setCategory] = useState("all");
  const [origin, setOrigin] = useState("all");
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const [sort, setSort] = useState<SortKey>("severity");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const { data, error, loading, reload } = useApi(
    () => api.findings(audit.id, { severity, category: category === "all" ? undefined : category, origin: origin === "all" ? undefined : origin, q: dq, sort, dir, page, pageSize: 20 }),
    [audit.id, severity.join(), category, origin, dq, sort, dir, page],
  );
  const toggleSev = (s: string) => {
    setPage(1);
    setSeverity((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  };
  const onSort = (k: SortKey) => {
    if (k === sort) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(k);
      setDir(k === "title" || k === "category" ? "asc" : "desc");
    }
  };

  return (
    <div className="space-y-4">
      <SectionCard
        title="Technical findings"
        description="Every finding produced by the engine's rules, Jev judgments and PageSpeed results, grouped by engine category."
        bodyClassName="p-0"
      >
        <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by severity">
            {(Object.keys(SEVERITY_META) as Severity[]).map((s) => (
              <FilterChip key={s} active={severity.includes(s)} onClick={() => toggleSev(s)} count={data?.facets.severity[s]}>
                <span className={`size-1.5 rounded-full ${SEVERITY_META[s].dot}`} aria-hidden />
                {SEVERITY_META[s].label}
              </FilterChip>
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select value={category} onValueChange={(v) => { setCategory(v); setPage(1); }}>
              <SelectTrigger className="h-8 w-full sm:w-52" aria-label="Filter by category"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {data?.facets.category.map((c) => <SelectItem key={c.key} value={c.key}>{c.name} ({c.count})</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={origin} onValueChange={(v) => { setOrigin(v); setPage(1); }}>
              <SelectTrigger className="h-8 w-full sm:w-36" aria-label="Filter by source"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                {data?.facets.origin.map((o) => <SelectItem key={o} value={o}>{o === "jev" ? "Jev AI" : o === "dataforseo" ? "DataForSEO" : "Rules"}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search findings or URLs" aria-label="Search findings" className="h-8 w-full pl-8 sm:w-56" />
            </div>
          </div>
        </div>
        {error ? (
          <div className="p-4"><ErrorState error={error} onRetry={reload} /></div>
        ) : !data ? (
          <div className="p-4"><LoadingSkeleton variant="table" /></div>
        ) : data.items.length === 0 ? (
          <EmptyState icon={SearchX} title={data.total === 0 && !severity.length && !dq && category === "all" ? "No findings" : "No findings match these filters"} description="Clear filters to see every finding." />
        ) : (
          <div className={loading ? "opacity-60 transition-opacity" : ""}>
            <FindingTable items={data.items} sort={sort} dir={dir} onSort={onSort} onOpen={setOpen} />
            <div className="border-t px-4 pb-3"><Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} /></div>
          </div>
        )}
      </SectionCard>

      {data && data.passedRules.length > 0 && (
        <SectionCard title={<span className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-4 text-brand" /> No issue detected ({data.passedRules.length} rules)</span>}>
          <ul className="flex flex-wrap gap-1.5">
            {data.passedRules.map((r) => <li key={r} className="rounded bg-success-soft px-1.5 py-0.5 font-mono text-[0.7rem] text-brand-strong">{r}</li>)}
          </ul>
        </SectionCard>
      )}
      <FindingDetailDrawer auditId={audit.id} findingId={open} onClose={() => setOpen(null)} />
    </div>
  );
}
