import { CheckCircle2, CircleDashed, Info, UserSearch, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ItemStatus } from "@/lib/google-checklist";

export const STATUS_META: Record<ItemStatus, { label: string; icon: typeof CheckCircle2; cls: string; chip: string }> = {
  pass: { label: "Passed", icon: CheckCircle2, cls: "text-brand", chip: "bg-success-soft text-brand-strong" },
  fail: { label: "Needs work", icon: XCircle, cls: "text-critical", chip: "bg-critical-soft text-critical" },
  note: { label: "Note", icon: Info, cls: "text-info", chip: "bg-info-soft text-info" },
  not_checked: { label: "Not checked", icon: CircleDashed, cls: "text-muted-foreground", chip: "bg-muted text-muted-foreground" },
  manual: { label: "Manual check", icon: UserSearch, cls: "text-muted-foreground", chip: "bg-muted text-muted-foreground" },
};

export const SECTION_SHORT: Record<string, string> = {
  crawl: "Crawling",
  index: "Indexing",
  titles: "Titles & snippets",
  keywords: "Keywords",
  content: "Content & E-E-A-T",
  links: "Links",
  images: "Images",
  structured: "Structured data",
  experience: "Page experience",
  international: "International",
  spam: "Spam policies",
  ai: "AI features",
  visibility: "Visibility",
};

export function StatusIcon({ status, className }: { status: ItemStatus; className?: string }) {
  const m = STATUS_META[status];
  const Icon = m.icon;
  return <Icon className={cn("size-4 shrink-0", m.cls, className)} aria-label={m.label} />;
}

/** Pass / fail split bar for a section (not-checked shown as the grey remainder). */
export function SplitBar({ counts, className }: { counts: Record<ItemStatus, number>; className?: string }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  const seg = (n: number) => `${(n / total) * 100}%`;
  return (
    <div className={cn("flex h-1.5 overflow-hidden rounded-full bg-muted", className)} aria-hidden>
      <span className="h-full bg-brand transition-[width] duration-700" style={{ width: seg(counts.pass) }} />
      <span className="h-full bg-critical/80 transition-[width] duration-700" style={{ width: seg(counts.fail) }} />
      <span className="h-full bg-info/60 transition-[width] duration-700" style={{ width: seg(counts.note) }} />
    </div>
  );
}
