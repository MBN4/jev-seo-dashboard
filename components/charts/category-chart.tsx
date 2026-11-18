"use client";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip } from "./chart-tooltip";

/** Single-series horizontal bars: findings per engine category. */
export function CategoryChart({ data }: { data: Array<{ key: string; name: string; total: number }> }) {
  const rows = [...data].sort((a, b) => b.total - a.total);
  const height = Math.max(170, rows.length * 36 + 24);
  return (
    <div className="w-full" style={{ height }} role="img" aria-label={`Findings by category: ${rows.map((d) => `${d.name} ${d.total}`).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }} barCategoryGap="26%">
          <defs>
            <linearGradient id="cat-fill" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.55} />
              <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={1} />
            </linearGradient>
          </defs>
          <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 4" />
          <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
          <YAxis type="category" dataKey="name" width={150} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--foreground)" }} />
          <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.5, radius: 6 }} content={<ChartTooltip />} />
          <Bar dataKey="total" name="Findings" fill="url(#cat-fill)" radius={[2, 6, 6, 2]} maxBarSize={18} animationDuration={900} animationEasing="ease-out">
            <LabelList dataKey="total" position="right" style={{ fontSize: 11, fill: "var(--foreground)", fontWeight: 600 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
