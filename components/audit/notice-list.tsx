"use client";
import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, ChevronDown, Info, OctagonX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Notice } from "@/lib/progress";

const LEVEL = {
  error: { icon: OctagonX, cls: "text-critical", ring: "border-critical/25 bg-critical-soft/50" },
  warning: { icon: AlertTriangle, cls: "text-warning", ring: "border-warning/30 bg-warning-soft/50" },
  info: { icon: Info, cls: "text-info", ring: "border-info/20 bg-info-soft/40" },
};

/** One row per cause (not per log line), each with its count, affected items and fix. */
export function NoticeList({ notices }: { notices: Notice[] }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!notices.length) return <p className="text-sm text-muted-foreground">No warnings.</p>;
  return (
    <ul className="space-y-2">
      {notices.map((n) => {
        const L = LEVEL[n.level];
        const Icon = L.icon;
        const expanded = open === n.key;
        return (
          <li key={n.key} className={cn("rounded-lg border p-3 text-sm", L.ring)}>
            <div className="flex gap-2.5">
              <Icon className={cn("mt-0.5 size-4 shrink-0", L.cls)} aria-hidden />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-medium break-words">{n.title}</p>
                {n.detail && <p className="text-xs text-muted-foreground">{n.detail}</p>}
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  {n.fix && (
                    <Button asChild size="xs" variant="outline">
                      <Link href={n.fix.href}>{n.fix.label}</Link>
                    </Button>
                  )}
                  {n.items.length > 0 && (
                    <button type="button" onClick={() => setOpen(expanded ? null : n.key)} aria-expanded={expanded} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                      {expanded ? "Hide" : "Show"} {n.items.length} affected
                      <ChevronDown className={cn("size-3 transition-transform", expanded && "rotate-180")} />
                    </button>
                  )}
                </div>
                <AnimatePresence initial={false}>
                  {expanded && (
                    <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="max-h-40 space-y-0.5 overflow-auto font-mono text-[0.7rem] text-muted-foreground">
                      {n.items.map((it, i) => <li key={i} className="truncate" title={it}>{it}</li>)}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
