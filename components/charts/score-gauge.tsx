"use client";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { gradeTone } from "@/lib/format";
import { CountUp, EASE } from "@/components/motion/primitives";

const TONE_COLOR = {
  good: "var(--brand)",
  ok: "var(--warning)",
  poor: "var(--high)",
  bad: "var(--critical)",
  none: "var(--muted-foreground)",
};

/** Circular score (0–100) coloured by the engine's own grade; arc and number animate in. */
export function ScoreGauge({ score, grade, size = 156, className, label = "SEO score" }: {
  score: number | null;
  grade: string | null;
  size?: number;
  className?: string;
  label?: string;
}) {
  const reduce = useReducedMotion();
  const stroke = Math.max(8, Math.round(size / 14));
  const r = (size - stroke) / 2 - 4;
  const c = 2 * Math.PI * r;
  const pct = score == null ? 0 : Math.max(0, Math.min(100, score)) / 100;
  const color = TONE_COLOR[gradeTone(grade)];
  const id = `g-${label.replace(/\W/g, "")}-${size}`;
  return (
    <div
      className={cn("relative inline-grid place-items-center", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={score == null ? `${label}: not available` : `${label}: ${score} out of 100, grade ${grade}`}
    >
      <div className="absolute inset-3 rounded-full opacity-60 blur-2xl" style={{ background: score == null ? "transparent" : color, opacity: 0.18 }} aria-hidden />
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="relative -rotate-90">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.65" />
            <stop offset="100%" stopColor={color} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted)" strokeWidth={stroke} />
        {/* tick ring */}
        <circle cx={size / 2} cy={size / 2} r={r + stroke / 2 + 3} fill="none" stroke="var(--border)" strokeWidth={1} strokeDasharray="1 5" />
        {score != null && (
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={`url(#${id})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            initial={reduce ? false : { strokeDashoffset: c }}
            animate={{ strokeDashoffset: c * (1 - pct) }}
            transition={{ duration: 1.2, ease: EASE, delay: 0.1 }}
            style={{ filter: `drop-shadow(0 0 6px ${color})` }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="leading-none font-semibold tracking-tight tabular" style={{ fontSize: size * 0.24 }}>
          {score == null ? "—" : <CountUp value={score} duration={1.2} />}
        </span>
        <span className="mt-1.5 rounded-full bg-muted px-2 py-0.5 text-[0.7rem] font-medium text-muted-foreground">{grade ? `Grade ${grade}` : "No score"}</span>
      </div>
    </div>
  );
}
