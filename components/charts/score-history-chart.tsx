"use client";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDate } from "@/lib/format";
import { ChartTooltip } from "./chart-tooltip";

/** Overall score over saved audits of one domain. Only real, completed audits are plotted. */
export function ScoreHistoryChart({ points }: { points: Array<{ id: string; date: string | null; score: number; grade: string | null }> }) {
  const data = points.map((p) => ({ ...p, label: formatDate(p.date, false) }));
  return (
    <div className="h-56 w-full" role="img" aria-label={`Score history: ${data.map((d) => `${d.label} ${d.score}`).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 12, left: -18, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} minTickGap={24} />
          <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
          <Tooltip
            cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1, strokeDasharray: "3 3" }}
            content={<ChartTooltip labelFormatter={(_l, p) => `${formatDate((p?.date as string) ?? null)} · grade ${(p?.grade as string) ?? "—"}`} />}
          />
          <Line type="monotone" dataKey="score" name="Score" stroke="var(--brand)" strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: "var(--card)" }} activeDot={{ r: 5 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
