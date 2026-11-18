import { cn } from "@/lib/utils";

/** Engine category scores (0–100 or not assessed) with the engine's own notes. */
export function CategoryScores({ categories, names, weights, notes }: {
  categories: Record<string, number | null>;
  names: Record<string, string>;
  weights: Record<string, number>;
  notes?: Record<string, string>;
}) {
  return (
    <ul className="space-y-3">
      {Object.entries(categories).map(([key, v]) => (
        <li key={key} className="space-y-1">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate">
              {names[key] ?? key} <span className="text-xs text-muted-foreground">· weight {weights[key] ?? "—"}</span>
            </span>
            <span className={cn("font-medium tabular", v == null && "text-muted-foreground")}>{v == null ? "Not assessed" : v}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
            {v != null && (
              <div
                className={cn("h-full rounded-full", v >= 75 ? "bg-brand" : v >= 60 ? "bg-warning" : v >= 40 ? "bg-high" : "bg-critical")}
                style={{ width: `${v}%` }}
              />
            )}
          </div>
          {notes?.[key] && <p className="text-xs text-muted-foreground">{notes[key]}</p>}
        </li>
      ))}
    </ul>
  );
}
