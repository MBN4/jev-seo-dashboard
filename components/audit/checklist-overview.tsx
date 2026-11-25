"use client";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SeverityBadge } from "@/components/common/severity-badge";
import { ScoreGauge } from "@/components/charts/score-gauge";
import { EASE } from "@/components/motion/primitives";
import { SECTION_SHORT, SplitBar } from "./checklist-status";
import type { Checklist } from "@/lib/server/checklist";

function gradeFor(score: number | null) {
  if (score == null) return null;
  return score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "F";
}

/**
 * The first thing after an audit: how the site measures up against Google's own guidance,
 * area by area, with the most important failures to fix first.
 */
export function ChecklistOverview({ data, auditId, compact = false }: { data: Checklist; auditId: string; compact?: boolean }) {
  const reduce = useReducedMotion();
  const base = `/audits/${encodeURIComponent(auditId)}/checklist`;
  const t = data.totals;
  return (
    <section className="surface relative overflow-hidden" aria-labelledby="google-guidelines-title">
      <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-brand/10 blur-3xl" aria-hidden />
      <div className="relative grid gap-6 p-5 lg:grid-cols-[auto_1fr] lg:p-6">
        <div className="flex flex-col items-center gap-3 lg:w-56">
          <div className="flex items-center gap-1.5 self-start text-xs font-semibold tracking-wide text-brand-strong uppercase lg:self-center">
            <BadgeCheck className="size-4" aria-hidden /> Google guidelines
          </div>
          <ScoreGauge score={data.score} grade={gradeFor(data.score)} size={150} label="Google guidelines met" />
          <p id="google-guidelines-title" className="text-center text-sm">
            <span className="font-semibold tabular">{t.pass}</span> of <span className="tabular">{t.pass + t.fail}</span> checked rules met
          </p>
          <p className="text-center text-xs text-muted-foreground">
            {t.fail} need work · {t.not_checked} not checked · {t.manual} manual
          </p>
          {!compact && (
            <Button asChild size="sm" className="w-full">
              <Link href={base}>Open Google checklist <ArrowRight className="size-3.5" /></Link>
            </Button>
          )}
        </div>
        <div className="min-w-0 space-y-5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {data.sections.map((s, idx) => (
              <motion.div
                key={s.key}
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: EASE, delay: idx * 0.03 }}
              >
                <Link href={`${base}#${s.key}`} className="group block rounded-lg border bg-card/60 p-3 transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-[var(--shadow-raised)]">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-xs font-medium">{SECTION_SHORT[s.key] ?? s.title}</span>
                    <span className="text-xs tabular text-muted-foreground">{s.score == null ? "—" : `${s.score}%`}</span>
                  </div>
                  <SplitBar counts={s.counts} className="mt-2" />
                  <p className="mt-1.5 text-[0.68rem] text-muted-foreground">
                    {s.counts.fail ? <span className="font-medium text-critical">{s.counts.fail} to fix</span> : s.counts.pass ? "All checked rules met" : "Not checked"}
                    {s.counts.fail > 0 && s.counts.pass > 0 && <> · {s.counts.pass} met</>}
                  </p>
                </Link>
              </motion.div>
            ))}
          </div>
          {data.topFailures.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Fix these first</p>
              <ul className="divide-y rounded-lg border">
                {data.topFailures.map((f) => (
                  <li key={f.id}>
                    <Link href={`${base}#${f.id}`} className="flex items-center gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-muted/50">
                      {f.severity && <SeverityBadge severity={f.severity} />}
                      <span className="min-w-0 flex-1 truncate font-medium">{f.rule}</span>
                      {f.urlCount > 0 && <span className="shrink-0 text-xs text-muted-foreground tabular">{f.urlCount} URL{f.urlCount === 1 ? "" : "s"}</span>}
                      <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
