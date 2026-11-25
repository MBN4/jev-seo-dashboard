"use client";
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { AlertOctagon, AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, Check, Download, Info, Lightbulb, ListFilter, Minus, Search, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/common/pagination";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { LoadingSkeleton } from "@/components/common/loading-skeleton";
import { PageDetailsDrawer } from "@/components/audit/page-details-drawer";
import { useAudit } from "@/components/audit/audit-context";
import { useApi, useDebounced } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { shortUrl } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Column, FilterKind, Row } from "@/lib/server/explorer";

const KIND: Record<FilterKind, { label: string; icon: typeof Info; cls: string; chip: string }> = {
  issue: { label: "Issue", icon: AlertOctagon, cls: "text-critical", chip: "bg-critical-soft text-critical" },
  warning: { label: "Warning", icon: AlertTriangle, cls: "text-warning", chip: "bg-warning-soft text-warning-ink" },
  opportunity: { label: "Opportunity", icon: Lightbulb, cls: "text-info", chip: "bg-info-soft text-info" },
  info: { label: "Info", icon: Info, cls: "text-muted-foreground", chip: "bg-muted text-muted-foreground" },
};

const PLURAL: Record<FilterKind, string> = { issue: "issues", warning: "warnings", opportunity: "opportunities", info: "notes" };

function Cell({ col, value }: { col: Column; value: Row[string] }) {
  if (value == null || value === "") return <span className="text-muted-foreground/60">—</span>;
  switch (col.type) {
    case "url":
      return <span className="block max-w-[26rem] truncate font-mono text-xs" title={String(value)}>{shortUrl(String(value))}</span>;
    case "status": {
      const n = Number(value);
      const cls = n < 300 ? "bg-success-soft text-brand-strong" : n < 400 ? "bg-info-soft text-info" : "bg-critical-soft text-critical";
      return <span className={cn("rounded px-1.5 py-0.5 font-mono text-xs", cls)}>{n}</span>;
    }
    case "bool":
      return value ? <Check className="size-4 text-brand" aria-label="yes" /> : <Minus className="size-4 text-muted-foreground" aria-label="no" />;
    case "list": {
      const arr = value as string[];
      if (!arr.length) return <span className="text-muted-foreground/60">—</span>;
      return <span className="block max-w-[20rem] truncate text-xs" title={arr.join(", ")}>{arr.map((x) => (x.startsWith("http") ? shortUrl(x) : x)).join(", ")}</span>;
    }
    case "num":
      return <span className="tabular">{Number(value).toLocaleString()}</span>;
    default:
      return <span className="block max-w-[24rem] truncate" title={String(value)}>{String(value)}</span>;
  }
}

export default function ExplorerTab() {
  const { audit } = useAudit();
  const overview = useApi(() => api.explorer(audit.id), [audit.id]);
  const [tab, setTab] = useState<string>("issues");
  const [filter, setFilter] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const [sort, setSort] = useState<string | null>(null);
  const [dir, setDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const query = { filter: filter ?? undefined, q: dq || undefined, sort: sort ?? undefined, dir, page, pageSize: 50 };
  const rows = useApi(tab === "issues" ? null : () => api.explorerRows(audit.id, tab, query), [audit.id, tab, filter, dq, sort, dir, page]);
  const current = useMemo(() => overview.data?.tabs.find((t) => t.key === tab) ?? null, [overview.data, tab]);

  const go = (t: string, fl: string | null = null) => {
    setTab(t);
    setFilter(fl);
    setSort(null);
    setDir("asc");
    setPage(1);
    setQ("");
  };
  const onSort = (k: string) => {
    if (sort === k) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(k);
      setDir("asc");
    }
    setPage(1);
  };

  if (overview.error) return <ErrorState error={overview.error} onRetry={overview.reload} />;
  if (!overview.data) return <LoadingSkeleton />;
  const ov = overview.data;
  const kindCounts = ov.issues.reduce((m, i) => ((m[i.kind] = (m[i.kind] ?? 0) + 1), m), {} as Record<FilterKind, number>);

  return (
    <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
      {/* Tab rail */}
      <nav aria-label="Explorer tabs" className="lg:sticky lg:top-20 lg:self-start">
        <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 [scrollbar-width:none]">
          {[{ key: "issues", label: "Issues", count: ov.issues.length }, ...ov.tabs.map((t) => ({ key: t.key, label: t.label, count: t.count }))].map((t) => {
            const active = tab === t.key;
            return (
              <li key={t.key} className="shrink-0">
                <button
                  type="button"
                  onClick={() => go(t.key)}
                  aria-current={active ? "page" : undefined}
                  className={cn("relative flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors", active ? "font-medium text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground")}
                >
                  {active && <motion.span layoutId="explorer-tab" className="absolute inset-0 rounded-lg bg-brand-soft ring-1 ring-brand/25" transition={{ type: "spring", stiffness: 500, damping: 40 }} aria-hidden />}
                  <span className="relative whitespace-nowrap">{t.label}</span>
                  <span className="relative text-xs tabular text-muted-foreground">{t.count.toLocaleString()}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="min-w-0 space-y-4">
        {tab === "issues" ? (
          <section className="surface overflow-hidden">
            <header className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold">Issues across {ov.totalUrls.toLocaleString()} URLs</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">Everything missing or wrong, by type. Click a row to see the URLs.</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(["issue", "warning", "opportunity"] as FilterKind[]).map((k) => (
                  <span key={k} className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", KIND[k].chip)}>
                    {kindCounts[k] ?? 0} {(kindCounts[k] ?? 0) === 1 ? KIND[k].label.toLowerCase() : PLURAL[k]}
                  </span>
                ))}
              </div>
            </header>
            {ov.issues.length === 0 ? (
              <EmptyState icon={Check} title="Nothing missing" description="No issues, warnings or opportunities were found in the crawl data." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="border-b bg-muted/40">
                    <tr>
                      {["Issue", "Type", "Tab", "URLs", "% of tab"].map((h, i) => <th key={h} scope="col" className={cn("px-4 py-2.5 text-xs font-medium text-muted-foreground", i >= 3 ? "text-right" : "text-left")}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {ov.issues.map((it, idx) => {
                      const K = KIND[it.kind];
                      return (
                        <motion.tr
                          key={`${it.tab}-${it.filter}`}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: Math.min(idx * 0.015, 0.4) }}
                          className="cursor-pointer transition-colors hover:bg-muted/40"
                          onClick={() => go(it.tab, it.filter)}
                        >
                          <td className="px-4 py-2.5">
                            <button type="button" className="flex items-start gap-2 text-left" onClick={(e) => { e.stopPropagation(); go(it.tab, it.filter); }}>
                              <K.icon className={cn("mt-0.5 size-4 shrink-0", K.cls)} aria-hidden />
                              <span>
                                <span className="font-medium">{it.tabLabel}: {it.label}</span>
                                <span className="block text-xs text-muted-foreground">{it.help}</span>
                              </span>
                            </button>
                          </td>
                          <td className="px-4 py-2.5"><span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", K.chip)}>{K.label}</span></td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">{it.tabLabel}</td>
                          <td className="px-4 py-2.5 text-right font-medium tabular">{it.count.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-right text-muted-foreground tabular">{it.share}%</td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : (
          <section className="surface overflow-hidden">
            <header className="space-y-3 border-b px-5 py-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-sm font-semibold">{current?.label}</h2>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
                    <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search this tab" aria-label="Search this tab" className="h-8 pl-8 sm:w-56" />
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <a href={api.explorerCsvUrl(audit.id, tab, { filter: filter ?? undefined, q: dq || undefined, sort: sort ?? undefined, dir })} download>
                      <Download className="size-3.5" /> CSV
                    </a>
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter">
                <ListFilter className="size-3.5 text-muted-foreground" aria-hidden />
                <button type="button" onClick={() => { setFilter(null); setPage(1); }} aria-pressed={!filter} className={cn("rounded-full border px-2.5 py-1 text-xs font-medium transition-colors", !filter ? "border-brand/40 bg-brand-soft text-brand-strong" : "bg-card text-muted-foreground hover:bg-muted")}>
                  All <span className="tabular opacity-70">{current?.count.toLocaleString()}</span>
                </button>
                {current?.filters.map((fl) => {
                  const K = KIND[fl.kind];
                  const active = filter === fl.key;
                  return (
                    <button
                      key={fl.key}
                      type="button"
                      title={fl.help}
                      onClick={() => { setFilter(active ? null : fl.key); setPage(1); }}
                      aria-pressed={active}
                      className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors", active ? "border-brand/40 bg-brand-soft text-brand-strong" : "bg-card text-muted-foreground hover:bg-muted", fl.count === 0 && !active && "opacity-50")}
                    >
                      {fl.kind !== "info" && fl.count > 0 && <K.icon className={cn("size-3", K.cls)} aria-hidden />}
                      {fl.label} <span className="tabular opacity-70">{fl.count.toLocaleString()}</span>
                    </button>
                  );
                })}
              </div>
              {rows.data?.filter && <p className="text-xs text-muted-foreground">{rows.data.filter.help}</p>}
            </header>
            {rows.error ? (
              <div className="p-4"><ErrorState error={rows.error} onRetry={rows.reload} /></div>
            ) : !rows.data ? (
              <div className="p-4"><LoadingSkeleton variant="table" /></div>
            ) : rows.data.rows.length === 0 ? (
              <EmptyState icon={SearchX} title="No URLs match" description={filter ? "Nothing in this filter: good news." : "Try a different search."} />
            ) : (
              <div className={rows.loading ? "opacity-60 transition-opacity" : ""}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead className="sticky top-0 border-b bg-muted/60 backdrop-blur">
                      <tr>
                        {rows.data.columns.map((c) => {
                          const active = sort === c.key;
                          const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
                          return (
                            <th key={c.key} scope="col" className={cn("px-3 py-2.5 text-xs font-medium whitespace-nowrap text-muted-foreground", c.type === "num" ? "text-right" : "text-left")} aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}>
                              <button type="button" onClick={() => onSort(c.key)} className="inline-flex items-center gap-1 hover:text-foreground">{c.label} <Icon className="size-3" aria-hidden /></button>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {rows.data.rows.map((r) => (
                        <tr key={r.url} tabIndex={0} onClick={() => setOpen(r.url)} onKeyDown={(e) => e.key === "Enter" && setOpen(r.url)} className="cursor-pointer transition-colors hover:bg-muted/40 focus-visible:bg-muted/60 focus-visible:outline-none">
                          {rows.data!.columns.map((c) => (
                            <td key={c.key} className={cn("px-3 py-2", c.type === "num" && "text-right")}><Cell col={c} value={r[c.key]} /></td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="border-t px-4 pb-3"><Pagination page={rows.data.page} pageSize={rows.data.pageSize} total={rows.data.total} onPage={setPage} /></div>
              </div>
            )}
          </section>
        )}
      </div>
      <PageDetailsDrawer auditId={audit.id} url={open} onClose={() => setOpen(null)} />
    </div>
  );
}
