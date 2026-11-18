"use client";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SEVERITY_META } from "@/components/common/severity-badge";
import type { Severity } from "@/types/engine";
import { ChartTooltip } from "./chart-tooltip";

const ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];

/** Findings by severity. Each bar is named on the axis, so colour is never the only cue. */
export function IssueDistributionChart({ counts }: { counts: Record<string, number> }) {
  const data = ORDER.map((s) => ({ key: s, name: SEVERITY_META[s].label, value: counts[s] ?? 0, fill: SEVERITY_META[s].hex }));
  return (
    <div className="h-60 w-full" role="img" aria-label={`Findings by severity: ${data.map((d) => `${d.name} ${d.value}`).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 22, right: 8, left: -18, bottom: 0 }} barCategoryGap="30%">
          <defs>
            {data.map((d) => (
              <linearGradient key={d.key} id={`sev-${d.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={d.fill} stopOpacity={1} />
                <stop offset="100%" stopColor={d.fill} stopOpacity={0.55} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
          <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
          <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.5, radius: 6 }} content={<ChartTooltip />} />
          <Bar dataKey="value" name="Findings" radius={[6, 6, 2, 2]} maxBarSize={46} animationDuration={900} animationEasing="ease-out">
            {data.map((d) => (
              <Cell key={d.key} fill={`url(#sev-${d.key})`} />
            ))}
            <LabelList dataKey="value" position="top" style={{ fontSize: 11, fill: "var(--foreground)", fontWeight: 600 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
