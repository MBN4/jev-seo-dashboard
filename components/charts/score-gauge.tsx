import { cn } from "@/lib/utils";
import { gradeTone } from "@/lib/format";

const TONE_COLOR = {
  good: "var(--brand)",
  ok: "var(--warning)",
  poor: "var(--high)",
  bad: "var(--critical)",
  none: "var(--muted-foreground)",
};

/** Circular score (0–100) coloured by the engine's own grade. */
export function ScoreGauge({ score, grade, size = 148, className, label = "SEO score" }: {
  score: number | null;
  grade: string | null;
  size?: number;
  className?: string;
  label?: string;
}) {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = score == null ? 0 : Math.max(0, Math.min(100, score)) / 100;
  const color = TONE_COLOR[gradeTone(grade)];
  return (
    <div className={cn("relative inline-grid place-items-center", className)} style={{ width: size, height: size }} role="img" aria-label={score == null ? `${label}: not available` : `${label}: ${score} out of 100, grade ${grade}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted)" strokeWidth={stroke} />
        {score != null && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${c * pct} ${c}`}
            className="transition-[stroke-dasharray] duration-700 ease-out"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[2.1rem] leading-none font-semibold tracking-tight tabular">{score ?? "—"}</span>
        <span className="mt-1 text-xs text-muted-foreground">{grade ? `Grade ${grade}` : "No score"}</span>
      </div>
    </div>
  );
}
