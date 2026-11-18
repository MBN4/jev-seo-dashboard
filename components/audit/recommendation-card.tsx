"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, ExternalLink, Loader2, StickyNote, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SeverityBadge } from "@/components/common/severity-badge";
import { api, ApiError } from "@/lib/api";
import { shortUrl, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Recommendation } from "@/lib/api-types";

const PRIORITY = { P1: "bg-critical-soft text-critical", P2: "bg-warning-soft text-warning-ink", P3: "bg-muted text-muted-foreground" } as const;
const STATUS_LABEL = { pending: "Pending", in_progress: "In progress", completed: "Completed" } as const;

export function RecommendationCard({ auditId, rec, onChange }: { auditId: string; rec: Recommendation; onChange: (r: Recommendation) => void }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(rec.notes);
  const [saving, setSaving] = useState(false);
  const save = async (patch: { status?: Recommendation["status"]; notes?: string }) => {
    setSaving(true);
    try {
      const r = await api.updateRecommendation(auditId, rec.key, patch);
      onChange({ ...rec, status: r.status, notes: r.notes, updatedAt: r.updatedAt });
      if (patch.notes !== undefined) toast.success("Notes saved");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };
  return (
    <article className={cn("surface surface-hover transition-opacity", rec.status === "completed" && "opacity-70")}>
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
        <div className="flex items-center gap-2 sm:flex-col sm:items-start">
          <span className={cn("rounded px-1.5 py-0.5 font-mono text-xs font-semibold", PRIORITY[rec.priority])}>{rec.priority}</span>
          <span className="font-mono text-[0.68rem] text-muted-foreground">{rec.actionId}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={cn("text-sm font-semibold", rec.status === "completed" && "line-through decoration-muted-foreground/50")}>{rec.title}</h3>
            <SeverityBadge severity={rec.severity} />
            {rec.quickWin && <span className="inline-flex items-center gap-0.5 rounded bg-info-soft px-1.5 py-0.5 text-[0.68rem] font-medium text-info"><Zap className="size-3" />Quick win</span>}
            {rec.needsReview > 0 && <span className="rounded bg-warning-soft px-1.5 py-0.5 text-[0.68rem]">Needs review</span>}
          </div>
          <p className="mt-1 text-sm">{rec.fix}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>Impact <strong className="text-foreground tabular">{rec.impact}</strong>/100</span>
            <span>Effort <strong className="text-foreground tabular">{rec.effort}</strong>/4</span>
            <span>{rec.categoryName}</span>
            <span>{rec.count} URL(s)</span>
            {rec.updatedAt && <span>Updated {formatRelative(rec.updatedAt)}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={rec.status} onValueChange={(v) => save({ status: v as Recommendation["status"] })} disabled={saving}>
            <SelectTrigger className="h-8 w-36" aria-label={`Status of ${rec.actionId}`}><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(STATUS_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="ghost" size="icon-sm" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? "Hide details" : "Show details"}>
            <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
          </Button>
        </div>
      </div>
      <AnimatePresence initial={false}>
      {open && (
        <motion.div key="details" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
        <div className="grid gap-4 border-t p-4 text-sm lg:grid-cols-2">
          <div className="space-y-3">
            <div><p className="mb-1 text-xs font-semibold text-muted-foreground uppercase">Evidence</p><p className="rounded-md bg-muted/60 p-2.5 text-xs break-words">{rec.evidence}</p></div>
            <div>
              <p className="mb-1 text-xs font-semibold text-muted-foreground uppercase">Affected URLs</p>
              <ul className="max-h-40 space-y-0.5 overflow-y-auto font-mono text-xs">{rec.urls.map((u) => <li key={u} className="truncate" title={u}>{shortUrl(u)}</li>)}</ul>
            </div>
            {rec.source && <a href={rec.source} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-xs text-info hover:underline">Google guidance <ExternalLink className="size-3" /></a>}
          </div>
          <div className="space-y-2">
            <label htmlFor={`notes-${rec.key}`} className="flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase"><StickyNote className="size-3" /> Your notes</label>
            <Textarea id={`notes-${rec.key}`} value={notes} onChange={(e) => setNotes(e.target.value)} rows={5} maxLength={5000} placeholder="Owner, ticket link, decisions…" />
            <div className="flex items-center justify-between">
              <p className="text-[0.7rem] text-muted-foreground">Saved in the dashboard, separate from the audit data.</p>
              <Button size="sm" onClick={() => save({ notes })} disabled={saving || notes === rec.notes}>{saving && <Loader2 className="size-3.5 animate-spin" />} Save notes</Button>
            </div>
          </div>
        </div>
        </motion.div>
      )}
      </AnimatePresence>
    </article>
  );
}
