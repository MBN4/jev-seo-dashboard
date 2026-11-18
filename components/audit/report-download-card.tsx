import { Download, Eye, FileJson, FileSpreadsheet, FileText, FileType } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { formatBytes, formatDate } from "@/lib/format";
import type { ReportFile } from "@/types/api";

const ICON = { pdf: FileType, xlsx: FileSpreadsheet, md: FileText, json: FileJson, digest: FileText };

export function ReportDownloadCard({ auditId, report, onPreview }: { auditId: string; report: ReportFile; onPreview?: () => void }) {
  const Icon = ICON[report.type] ?? FileText;
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-3 shadow-[var(--shadow-card)]">
      <span className="grid size-10 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground"><Icon className="size-5" aria-hidden /></span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{report.label}</p>
        <p className="truncate text-xs text-muted-foreground">{report.filename} · {formatBytes(report.size)} · {formatDate(report.modifiedAt)}</p>
      </div>
      {onPreview && (
        <Button variant="ghost" size="icon-sm" onClick={onPreview} aria-label={`Preview ${report.label}`}><Eye className="size-4" /></Button>
      )}
      <Button variant="outline" size="sm" asChild>
        <a href={api.reportUrl(auditId, report.type)} download aria-label={`Download ${report.label}`}><Download className="size-3.5" /> Download</a>
      </Button>
    </div>
  );
}
