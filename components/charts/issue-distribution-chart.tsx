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
    <div className="h-56 w-full" role="img" aria-label={`Findings by severity: ${data.map((d) => `${d.name} ${d.value}`).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 18, right: 8, left: -18, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
          <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
          <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.6 }} content={<ChartTooltip />} />
          <Bar dataKey="value" name="Findings" radius={[4, 4, 0, 0]} maxBarSize={44}>
            {data.map((d) => (
              <Cell key={d.key} fill={d.fill} />
            ))}
            <LabelList dataKey="value" position="top" style={{ fontSize: 11, fill: "var(--foreground)", fontWeight: 500 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
