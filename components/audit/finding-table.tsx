"use client";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight } from "lucide-react";
import { SeverityBadge } from "@/components/common/severity-badge";
import type { FindingListItem } from "@/lib/api-types";
import { shortUrl } from "@/lib/format";

type SortKey = "severity" | "count" | "title" | "category";

export function FindingTable({ items, sort, dir, onSort, onOpen }: {
  items: FindingListItem[];
  sort: SortKey;
  dir: "asc" | "desc";
  onSort: (k: SortKey) => void;
  onOpen: (id: string) => void;
}) {
  const th = "px-3 py-2.5 text-left text-xs font-medium text-muted-foreground whitespace-nowrap";
  const H = ({ k, label, className }: { k: SortKey; label: string; className?: string }) => {
    const Icon = sort !== k ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
    return (
      <th scope="col" className={`${th} ${className ?? ""}`} aria-sort={sort === k ? (dir === "asc" ? "ascending" : "descending") : "none"}>
        <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => onSort(k)}>
          {label} <Icon className="size-3" aria-hidden />
        </button>
      </th>
    );
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="border-b bg-muted/40">
          <tr>
            <H k="severity" label="Severity" />
            <H k="title" label="Finding" />
            <H k="category" label="Category" />
            <th scope="col" className={th}>Rule</th>
            <H k="count" label="URLs" className="text-right" />
            <th scope="col" className={th}><span className="sr-only">Open</span></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((f) => (
            <tr key={f.key} className="cursor-pointer transition-colors hover:bg-muted/40" onClick={() => onOpen(f.id)}>
              <td className="px-3 py-2.5 align-top"><SeverityBadge severity={f.severity} /></td>
              <td className="max-w-md px-3 py-2.5">
                <button type="button" className="text-left font-medium hover:underline" onClick={(e) => { e.stopPropagation(); onOpen(f.id); }}>
                  {f.title}
                </button>
                <p className="line-clamp-1 text-xs text-muted-foreground" title={f.evidence}>{f.evidence}</p>
                {f.urls[0] && <p className="truncate font-mono text-[0.7rem] text-muted-foreground">{shortUrl(f.urls[0])}{f.urlCount > 1 ? ` +${f.urlCount - 1} more` : ""}</p>}
              </td>
              <td className="px-3 py-2.5 text-xs whitespace-nowrap text-muted-foreground">{f.categoryName}</td>
              <td className="px-3 py-2.5 font-mono text-[0.7rem] text-muted-foreground">{f.id}</td>
              <td className="px-3 py-2.5 text-right tabular">{f.count}</td>
              <td className="px-3 py-2.5 text-right"><ChevronRight className="ml-auto size-4 text-muted-foreground" aria-hidden /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
