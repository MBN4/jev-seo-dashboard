"use client";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip } from "./chart-tooltip";

const LABELS: Record<string, string> = { "2xx": "2xx OK", "3xx": "3xx Redirect", "4xx": "4xx Client error", "5xx": "5xx Server error", error: "Not fetched" };

/** Crawled URLs by HTTP status class (single series). */
export function CrawlStatusChart({ buckets }: { buckets: Record<string, number> }) {
  const data = ["2xx", "3xx", "4xx", "5xx", "error"].filter((k) => buckets[k]).map((k) => ({ key: k, name: LABELS[k], value: buckets[k] }));
  return (
    <div className="h-48 w-full" role="img" aria-label={`Crawl status: ${data.map((d) => `${d.name} ${d.value}`).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 18, right: 8, left: -18, bottom: 0 }} barCategoryGap="30%">
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} interval={0} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
          <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.6 }} content={<ChartTooltip unit=" URLs" />} />
          <Bar dataKey="value" name="URLs" fill="var(--chart-5)" radius={[4, 4, 0, 0]} maxBarSize={40}>
            <LabelList dataKey="value" position="top" style={{ fontSize: 11, fill: "var(--foreground)", fontWeight: 500 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
