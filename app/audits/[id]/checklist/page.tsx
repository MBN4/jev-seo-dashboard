"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, ChevronDown, ExternalLink, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { FilterChip } from "@/components/common/filter-chip";
import { SeverityBadge } from "@/components/common/severity-badge";
import { ErrorState } from "@/components/common/error-state";
import { LoadingSkeleton } from "@/components/common/loading-skeleton";
import { ChecklistOverview } from "@/components/audit/checklist-overview";
import { STATUS_META, SplitBar, StatusIcon } from "@/components/audit/checklist-status";
import { useAudit } from "@/components/audit/audit-context";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { shortUrl } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ItemStatus } from "@/lib/google-checklist";
import type { GradedItem } from "@/lib/server/checklist";

const FILTERS: Array<[ItemStatus | "all", string]> = [
  ["all", "All"],
  ["fail", "Needs work"],
  ["pass", "Passed"],
  ["note", "Notes"],
  ["not_checked", "Not checked"],
  ["manual", "Manual"],
];
const TAB: Record<NonNullable<GradedItem["link"]>, string> = { technical: "Technical SEO", extra: "Extra Checks", ai: "AI Content", performance: "Performance" };

function ItemRow({ item, auditId, defaultOpen }: { item: GradedItem; auditId: string; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const expandable = item.status !== "pass";
  return (
    <li id={item.id} className="scroll-mt-24 border-b last:border-b-0">
      <button
        type="button"
        onClick={() => expandable && setOpen((o) => !o)}
        aria-expanded={expandable ? open : undefined}
        className={cn("flex w-full items-start gap-3 px-5 py-3 text-left", expandable && "transition-colors hover:bg-muted/40")}
      >
        <StatusIcon status={item.status} className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className={cn("text-sm font-medium", item.status === "pass" && "text-foreground/80")}>{item.rule}</p>
          <p className="text-xs text-muted-foreground">{item.status === "not_checked" || item.status === "manual" ? item.reason : item.why}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {item.severity && item.status === "fail" && <SeverityBadge severity={item.severity} />}
          {item.urlCount > 0 && <span className="text-xs text-muted-foreground tabular">{item.urlCount} URL{item.urlCount === 1 ? "" : "s"}</span>}
          <span className={cn("hidden rounded-full px-2 py-0.5 text-[0.68rem] font-medium sm:inline", STATUS_META[item.status].chip)}>{STATUS_META[item.status].label}</span>
          {expandable && <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />}
        </div>
      </button>
      <AnimatePresence initial={false}>
        {open && expandable && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
            <div className="grid gap-4 px-5 pt-0 pb-4 pl-12 text-sm lg:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Why Google cares:</span> {item.why}</p>
                {item.evidence && <p className="rounded-md bg-muted/60 p-2.5 text-xs break-words"><span className="font-medium">What we found:</span> {item.evidence}</p>}
                {item.fix && <p className="text-sm"><span className="font-medium">How to fix:</span> {item.fix}</p>}
                <div className="flex flex-wrap gap-3 pt-1 text-xs">
                  <a href={item.doc} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-info hover:underline">
                    Google&apos;s guidance <ExternalLink className="size-3" />
                  </a>
                  {item.link && item.status !== "manual" && (
                    <Link href={`/audits/${encodeURIComponent(auditId)}/${item.link}`} className="inline-flex items-center gap-1 text-info hover:underline">
                      Details in {TAB[item.link]} <ArrowUpRight className="size-3" />
                    </Link>
                  )}
                </div>
              </div>
              {item.urls.length > 0 && (
                <ul className="max-h-44 space-y-0.5 overflow-y-auto rounded-md border p-2 font-mono text-xs">
                  {item.urls.map((u) => (
                    <li key={u} className="truncate" title={u}>
                      <a href={u} target="_blank" rel="noreferrer noopener" className="hover:underline">{shortUrl(u)}</a>
                    </li>
                  ))}
                  {item.urlCount > item.urls.length && <li className="text-muted-foreground">+{item.urlCount - item.urls.length} more</li>}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

export default function ChecklistTab() {
  const { audit } = useAudit();
  const { data, error, reload } = useApi(() => api.checklist(audit.id), [audit.id]);
  const [filter, setFilter] = useState<ItemStatus | "all">("all");
  const [q, setQ] = useState("");
  const [hash, setHash] = useState("");
  useEffect(() => {
    setHash(window.location.hash.slice(1));
    const on = () => setHash(window.location.hash.slice(1));
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  useEffect(() => {
    if (!data || !hash) return;
    const el = document.getElementById(hash);
    if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
  }, [data, hash]);
  const sections = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    return data.sections
      .map((s) => ({ ...s, shown: s.items.filter((it) => (filter === "all" || it.status === filter) && (!needle || `${it.rule} ${it.why} ${it.evidence ?? ""}`.toLowerCase().includes(needle))) }))
      .filter((s) => s.shown.length);
  }, [data, filter, q]);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <LoadingSkeleton />;
  const count = (k: ItemStatus | "all") => (k === "all" ? data.totals.total : data.totals[k]);

  return (
    <div className="space-y-5">
      <ChecklistOverview data={data} auditId={audit.id} compact />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
          {FILTERS.map(([k, l]) => <FilterChip key={k} active={filter === k} onClick={() => setFilter(k)} count={count(k)}>{l}</FilterChip>)}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search rules" aria-label="Search rules" className="h-8 pl-8 lg:w-64" />
        </div>
      </div>
      {sections.length === 0 && <p className="rounded-lg border p-6 text-center text-sm text-muted-foreground">No rules match this filter.</p>}
      {sections.map((s) => (
        <section key={s.key} id={s.key} className="surface scroll-mt-24 overflow-hidden" aria-labelledby={`sec-${s.key}`}>
          <header className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 id={`sec-${s.key}`} className="text-sm font-semibold tracking-tight">{s.title}</h2>
              <p className="mt-0.5 max-w-3xl text-xs text-muted-foreground">{s.summary}</p>
            </div>
            <div className="w-full shrink-0 sm:w-48">
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-muted-foreground">{s.counts.pass} met · {s.counts.fail} to fix</span>
                <span className="font-medium tabular">{s.score == null ? "—" : `${s.score}%`}</span>
              </div>
              <SplitBar counts={s.counts} />
            </div>
          </header>
          <ul>
            {s.shown.map((it) => <ItemRow key={it.id} item={it} auditId={audit.id} defaultOpen={hash === it.id} />)}
          </ul>
        </section>
      ))}
    </div>
  );
}
