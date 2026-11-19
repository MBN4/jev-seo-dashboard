import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";

/** Lettermark: brand initials on the accent tile. Swap for an <img> once a logo file exists. */
export function LogoMark({ className }: { className?: string }) {
  const text = BRAND.initials || "R";
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <defs>
        <linearGradient id="logo-tile" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--sidebar-primary)" />
          <stop offset="100%" stopColor="var(--brand)" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#logo-tile)" />
      <rect x="0.5" y="0.5" width="31" height="31" rx="8.5" fill="none" stroke="white" strokeOpacity="0.18" />
      <text
        x="16"
        y="16.5"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="var(--font-sans)"
        fontWeight="700"
        fontSize={text.length > 1 ? 13 : 17}
        letterSpacing="-0.5"
        fill="var(--sidebar-primary-foreground)"
      >
        {text}
      </text>
    </svg>
  );
}

export function Logo({ collapsed }: { collapsed?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark className="shrink-0 drop-shadow-[0_4px_14px_oklch(0.76_0.15_160/0.45)]" />
      {!collapsed && (
        <span className="leading-tight whitespace-nowrap">
          <span className="block text-[0.95rem] font-semibold tracking-tight text-sidebar-accent-foreground">{BRAND.name}</span>
          <span className="block text-[0.7rem] text-sidebar-muted">{BRAND.tagline}</span>
        </span>
      )}
    </span>
  );
}
