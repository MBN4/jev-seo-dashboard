"use client";
import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, Ban, Clock, FileText, Globe, Loader2, OctagonX, RotateCw, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/page-header";
import { SectionCard } from "@/components/common/section-card";
import { StatusBadge } from "@/components/common/status-badge";
import { ErrorState } from "@/components/common/error-state";
import { LoadingSkeleton } from "@/components/common/loading-skeleton";
import { ConfirmationDialog } from "@/components/common/confirmation-dialog";
import { AuditProgressTracker, useElapsed } from "@/components/audit/audit-progress-tracker";
import { NoticeList } from "@/components/audit/notice-list";
import { useAuditProgress } from "@/hooks/use-audit-progress";
import { api, ApiError } from "@/lib/api";
import { formatDuration, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function ProgressPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = use(params);
  const id = decodeURIComponent(rawId);
  const { snap, error, transport } = useAuditProgress(id);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const elapsed = useElapsed(snap?.startedAt ?? null, snap?.finishedAt ?? null);
  const prevStatus = useRef<string | null>(null);

  useEffect(() => {
    if (!snap) return;
    if (prevStatus.current === "running" && snap.status === "completed") toast.success(`Audit of ${snap.domain} completed`);
    if (prevStatus.current === "running" && snap.status === "failed") toast.error(`Audit of ${snap.domain} failed`);
    prevStatus.current = snap.status;
  }, [snap]);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [snap?.eventCount]);

  if (error && !snap) return <ErrorState error={error} title="Could not load this audit" />;
  if (!snap) return <LoadingSkeleton />;

  const running = snap.status === "running" || snap.status === "queued";
  const p = snap.progress;
  const cancel = async () => {
    setCancelling(true);
    try {
      await api.cancelAudit(id);
      toast.message("Cancellation requested");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not cancel");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={<span className="inline-flex items-center gap-1.5"><Globe className="size-3.5" /> {snap.url}</span>}
        title={running ? `Auditing ${snap.domain}` : `Audit of ${snap.domain}`}
        description={running ? "You can leave this page; the audit keeps running and you can come back at any time." : undefined}
        actions={
          <>
            <StatusBadge status={snap.status} className="text-sm" />
            {running && (
              <Button variant="outline" onClick={() => setConfirmCancel(true)} disabled={cancelling}>
                {cancelling ? <Loader2 className="size-4 animate-spin" /> : <Ban className="size-4" />} Cancel audit
              </Button>
            )}
            {snap.hasResults && !running && (
              <Button asChild>
                <Link href={`/audits/${encodeURIComponent(id)}`}>View results <ArrowRight className="size-4" /></Link>
              </Button>
            )}
            {!running && !snap.hasResults && (
              <Button asChild variant="outline">
                <Link href="/audits/new"><RotateCw className="size-4" /> New audit</Link>
              </Button>
            )}
          </>
        }
      />

      {snap.error && snap.status !== "completed" && (
        <div role="alert" className={cn("flex gap-3 rounded-lg border p-4 text-sm", snap.status === "cancelled" ? "bg-muted/60" : "border-critical/25 bg-critical-soft/60")}>
          {snap.status === "cancelled" ? <Ban className="size-5 shrink-0 text-muted-foreground" /> : <OctagonX className="size-5 shrink-0 text-critical" />}
          <div>
            <p className="font-medium">{snap.status === "cancelled" ? "Audit cancelled" : snap.status === "interrupted" ? "Audit interrupted" : "Audit failed"}</p>
            <p className="text-muted-foreground">{snap.error}</p>
            {snap.status === "cancelled" && <p className="mt-1 text-xs text-muted-foreground">Any partial output was left in its own report folder; other audits were not affected.</p>}
          </div>
        </div>
      )}
      {snap.note && (
        <div role="status" className="flex gap-3 rounded-lg border border-warning/30 bg-warning-soft/60 p-4 text-sm">
          <AlertTriangle className="size-5 shrink-0 text-warning" />
          <p>{snap.note}</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <SectionCard title="Stages" description="Reported by the engine as it runs">
          {p ? (
            <AuditProgressTracker progress={p} />
          ) : (
            <p className="text-sm text-muted-foreground">This audit was imported from the reports folder, so no live progress log exists. Its results are available.</p>
          )}
        </SectionCard>
        <div className="space-y-4">
          <SectionCard title="Status">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-xs text-muted-foreground"><Clock className="mr-1 inline size-3" />Elapsed</dt><dd className="font-medium tabular">{elapsed == null ? "—" : formatDuration(elapsed)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Current stage</dt><dd className="font-medium">{p?.currentStage ? p.stages[p.currentStage - 1].label : running ? "Starting" : "—"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">URLs crawled</dt><dd className="font-medium tabular">{formatNumber(p?.pagesCrawled)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Max pages</dt><dd className="font-medium tabular">{formatNumber(snap.options?.maxPages ?? null)}</dd></div>
            </dl>
            {p?.lastMessage && (
              <p className="mt-3 rounded-md bg-muted/60 p-2 font-mono text-xs break-words" aria-live="polite">{p.lastMessage}</p>
            )}
            <p className="mt-2 text-[0.7rem] text-muted-foreground">Live updates: {running ? (transport === "sse" ? "streaming" : transport === "polling" ? "polling every 2 s" : "connecting") : "finished"}</p>
          </SectionCard>
          {p && p.notices.length > 0 && (
            <SectionCard title="Warnings and notices" description="Grouped by cause, each with its fix">
              <NoticeList notices={p.notices} />
            </SectionCard>
          )}
        </div>
      </div>

      {snap.tracked && (
        <SectionCard title={<span className="inline-flex items-center gap-1.5"><Terminal className="size-4" /> Engine log</span>} description={`${snap.eventCount} lines`} bodyClassName="p-0">
          <div ref={logRef} className="max-h-80 overflow-auto bg-sidebar p-4 font-mono text-[0.72rem] leading-relaxed text-sidebar-foreground" tabIndex={0} aria-label="Engine log">
            {snap.events.length === 0 && <p className="text-sidebar-muted">Waiting for the engine to start…</p>}
            {snap.events.map((e) => (
              <div key={e.seq} className={cn(e.kind === "stage" && "mt-1 font-semibold text-sidebar-primary", e.kind === "warning" && "text-[oklch(0.82_0.12_75)]", e.kind === "error" && "text-[oklch(0.75_0.15_25)]")}>
                {e.elapsed && <span className="text-sidebar-muted">[{e.elapsed}] </span>}
                {e.message}
              </div>
            ))}
          </div>
        </SectionCard>
      )}
      {snap.hasResults && !running && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild><Link href={`/audits/${encodeURIComponent(id)}/reports`}><FileText className="size-4" /> Reports</Link></Button>
        </div>
      )}

      <ConfirmationDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Cancel this audit?"
        description={<p>The engine process for {snap.domain} will be stopped. Other audits and existing reports are not affected.</p>}
        confirmLabel="Cancel audit"
        destructive
        onConfirm={cancel}
      />
    </div>
  );
}
