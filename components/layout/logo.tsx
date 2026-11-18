import { cn } from "@/lib/utils";

/** Jev SEO mark: a magnifier whose lens holds a rising bar trio. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <rect width="32" height="32" rx="8" fill="var(--sidebar-primary)" />
      <circle cx="14" cy="14" r="7.25" fill="none" stroke="var(--sidebar-primary-foreground)" strokeWidth="2.25" />
      <path d="M19.4 19.4 24.5 24.5" stroke="var(--sidebar-primary-foreground)" strokeWidth="2.5" strokeLinecap="round" />
      <rect x="10.5" y="14.5" width="1.9" height="3.2" rx=".6" fill="var(--sidebar-primary-foreground)" />
      <rect x="13.1" y="12.4" width="1.9" height="5.3" rx=".6" fill="var(--sidebar-primary-foreground)" />
      <rect x="15.7" y="10.3" width="1.9" height="7.4" rx=".6" fill="var(--sidebar-primary-foreground)" />
    </svg>
  );
}

export function Logo({ collapsed }: { collapsed?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark className="shrink-0 drop-shadow-[0_4px_14px_oklch(0.76_0.15_160/0.45)]" />
      {!collapsed && (
        <span className="leading-tight whitespace-nowrap">
          <span className="block text-[0.95rem] font-semibold tracking-tight text-sidebar-accent-foreground">Jev SEO</span>
          <span className="block text-[0.7rem] text-sidebar-muted">Site audit workspace</span>
        </span>
      )}
    </span>
  );
}
