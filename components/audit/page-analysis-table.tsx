"use client";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef, type SortingState } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, Bot } from "lucide-react";
import type { PageRowData } from "@/lib/api-types";
import { shortUrl } from "@/lib/format";
import { cn } from "@/lib/utils";

function StatusCode({ status, error }: { status: number | null; error: string | null }) {
  if (status == null) return <span className="text-xs text-muted-foreground" title={error ?? undefined}>{error ? "Error" : "—"}</span>;
  const cls = status < 300 ? "text-brand-strong bg-success-soft" : status < 400 ? "text-info bg-info-soft" : "text-critical bg-critical-soft";
  return <span className={cn("rounded px-1.5 py-0.5 font-mono text-xs", cls)}>{status}</span>;
}

const columns: ColumnDef<PageRowData>[] = [
  {
    id: "url",
    accessorKey: "url",
    header: "URL",
    cell: ({ row }) => (
      <div className="max-w-[22rem]">
        <p className="truncate font-mono text-xs" title={row.original.url}>{shortUrl(row.original.url)}</p>
        <p className="truncate text-xs text-muted-foreground" title={row.original.title ?? ""}>{row.original.title ?? <em>No title</em>}</p>
      </div>
    ),
  },
  { id: "status", accessorKey: "status", header: "Status", cell: ({ row }) => <StatusCode status={row.original.status} error={row.original.error} /> },
  {
    id: "indexable",
    accessorKey: "indexable",
    header: "Indexable",
    cell: ({ row }) => {
      const v = row.original.indexable;
      return v == null ? <span className="text-xs text-muted-foreground">—</span> : (
        <span className={cn("text-xs", v ? "text-brand-strong" : "text-high")} title={row.original.indexabilityNote ?? undefined}>{v ? "Yes" : `No${row.original.indexabilityNote ? ` (${row.original.indexabilityNote})` : ""}`}</span>
      );
    },
  },
  { id: "h1", accessorKey: "h1", header: "H1", enableSorting: false, cell: ({ row }) => <span className="block max-w-[12rem] truncate text-xs" title={row.original.h1 ?? ""}>{row.original.h1 ?? <em className="text-muted-foreground">Missing</em>}{row.original.h1Count > 1 && <span className="text-muted-foreground"> (+{row.original.h1Count - 1})</span>}</span> },
  { id: "wordCount", accessorKey: "wordCount", header: "Words", meta: { num: true }, cell: ({ getValue }) => getValue<number | null>() ?? "—" },
  { id: "depth", accessorKey: "depth", header: "Depth", meta: { num: true }, cell: ({ getValue }) => getValue<number | null>() ?? "—" },
  { id: "internalLinks", accessorKey: "internalLinks", header: "Int. links", meta: { num: true }, cell: ({ getValue }) => getValue<number | null>() ?? "—" },
  { id: "inlinks", accessorKey: "inlinks", header: "Inlinks", meta: { num: true }, cell: ({ getValue }) => getValue<number | null>() ?? "—" },
  {
    id: "issueCount",
    accessorKey: "issueCount",
    header: "Issues",
    meta: { num: true },
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1">
        {row.original.jevJudged && <Bot className="size-3 text-muted-foreground" aria-label="Judged by AI" />}
        <span className={row.original.issueCount ? "font-medium" : "text-muted-foreground"}>{row.original.issueCount}</span>
      </span>
    ),
  },
];

export function PageAnalysisTable({ rows, sort, dir, onSort, onOpen, selected }: {
  rows: PageRowData[];
  sort: string;
  dir: "asc" | "desc";
  onSort: (k: string) => void;
  onOpen: (url: string) => void;
  selected: string | null;
}) {
  const sorting: SortingState = [{ id: sort, desc: dir === "desc" }];
  const table = useReactTable({ data: rows, columns, state: { sorting }, manualSorting: true, manualPagination: true, getCoreRowModel: getCoreRowModel() });
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="border-b bg-muted/40">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => {
                const num = (h.column.columnDef.meta as { num?: boolean } | undefined)?.num;
                const canSort = h.column.getCanSort();
                const active = sort === h.column.id;
                const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
                return (
                  <th key={h.id} scope="col" className={cn("px-3 py-2.5 text-xs font-medium whitespace-nowrap text-muted-foreground", num ? "text-right" : "text-left")} aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : canSort ? "none" : undefined}>
                    {canSort ? (
                      <button type="button" onClick={() => onSort(h.column.id)} className="inline-flex items-center gap-1 hover:text-foreground">
                        {flexRender(h.column.columnDef.header, h.getContext())} <Icon className="size-3" aria-hidden />
                      </button>
                    ) : flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y">
          {table.getRowModel().rows.map((r) => (
            <tr
              key={r.id}
              tabIndex={0}
              onClick={() => onOpen(r.original.url)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen(r.original.url))}
              aria-selected={selected === r.original.url}
              className={cn("cursor-pointer transition-colors hover:bg-muted/40 focus-visible:bg-muted/60 focus-visible:outline-none", selected === r.original.url && "bg-brand-soft/40")}
            >
              {r.getVisibleCells().map((c) => (
                <td key={c.id} className={cn("px-3 py-2.5 align-top", (c.column.columnDef.meta as { num?: boolean } | undefined)?.num && "text-right tabular")}>
                  {flexRender(c.column.columnDef.cell, c.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
