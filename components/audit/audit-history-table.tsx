"use client";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Eye, MoreHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { GradeBadge } from "@/components/common/grade-badge";
import { StatusBadge } from "@/components/common/status-badge";
import { api } from "@/lib/api";
import { formatDate, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AuditSummary } from "@/types/api";

export type HistorySort = "date" | "domain" | "score" | "findings";

function auditHref(a: AuditSummary) {
  const id = encodeURIComponent(a.id);
  return a.status === "running" || a.status === "queued" || !a.hasResults ? `/audits/${id}/progress` : `/audits/${id}`;
}

function SortHeader({ label, k, sort, dir, onSort, className }: { label: string; k: HistorySort; sort?: HistorySort; dir?: "asc" | "desc"; onSort?: (k: HistorySort) => void; className?: string }) {
  if (!onSort) return <th scope="col" className={className}>{label}</th>;
  const active = sort === k;
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th scope="col" className={className} aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => onSort(k)} className="inline-flex items-center gap-1 hover:text-foreground">
        {label} <Icon className="size-3" aria-hidden />
      </button>
    </th>
  );
}

/** Shared by the Overview "recent audits" list and the Audit History page. */
export function AuditHistoryTable({ audits, sort, dir, onSort, onRemove, compact }: {
  audits: AuditSummary[];
  sort?: HistorySort;
  dir?: "asc" | "desc";
  onSort?: (k: HistorySort) => void;
  onRemove?: (a: AuditSummary) => void;
  compact?: boolean;
}) {
  const th = "px-3 py-2.5 text-left text-xs font-medium text-muted-foreground whitespace-nowrap";
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="border-b bg-muted/40">
          <tr>
            <SortHeader label="Website" k="domain" sort={sort} dir={dir} onSort={onSort} className={th} />
            <SortHeader label="Audit date" k="date" sort={sort} dir={dir} onSort={onSort} className={th} />
            <SortHeader label="Score" k="score" sort={sort} dir={dir} onSort={onSort} className={th} />
            <th scope="col" className={cn(th, "text-right")}>Pages</th>
            <SortHeader label="Findings" k="findings" sort={sort} dir={dir} onSort={onSort} className={cn(th, "text-right")} />
            <th scope="col" className={th}>Status</th>
            {!compact && <th scope="col" className={th}>Reports</th>}
            <th scope="col" className={cn(th, "text-right")}><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {audits.map((a) => (
            <tr key={a.id} className="transition-colors hover:bg-muted/40">
              <td className="max-w-[18rem] px-3 py-2.5">
                <Link href={auditHref(a)} className="block truncate font-medium hover:underline">
                  {a.domain}
                </Link>
                <span className="block truncate text-xs text-muted-foreground" title={a.url}>{a.url}</span>
              </td>
              <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground tabular">{formatDate(a.startedAt ?? a.createdAt)}</td>
              <td className="px-3 py-2.5">
                <GradeBadge grade={a.grade} score={a.score} />
                {a.partial.length > 0 && <span className="ml-1.5 text-[0.7rem] text-muted-foreground" title={a.partial.join("\n")}>partial</span>}
              </td>
              <td className="px-3 py-2.5 text-right tabular">{formatNumber(a.pagesCrawled)}</td>
              <td className="px-3 py-2.5 text-right tabular">
                {a.findingsTotal == null ? "—" : (
                  <span>
                    {a.findingsTotal}
                    {a.severity && (a.severity.critical + a.severity.high) > 0 && (
                      <span className="ml-1 text-xs text-critical">({a.severity.critical + a.severity.high} high+)</span>
                    )}
                  </span>
                )}
              </td>
              <td className="px-3 py-2.5"><StatusBadge status={a.status} /></td>
              {!compact && (
                <td className="px-3 py-2.5 text-xs text-muted-foreground">
                  {a.reports.filter((r) => ["pdf", "xlsx", "md"].includes(r)).map((r) => r.toUpperCase()).join(" · ") || "None"}
                </td>
              )}
              <td className="px-3 py-2.5 text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button variant="ghost" size="icon-sm" asChild>
                    <Link href={auditHref(a)} aria-label={`View audit of ${a.domain}`}>
                      <Eye className="size-4" />
                    </Link>
                  </Button>
                  {!compact && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`More actions for ${a.domain}`}>
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuLabel className="text-xs text-muted-foreground">Download</DropdownMenuLabel>
                        {(["pdf", "xlsx", "md", "json"] as const).map((t) => (
                          <DropdownMenuItem key={t} disabled={!a.reports.includes(t)} asChild={a.reports.includes(t)}>
                            {a.reports.includes(t) ? (
                              <a href={api.reportUrl(a.id, t)} download>
                                <Download className="size-3.5" /> {t === "json" ? "Audit JSON" : t.toUpperCase()}
                              </a>
                            ) : (
                              <span>
                                <Download className="size-3.5" /> {t === "json" ? "Audit JSON" : t.toUpperCase()} (not generated)
                              </span>
                            )}
                          </DropdownMenuItem>
                        ))}
                        {onRemove && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-critical focus:text-critical"
                              disabled={a.status === "running" || a.status === "queued"}
                              onSelect={() => onRemove(a)}
                            >
                              <Trash2 className="size-3.5" /> Remove from history
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
