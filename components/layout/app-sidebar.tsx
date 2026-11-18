"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Logo } from "./logo";
import { NAV, isActive, navHref } from "./nav";
import { SIDEBAR_DEFAULT, SIDEBAR_MAX, SIDEBAR_MIN, SIDEBAR_RAIL, useSidebar } from "./sidebar-state";

const fade = { initial: { opacity: 0, x: -6 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -6 }, transition: { duration: 0.18 } };

export function SidebarNav({ collapsed = false, onNavigate, layoutGroup = "desktop" }: { collapsed?: boolean; onNavigate?: () => void; layoutGroup?: string }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const groups = [NAV.slice(0, 3), NAV.slice(3, 8), NAV.slice(8)];
  const titles = ["Workspace", "Analysis", "Manage"];
  return (
    <nav aria-label="Main" className="flex flex-col gap-5">
      {groups.map((items, gi) => (
        <div key={gi} className="space-y-0.5">
          <div className="h-5 px-3">
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.p {...fade} className="text-[0.66rem] font-semibold tracking-[0.08em] whitespace-nowrap text-sidebar-muted uppercase">
                  {titles[gi]}
                </motion.p>
              )}
            </AnimatePresence>
            {collapsed && gi > 0 && <div className="mx-auto mt-2 h-px w-6 bg-sidebar-border" aria-hidden />}
          </div>
          {items.map((item) => {
            const active = isActive(item, pathname);
            const Icon = item.icon;
            const link = (
              <Link
                href={navHref(item, pathname)}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex h-9 items-center gap-3 rounded-lg px-3 text-sm text-sidebar-foreground/75 transition-colors duration-200 hover:text-sidebar-accent-foreground focus-visible:outline-2 focus-visible:outline-sidebar-ring",
                  active && "text-sidebar-accent-foreground",
                )}
              >
                {active && (
                  <motion.span
                    layoutId={`nav-active-${layoutGroup}`}
                    className="absolute inset-0 rounded-lg bg-sidebar-accent shadow-[inset_0_1px_0_0_oklch(1_0_0/0.06)]"
                    transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 38 }}
                    aria-hidden
                  >
                    <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-sidebar-primary shadow-[0_0_12px_var(--sidebar-primary)]" />
                  </motion.span>
                )}
                <span className="pointer-events-none absolute inset-0 rounded-lg bg-sidebar-accent/0 transition-colors duration-200 group-hover:bg-sidebar-accent/60" aria-hidden />
                <Icon className={cn("relative size-[17px] shrink-0 transition-[color,transform] duration-200 group-hover:scale-110", active ? "text-sidebar-primary" : "text-sidebar-muted group-hover:text-sidebar-accent-foreground")} aria-hidden />
                <AnimatePresence initial={false}>
                  {!collapsed && (
                    <motion.span {...fade} className="relative truncate whitespace-nowrap">
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
                {collapsed && <span className="sr-only">{item.label}</span>}
              </Link>
            );
            return collapsed ? (
              <Tooltip key={item.label}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right" sideOffset={10}>{item.label}</TooltipContent>
              </Tooltip>
            ) : (
              <div key={item.label}>{link}</div>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

/** Drag handle on the sidebar's right edge: drag to resize, drag far left to collapse, double-click to reset. */
function ResizeHandle() {
  const { width, collapsed, setWidth, setCollapsed, setDragging, toggle } = useSidebar();
  const start = useRef<{ x: number; w: number } | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      start.current = { x: e.clientX, w: collapsed ? SIDEBAR_RAIL : width };
      setDragging(true);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [collapsed, width, setDragging],
  );
  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!start.current) return;
      const next = start.current.w + (e.clientX - start.current.x);
      if (next < SIDEBAR_MIN - 60) {
        if (!collapsed) {
          // Keep the width the user had before dragging, so expanding restores it.
          if (start.current.w >= SIDEBAR_MIN) setWidth(start.current.w);
          setCollapsed(true);
        }
      } else {
        if (collapsed) setCollapsed(false);
        setWidth(next);
      }
    },
    [collapsed, setCollapsed, setWidth],
  );
  const end = useCallback(() => {
    start.current = null;
    setDragging(false);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, [setDragging]);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      aria-valuemin={SIDEBAR_MIN}
      aria-valuemax={SIDEBAR_MAX}
      aria-valuenow={collapsed ? SIDEBAR_RAIL : width}
      tabIndex={0}
      title="Drag to resize · double-click to reset · Ctrl+B to toggle"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onDoubleClick={() => {
        setCollapsed(false);
        setWidth(SIDEBAR_DEFAULT);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") {
          if (collapsed) return;
          if (width - 16 < SIDEBAR_MIN) setCollapsed(true);
          else setWidth(width - 16);
        } else if (e.key === "ArrowRight") {
          if (collapsed) setCollapsed(false);
          else setWidth(width + 16);
        } else if (e.key === "Enter") toggle();
        else return;
        e.preventDefault();
      }}
      className="group absolute inset-y-0 -right-1.5 z-20 w-3 cursor-col-resize touch-none focus-visible:outline-none"
    >
      <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent transition-colors duration-200 group-hover:bg-sidebar-primary/70 group-focus-visible:bg-sidebar-primary group-active:bg-sidebar-primary" />
    </div>
  );
}

export function AppSidebar() {
  const { width, collapsed, dragging, toggle } = useSidebar();
  const reduce = useReducedMotion();
  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? SIDEBAR_RAIL : width }}
      transition={dragging || reduce ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 40 }}
      className="sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex"
      style={{ backgroundImage: "radial-gradient(400px 220px at 0% 0%, oklch(0.76 0.15 160 / 0.08), transparent 70%)" }}
    >
      <ResizeHandle />
      <div className={cn("flex h-16 items-center gap-2 overflow-hidden border-b border-sidebar-border px-4", collapsed && "justify-center px-0")}>
        <Link href="/" className="rounded-lg focus-visible:outline-2 focus-visible:outline-sidebar-ring" aria-label="Jev SEO home">
          <Logo collapsed={collapsed} />
        </Link>
      </div>
      <div className={cn("flex-1 overflow-x-hidden overflow-y-auto py-4", collapsed ? "px-2.5" : "px-3")}>
        <SidebarNav collapsed={collapsed} />
      </div>
      <div className={cn("border-t border-sidebar-border p-3", collapsed && "px-2.5")}>
        <button
          type="button"
          onClick={toggle}
          className="group flex h-9 w-full items-center gap-2.5 overflow-hidden rounded-lg px-3 text-xs text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-2 focus-visible:outline-sidebar-ring"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
        >
          <motion.span animate={{ rotate: collapsed ? 180 : 0 }} transition={{ type: "spring", stiffness: 300, damping: 24 }} className="grid shrink-0 place-items-center">
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </motion.span>
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.span {...fade} className="flex flex-1 items-center justify-between whitespace-nowrap">
                Collapse <kbd className="rounded border border-sidebar-border px-1 font-mono text-[0.62rem]">Ctrl B</kbd>
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </motion.aside>
  );
}
