"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { FolderSync, History, PlusCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/common/page-header";
import { SectionCard } from "@/components/common/section-card";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { LoadingSkeleton } from "@/components/common/loading-skeleton";
import { Pagination } from "@/components/common/pagination";
import { ConfirmationDialog } from "@/components/common/confirmation-dialog";
import { AuditHistoryTable, type HistorySort } from "@/components/audit/audit-history-table";
import { useApi, useDebounced } from "@/hooks/use-api";
import { api, ApiError } from "@/lib/api";
import type { AuditSummary } from "@/types/api";

function HistoryInner() {
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const dq = useDebounced(q);
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<HistorySort>("date");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [removing, setRemoving] = useState<AuditSummary | null>(null);
  const hidden = useApi(() => api.hiddenAudits(), []);
  const { data, error, loading, reload } = useApi(
    () => api.listAudits({ q: dq, status: status === "all" ? undefined : status, from: from || undefined, to: to || undefined, sort, dir, page, pageSize: 15 }),
    [dq, status, from, to, sort, dir, page],
  );
  const onSort = (k: HistorySort) => {
    if (k === sort) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSort(k); setDir(k === "domain" ? "asc" : "desc"); }
  };
  const confirmRemove = async () => {
    if (!removing) return;
    try {
      await api.hideAudit(removing.id);
      toast.success(`Removed ${removing.domain} from history. Report files were kept.`);
      reload();
      hidden.reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not remove");
    }
  };
  const rescan = async (restoreAll = false) => {
    try {
      const r = await api.importAudits({ restoreAll });
      toast.success(`${r.discovered} audit folder(s) found in jev-seo-reports/${r.restored.length ? `, ${r.restored.length} restored` : ""}.`);
      reload();
      hidden.reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Import failed");
    }
  };
  const filtered = Boolean(dq || status !== "all" || from || to);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit History"
        description="Every audit launched from the dashboard plus every folder found in jev-seo-reports/."
        actions={
          <>
            <Button variant="outline" onClick={() => rescan(false)}><FolderSync className="size-4" /> Rescan reports folder</Button>
            <Button asChild><Link href="/audits/new"><PlusCircle className="size-4" /> New Audit</Link></Button>
          </>
        }
      />
      <SectionCard bodyClassName="p-0">
        <div className="flex flex-col gap-2 border-b p-4 md:flex-row md:flex-wrap md:items-end">
          <div className="relative md:flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search by domain" aria-label="Search by domain" className="h-8 pl-8" />
          </div>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="h-8 md:w-40" aria-label="Status"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[["all", "All statuses"], ["completed", "Completed"], ["running", "Running"], ["failed", "Failed"], ["cancelled", "Cancelled"], ["interrupted", "Interrupted"]].map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">From <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="h-8 w-36" /></label>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">To <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="h-8 w-36" /></label>
        </div>
        {error ? <div className="p-4"><ErrorState error={error} onRetry={reload} /></div>
          : !data ? <div className="p-4"><LoadingSkeleton variant="table" /></div>
          : data.items.length === 0 ? (
            <EmptyState
              icon={History}
              title={filtered ? "No audits match these filters" : "No audits yet"}
              description={filtered ? "Clear the search or filters." : "Run an audit, or put existing engine output folders in jev-seo-reports/ and rescan."}
              action={!filtered && <Button asChild><Link href="/audits/new">Start an audit</Link></Button>}
            />
          ) : (
            <div className={loading ? "opacity-60 transition-opacity" : ""}>
              <AuditHistoryTable audits={data.items} sort={sort} dir={dir} onSort={onSort} onRemove={setRemoving} />
              <div className="border-t px-4 pb-3"><Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} /></div>
            </div>
          )}
      </SectionCard>
      {hidden.data && hidden.data.hidden.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {hidden.data.hidden.length} audit(s) removed from history (files kept).{" "}
          <button type="button" className="text-info hover:underline" onClick={() => rescan(true)}>Restore all</button>
        </p>
      )}
      <ConfirmationDialog
        open={Boolean(removing)}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Remove ${removing?.domain ?? ""} from history?`}
        description={<><p>The entry disappears from the dashboard. The report folder in <code>jev-seo-reports/</code> is <strong className="text-foreground">not deleted</strong>, and you can restore the entry later.</p></>}
        confirmLabel="Remove from history"
        destructive
        onConfirm={confirmRemove}
      />
    </div>
  );
}

export default function HistoryPage() {
  return <Suspense fallback={<LoadingSkeleton />}><HistoryInner /></Suspense>;
}
