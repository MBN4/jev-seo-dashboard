"use client";
import { useState } from "react";
import { Search, SearchX } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionCard } from "@/components/common/section-card";
import { Pagination } from "@/components/common/pagination";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { LoadingSkeleton } from "@/components/common/loading-skeleton";
import { PageAnalysisTable } from "@/components/audit/page-analysis-table";
import { PageDetailsDrawer } from "@/components/audit/page-details-drawer";
import { useAudit } from "@/components/audit/audit-context";
import { useApi, useDebounced } from "@/hooks/use-api";
import { api } from "@/lib/api";

export default function PagesTab() {
  const { audit } = useAudit();
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const [status, setStatus] = useState("all");
  const [indexable, setIndexable] = useState("all");
  const [issues, setIssues] = useState("all");
  const [sort, setSort] = useState("depth");
  const [dir, setDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const { data, error, loading, reload } = useApi(
    () => api.pages(audit.id, { q: dq, status: status === "all" ? undefined : status, indexable: indexable === "all" ? undefined : indexable, issues: issues === "all" ? undefined : issues, sort, dir, page, pageSize: 25 }),
    [audit.id, dq, status, indexable, issues, sort, dir, page],
  );
  const onSort = (k: string) => {
    if (k === sort) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSort(k); setDir(k === "issueCount" || k === "wordCount" || k === "inlinks" ? "desc" : "asc"); }
  };
  const sel = (value: string, set: (v: string) => void, label: string, opts: Array<[string, string]>) => (
    <Select value={value} onValueChange={(v) => { set(v); setPage(1); }}>
      <SelectTrigger className="h-8 w-full sm:w-40" aria-label={label}><SelectValue /></SelectTrigger>
      <SelectContent>{opts.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
    </Select>
  );
  return (
    <>
      <SectionCard title="Crawled pages" description="Every URL the engine fetched. Select a row for full page analysis." bodyClassName="p-0">
        <div className="flex flex-col gap-2 border-b p-4 sm:flex-row sm:flex-wrap">
          <div className="relative sm:flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search URL, title, H1 or description" aria-label="Search pages" className="h-8 pl-8" />
          </div>
          {sel(status, setStatus, "HTTP status", [["all", "All statuses"], ["2xx", "2xx"], ["3xx", "3xx"], ["4xx", "4xx"], ["5xx", "5xx"], ["error", "Not fetched"]])}
          {sel(indexable, setIndexable, "Indexability", [["all", "Any indexability"], ["yes", "Indexable"], ["no", "Not indexable"]])}
          {sel(issues, setIssues, "Issues", [["all", "Any issues"], ["with", "With issues"], ["without", "Without issues"]])}
        </div>
        {error ? <div className="p-4"><ErrorState error={error} onRetry={reload} /></div>
          : !data ? <div className="p-4"><LoadingSkeleton variant="table" /></div>
          : data.items.length === 0 ? <EmptyState icon={SearchX} title="No pages match" description="Try clearing the filters." />
          : (
            <div className={loading ? "opacity-60 transition-opacity" : ""}>
              <PageAnalysisTable rows={data.items} sort={sort} dir={dir} onSort={onSort} onOpen={setOpen} selected={open} />
              <div className="border-t px-4 pb-3"><Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} /></div>
            </div>
          )}
      </SectionCard>
      <PageDetailsDrawer auditId={audit.id} url={open} onClose={() => setOpen(null)} />
    </>
  );
}
