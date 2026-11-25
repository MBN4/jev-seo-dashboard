"use client";
import { useEffect, useState } from "react";
import { FileX, Loader2 } from "lucide-react";
import { SectionCard } from "@/components/common/section-card";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { LoadingSkeleton } from "@/components/common/loading-skeleton";
import { ReportDownloadCard } from "@/components/audit/report-download-card";
import { useAudit } from "@/components/audit/audit-context";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { BRAND } from "@/lib/brand";

export default function ReportsTab() {
  const { audit } = useAudit();
  const { data, error, reload } = useApi(() => api.reports(audit.id), [audit.id]);
  const [preview, setPreview] = useState(false);
  const ready = data?.branded.ready ?? true;
  // While branded copies are being prepared (about a minute for large PDFs), refresh quietly.
  useEffect(() => {
    if (ready) return;
    const t = setInterval(reload, 4000);
    return () => clearInterval(t);
  }, [ready, reload]);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <LoadingSkeleton variant="panel" />;
  if (!data.items.length) return <EmptyState icon={FileX} title="No report files" description="The engine did not write any report files for this audit." />;
  const hasPdf = data.items.some((r) => r.type === "pdf");
  return (
    <div className="space-y-4">
      {ready ? (
        <p className="text-sm text-muted-foreground">{BRAND.name}-branded reports built from this audit&apos;s data. The audit engine&apos;s original files are kept unchanged.</p>
      ) : (
        <div role="status" className="flex items-center gap-3 rounded-xl border border-info/20 bg-info-soft/50 p-4 text-sm">
          <Loader2 className="size-4 animate-spin text-info" aria-hidden />
          <span>Preparing your branded reports. This takes up to a minute for large sites; downloads start automatically once ready.</span>
        </div>
      )}
      <div className="grid gap-3 lg:grid-cols-2">
        {data.items.map((r) => <ReportDownloadCard key={r.type} auditId={audit.id} report={r} onPreview={r.type === "pdf" ? () => setPreview(true) : undefined} />)}
      </div>
      {hasPdf && (
        <SectionCard title="PDF preview" actions={<button type="button" className="text-xs text-info hover:underline" onClick={() => setPreview((p) => !p)}>{preview ? "Hide" : "Show"} preview</button>} bodyClassName={preview ? "p-0" : undefined}>
          {preview ? (
            <iframe title={`PDF report for ${audit.domain}`} src={api.reportUrl(audit.id, "pdf", true)} className="h-[80vh] w-full rounded-b-lg" />
          ) : <p className="text-sm text-muted-foreground">Open the in-browser preview of report.pdf.</p>}
        </SectionCard>
      )}
    </div>
  );
}
