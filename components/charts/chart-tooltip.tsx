/** Shared Recharts tooltip body: text in ink tokens, a swatch carries identity. */
export function ChartTooltip({ active, payload, label, unit, labelFormatter }: {
  active?: boolean;
  payload?: Array<{ value?: number | string; name?: string; color?: string; payload?: Record<string, unknown> }>;
  label?: string | number;
  unit?: string;
  labelFormatter?: (l: string | number | undefined, p?: Record<string, unknown>) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-[var(--shadow-raised)]">
      <p className="mb-1 font-medium">{labelFormatter ? labelFormatter(label, payload[0]?.payload) : label}</p>
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2 text-muted-foreground">
          <span className="size-2 rounded-sm" style={{ background: (p.payload?.fill as string) ?? p.color }} aria-hidden />
          <span>{p.name}</span>
          <span className="ml-auto font-medium text-foreground tabular">
            {p.value}
            {unit}
          </span>
        </p>
      ))}
    </div>
  );
}
