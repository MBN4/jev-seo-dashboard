"use client";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip } from "./chart-tooltip";

/** Single-series horizontal bars: findings per engine category. */
export function CategoryChart({ data }: { data: Array<{ key: string; name: string; total: number }> }) {
  const rows = [...data].sort((a, b) => b.total - a.total);
  const height = Math.max(160, rows.length * 34 + 24);
  return (
    <div className="w-full" style={{ height }} role="img" aria-label={`Findings by category: ${rows.map((d) => `${d.name} ${d.total}`).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 28, left: 0, bottom: 0 }} barCategoryGap="24%">
          <CartesianGrid horizontal={false} stroke="var(--border)" />
          <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
          <YAxis type="category" dataKey="name" width={150} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--foreground)" }} />
          <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.6 }} content={<ChartTooltip />} />
          <Bar dataKey="total" name="Findings" fill="var(--chart-2)" radius={[0, 4, 4, 0]} maxBarSize={18}>
            <LabelList dataKey="total" position="right" style={{ fontSize: 11, fill: "var(--foreground)", fontWeight: 500 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
