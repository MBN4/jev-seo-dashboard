"use client";
import { useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronDown, Copy, Download, ExternalLink, Info, Lightbulb, ScanSearch, Search, ThumbsUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { shortUrl } from "@/lib/format";
import type { Breakdown, BreakdownGroup, BreakdownNote, BreakdownTable, Cell, Tone } from "@/lib/server/finding-breakdown";

const TONE_TEXT: Record<Tone, string> = {
  bad: "text-critical",
  warn: "text-warning-ink",
  good: "text-success",
  info: "text-info",
  muted: "text-muted-foreground",
};
const TONE_BADGE: Record<Tone, string> = {
  bad: "bg-critical-soft text-critical",
  warn: "bg-warning-soft text-warning-ink",
  good: "bg-success-soft text-success",
  info: "bg-info-soft text-info",
  muted: "bg-muted text-muted-foreground",
};

export function CopyButton({ value, label = "Copy", className }: { value: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        });
      }}
      className={cn("inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground", className)}
      aria-label={label}
      title={label}
    >
      {done ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
    </button>
  );
}

/** A URL that opens in a new tab, plus an "inspect" button when it is a crawled page. */
export function UrlLink({ url, text, page, onInspect, className, compact }: { url: string; text?: string; page?: boolean; onInspect?: (u: string) => void; className?: string; compact?: boolean }) {
  const shown = text ?? (compact ? shortUrl(url) : url);
  return (
    <span className={cn("group/url inline-flex max-w-full min-w-0 items-center gap-1", className)}>
      <a href={url} target="_blank" rel="noreferrer noopener" title={`Open ${url} in a new tab`} className="min-w-0 truncate font-mono text-[0.78rem] text-foreground underline decoration-border underline-offset-2 transition-colors hover:text-info hover:decoration-info">
        {shown}
      </a>
      <ExternalLink className="size-3 shrink-0 text-muted-foreground" aria-hidden />
      {page && onInspect && (
        <button type="button" onClick={() => onInspect(url)} title="Inspect this page: title, headings, links and every issue on it" className="inline-flex shrink-0 items-center gap-0.5 rounded px-1 text-[0.7rem] text-muted-foreground opacity-70 transition hover:bg-muted hover:text-foreground group-hover/url:opacity-100">
          <ScanSearch className="size-3" /> Inspect
        </button>
      )}
    </span>
  );
}

function CellView({ cell, onInspect, full }: { cell: Cell; onInspect?: (u: string) => void; full?: boolean }) {
  if (cell.href) return <UrlLink url={cell.href} text={cell.text === cell.href ? undefined : cell.text} page={cell.page} onInspect={onInspect} compact={!full && cell.text === cell.href && Boolean(cell.page)} />;
  return <span className={cn(cell.mono && "font-mono text-[0.78rem]", cell.tone && TONE_TEXT[cell.tone], "break-words")}>{cell.text}</span>;
}

const NOTE_STYLE: Record<BreakdownNote["tone"], { icon: typeof Info; cls: string }> = {
  info: { icon: Info, cls: "border-info/25 bg-info-soft/60" },
  warn: { icon: AlertTriangle, cls: "border-warning/30 bg-warning-soft/70" },
  good: { icon: ThumbsUp, cls: "border-success/25 bg-success-soft/60" },
};

function Notes({ notes }: { notes: BreakdownNote[] }) {
  if (!notes.length) return null;
  return (
    <div className="space-y-2">
      {notes.map((n) => {
        const S = NOTE_STYLE[n.tone];
        return (
          <div key={n.title} className={cn("flex gap-3 rounded-lg border p-3", S.cls)}>
            <S.icon className={cn("mt-0.5 size-4 shrink-0", n.tone === "warn" ? "text-warning-ink" : n.tone === "good" ? "text-success" : "text-info")} />
            <div className="min-w-0">
              <p className="text-sm font-medium">{n.title}</p>
              <p className="mt-0.5 text-[0.82rem] leading-relaxed text-muted-foreground">{n.text}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function GroupCard({ g, onInspect, defaultOpen }: { g: BreakdownGroup; onInspect?: (u: string) => void; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [all, setAll] = useState(false);
  const items = all ? g.items : g.items.slice(0, 8);
  return (
    <div className="surface overflow-hidden rounded-xl border">
      <div className="space-y-2 p-3.5">
        <div className="flex flex-wrap items-start gap-2">
          {g.badge && <span className={cn("shrink-0 rounded-md px-1.5 py-0.5 text-[0.7rem] font-semibold", TONE_BADGE[g.badge.tone])}>{g.badge.text}</span>}
          <div className="flex min-w-0 flex-1 items-center gap-1">
            {g.title.href ? (
              <UrlLink url={g.title.href} page={g.title.page} onInspect={onInspect} className="min-w-0" />
            ) : (
              <span className={cn("min-w-0 text-sm font-medium break-all", g.title.mono && "font-mono text-[0.78rem]")}>{g.title.text}</span>
            )}
            <CopyButton value={g.key} label="Copy address" />
          </div>
        </div>
        {g.explain && <p className="text-[0.82rem] leading-relaxed text-muted-foreground">{g.explain}</p>}
        {g.suggestion && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-success-soft/60 px-3 py-2 text-[0.82rem]">
            <Lightbulb className="size-3.5 shrink-0 text-success" />
            <span className="font-medium">{g.suggestion.label}:</span>
            <span className="min-w-0 flex-1">
              <CellView cell={g.suggestion.value} onInspect={onInspect} full />
            </span>
            {g.suggestion.value.href && <CopyButton value={g.suggestion.value.href} label="Copy the correct address" />}
          </div>
        )}
      </div>
      {g.total > 0 && (
        <div className="border-t bg-muted/25">
          <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-2 px-3.5 py-2 text-left text-xs font-medium text-muted-foreground hover:text-foreground">
            <span>{g.itemsLabel}</span>
            <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
          </button>
          {open && (
            <ul className="space-y-1 px-3.5 pb-3">
              {items.map((it) => (
                <li key={it.url} className="flex min-w-0 flex-col gap-0.5 rounded-md px-2 py-1 hover:bg-muted/60 sm:flex-row sm:items-center sm:gap-3">
                  <UrlLink url={it.url} page onInspect={onInspect} compact className="min-w-0 sm:flex-1" />
                  {it.note && <span className="truncate text-[0.72rem] text-muted-foreground sm:max-w-[45%]">{it.note}</span>}
                </li>
              ))}
              {g.items.length > 8 && !all && (
                <li>
                  <button type="button" onClick={() => setAll(true)} className="px-2 py-1 text-xs font-medium text-info hover:underline">
                    Show {g.items.length - 8} more
                  </button>
                </li>
              )}
              {g.total > g.items.length && all && <li className="px-2 py-1 text-xs text-muted-foreground">…and {(g.total - g.items.length).toLocaleString()} more. Download the full list below.</li>}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function cellText(c: Cell | Cell[] | null): string {
  if (!c) return "";
  return Array.isArray(c) ? c.map((x) => x.href ?? x.text).join(" ") : (c.href ?? c.text);
}

function TableView({ t, onInspect }: { t: BreakdownTable; onInspect?: (u: string) => void }) {
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(25);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? t.rows.filter((r) => Object.values(r).some((c) => cellText(c).toLowerCase().includes(needle))) : t.rows;
  }, [q, t.rows]);
  return (
    <div className="space-y-2">
      {t.rows.length > 10 && (
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter these rows…" className="h-8 pl-8 text-sm" />
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50 text-[0.7rem] text-muted-foreground uppercase">
            <tr>
              {t.columns.map((c) => (
                <th key={c.key} className={cn("px-3 py-2 font-semibold whitespace-nowrap", c.align === "right" && "text-right")}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.slice(0, limit).map((r, i) => (
              <tr key={i} className="align-top transition-colors hover:bg-muted/40">
                {t.columns.map((c) => {
                  const v = r[c.key];
                  return (
                    <td key={c.key} className={cn("max-w-[22rem] px-3 py-2", c.align === "right" && "text-right tabular-nums whitespace-nowrap")}>
                      {v == null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : Array.isArray(v) ? (
                        v.length ? (
                          <div className={cn("flex gap-1", c.key === "chain" ? "flex-wrap items-center" : "flex-col")}>
                            {v.map((x, j) => (
                              <span key={j} className="inline-flex min-w-0 items-center gap-1">
                                {c.key === "chain" && j > 0 && <span className="text-muted-foreground">→</span>}
                                <CellView cell={x} onInspect={onInspect} />
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )
                      ) : (
                        <CellView cell={v} onInspect={onInspect} />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          Showing {Math.min(limit, rows.length).toLocaleString()} of {(q ? rows.length : t.total).toLocaleString()}
          {t.total > t.rows.length && !q && ` (first ${t.rows.length.toLocaleString()} listed here; the download has all)`}
        </span>
        {rows.length > limit && (
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setLimit((l) => l + 50)}>
            Show more
          </Button>
        )}
      </div>
    </div>
  );
}

function downloadCsv(name: string, urls: string[]) {
  const esc = (s: string) => (/^[=+\-@\t\r]/.test(s) ? `'${s}` : s).replace(/"/g, '""');
  const blob = new Blob([["url", ...urls].map((u) => `"${esc(u)}"`).join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${name}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function AffectedUrls({ urls, name, onInspect }: { urls: string[]; name: string; onInspect?: (u: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(50);
  const list = useMemo(() => (q ? urls.filter((u) => u.toLowerCase().includes(q.toLowerCase())) : urls), [q, urls]);
  return (
    <section className="rounded-xl border">
      <div className="flex flex-wrap items-center justify-between gap-2 p-3">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 text-sm font-medium">
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
          All affected pages ({urls.length.toLocaleString()})
        </button>
        <div className="flex items-center gap-1">
          <CopyButton value={urls.join("\n")} label="Copy all addresses" className="px-2 py-1" />
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => downloadCsv(name, urls)}>
            <Download className="size-3.5" /> CSV
          </Button>
        </div>
      </div>
      {open && (
        <div className="space-y-2 border-t p-3">
          {urls.length > 10 && <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search addresses…" className="h-8 text-sm" />}
          <ul className="max-h-80 space-y-0.5 overflow-y-auto">
            {list.slice(0, limit).map((u) => (
              <li key={u} className="rounded-md px-2 py-1 hover:bg-muted/60">
                <UrlLink url={u} page onInspect={onInspect} className="w-full" />
              </li>
            ))}
          </ul>
          {list.length > limit && (
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setLimit((l) => l + 200)}>
              Show more ({(list.length - limit).toLocaleString()} left)
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 text-[0.7rem] font-semibold tracking-wide text-muted-foreground uppercase">{children}</h3>;
}

/** The readable part of a finding: what was found, why it matters, how to fix, and the exact rows. */
export function FindingBreakdownView({ b, guidance, onInspect }: { b: Breakdown; guidance?: string | null; onInspect?: (u: string) => void }) {
  return (
    <div className="space-y-6">
      <section>
        <SectionTitle>What we found</SectionTitle>
        <p className="text-[0.95rem] leading-relaxed font-medium">{b.headline}</p>
        {b.meaning && <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">Why it matters: {b.meaning}</p>}
      </section>
      <Notes notes={b.notes} />
      {b.steps.length > 0 && (
        <section>
          <SectionTitle>How to fix it</SectionTitle>
          <ol className="space-y-2">
            {b.steps.map((s, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[0.7rem] font-semibold text-brand-strong">{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
          {guidance && (
            <a href={guidance} target="_blank" rel="noreferrer noopener" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-info hover:underline">
              Read Google&apos;s guidance <ExternalLink className="size-3" />
            </a>
          )}
        </section>
      )}
      {b.groups && b.groups.length > 0 && (
        <section>
          <SectionTitle>Exactly where ({b.groups.length.toLocaleString()})</SectionTitle>
          <div className="space-y-3">
            {b.groups.map((g, i) => (
              <GroupCard key={g.key} g={g} onInspect={onInspect} defaultOpen={i < 3} />
            ))}
          </div>
        </section>
      )}
      {b.table && b.table.rows.length > 0 && (
        <section>
          <SectionTitle>Exactly where</SectionTitle>
          <TableView t={b.table} onInspect={onInspect} />
        </section>
      )}
    </div>
  );
}
