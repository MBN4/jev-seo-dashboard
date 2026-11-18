import { cn } from "@/lib/utils";
import type { JevAnswer, JevQuestion } from "@/types/engine";

/** Human-readable rendering of one typed Jev answer, using the engine's own criteria text. */
export function describeAnswer(a: JevAnswer, q?: JevQuestion | null): { value: string; criterion: string | null } {
  if (a.type === "noul") {
    const v = Number(a.value);
    const crit = q && !Array.isArray(q.criteria) ? (v >= 0.5 ? q.criteria["true"] : q.criteria["false"]) : null;
    return { value: `P(yes) ${v.toFixed(2)}`, criterion: typeof crit === "string" ? crit : null };
  }
  if (a.type === "score") {
    const raw = a.raw ?? null;
    const levels = a.levels ?? null;
    const crit = q && raw != null ? (Array.isArray(q.criteria) ? q.criteria[Math.round(raw)] : (q.criteria as Record<string, string>)[String(Math.round(raw))]) : null;
    return { value: `${Number(a.value).toFixed(2)}${raw != null && levels ? ` (level ${raw} of ${levels - 1})` : ""}`, criterion: typeof crit === "string" ? crit : null };
  }
  const crit = q && !Array.isArray(q.criteria) ? q.criteria[String(a.value)] : null;
  return { value: String(a.value).replace(/_/g, " "), criterion: typeof crit === "string" ? crit : null };
}

export function BandBadge({ band }: { band?: string }) {
  if (!band) return null;
  const cls =
    band === "act" || band === "yes" ? "bg-success-soft text-brand-strong" : band === "review" ? "bg-warning-soft text-[oklch(0.45_0.11_62)]" : band === "no" ? "bg-high-soft text-high" : "bg-muted text-muted-foreground";
  const label = band === "act" ? "Confident" : band === "review" ? "Needs review" : band === "yes" ? "Yes" : band === "no" ? "No" : band;
  return <span className={cn("rounded px-1.5 py-0.5 text-[0.68rem] font-medium whitespace-nowrap", cls)}>{label}</span>;
}

/** Score answers (0..1) get a small bar; others show their value. */
export function AnswerValue({ a }: { a: JevAnswer }) {
  if (a.type === "score" || a.type === "noul") {
    const v = Math.max(0, Math.min(1, Number(a.value)));
    return (
      <span className="inline-flex items-center gap-2">
        <span className="h-1.5 w-14 overflow-hidden rounded-full bg-muted" aria-hidden>
          <span className={cn("block h-full rounded-full", v >= 0.67 ? "bg-brand" : v >= 0.34 ? "bg-warning" : "bg-critical")} style={{ width: `${v * 100}%` }} />
        </span>
        <span className="tabular text-xs">{v.toFixed(2)}</span>
      </span>
    );
  }
  return <span className="text-xs">{String(a.value).replace(/_/g, " ")}</span>;
}
