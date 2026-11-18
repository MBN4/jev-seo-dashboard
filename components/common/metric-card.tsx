"use client";
import type { LucideIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { CountUp, EASE } from "@/components/motion/primitives";

const TONE = {
  default: { chip: "text-muted-foreground bg-muted", glow: "var(--muted-foreground)" },
  critical: { chip: "text-critical bg-critical-soft", glow: "var(--critical)" },
  warning: { chip: "text-warning-ink bg-warning-soft", glow: "var(--warning)" },
  info: { chip: "text-info bg-info-soft", glow: "var(--info)" },
  success: { chip: "text-brand-strong bg-success-soft", glow: "var(--brand)" },
};

export function MetricCard({ label, value, hint, icon: Icon, tone = "default", className, index = 0 }: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  tone?: keyof typeof TONE;
  className?: string;
  /** position in its grid, used to stagger the entrance */
  index?: number;
}) {
  const reduce = useReducedMotion();
  const t = TONE[tone];
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, ease: EASE, delay: index * 0.045 }}
      className={cn("group surface surface-hover relative overflow-hidden p-4", className)}
    >
      <div
        className="pointer-events-none absolute -top-10 -right-10 size-28 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-25"
        style={{ background: t.glow }}
        aria-hidden
      />
      <div className="relative flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {Icon && (
          <span className={cn("grid size-8 place-items-center rounded-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3", t.chip)}>
            <Icon className="size-4" aria-hidden />
          </span>
        )}
      </div>
      <p className="relative mt-2 text-[1.7rem] leading-none font-semibold tracking-tight tabular">
        {typeof value === "number" ? <CountUp value={value} /> : value}
      </p>
      {hint && <p className="relative mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    </motion.div>
  );
}
