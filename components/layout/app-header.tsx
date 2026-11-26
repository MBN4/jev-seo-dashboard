"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Bell, Menu, PanelLeft, Search, Settings } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { Logo } from "./logo";
import { SidebarNav } from "./app-sidebar";
import { AUDIT_TABS, auditContext, NAV } from "./nav";
import { ThemeToggle } from "./theme-toggle";
import { useSidebar } from "./sidebar-state";
import { BRAND } from "@/lib/brand";

function useCrumbs(pathname: string): Array<{ label: string; href?: string }> {
  const ctx = auditContext(pathname);
  if (ctx) {
    const tab = ctx.tab === "progress" ? "Progress" : AUDIT_TABS.find((t) => t.key === (ctx.tab ?? "overview"))?.label ?? "Overview";
    return [{ label: "Audit History", href: "/audits" }, { label: ctx.id, href: `/audits/${encodeURIComponent(ctx.id)}` }, { label: tab }];
  }
  if (pathname === "/") return [{ label: "Overview" }];
  if (pathname === "/audits/new") return [{ label: "Audit History", href: "/audits" }, { label: "New Audit" }];
  const item = NAV.find((n) => n.href === pathname || n.fallback === pathname);
  return [{ label: item?.label ?? BRAND.name }];
}

function RunningIndicator() {
  const [running, setRunning] = useState<Array<{ id: string; domain: string }>>([]);
  const [online, setOnline] = useState(true);
  useEffect(() => {
    let alive = true;
    const poll = () =>
      api
        .health()
        .then((h) => {
          if (!alive) return;
          setRunning(h.running);
          setOnline(true);
        })
        .catch(() => alive && setOnline(false));
    poll();
    const t = setInterval(poll, 5000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  if (!online)
    return (
      <span role="status" className="inline-flex items-center gap-1.5 rounded-md bg-critical-soft px-2 py-1 text-xs font-medium text-critical">
        <span className="size-1.5 rounded-full bg-critical" /> Server offline
      </span>
    );
  if (!running.length)
    return (
      <span role="status" className="hidden items-center gap-2 rounded-full border bg-card/60 px-2.5 py-1 text-xs text-muted-foreground sm:inline-flex">
        <span className="relative flex size-1.5"><span className="size-1.5 rounded-full bg-brand" /></span> Engine idle
      </span>
    );
  const r = running[0];
  return (
    <Link
      href={`/audits/${encodeURIComponent(r.id)}/progress`}
      role="status"
      className="inline-flex max-w-[15rem] items-center gap-2 rounded-full border border-info/25 bg-info-soft px-2.5 py-1 text-xs font-medium text-info transition-shadow hover:shadow-[0_0_0_3px_var(--info-soft)]"
    >
      <span className="relative flex size-2 shrink-0" aria-hidden>
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-info opacity-60" />
        <span className="relative inline-flex size-2 rounded-full bg-info" />
      </span>
      <span className="truncate">Auditing {r.domain}{running.length > 1 ? ` +${running.length - 1}` : ""}</span>
    </Link>
  );
}

/** Bell with the number of unread monitoring changes; toasts when a new one arrives. */
function MonitorBell() {
  const [unseen, setUnseen] = useState(0);
  const last = useRef<string | null>(null);
  useEffect(() => {
    let alive = true;
    const poll = () =>
      api
        .monitor()
        .then((m) => {
          if (!alive) return;
          setUnseen(m.unseen);
          const top = m.events.find((e) => !e.seen);
          if (top && last.current !== null && top.id !== last.current && top.kind !== "baseline") {
            toast(`${top.domain}: ${top.title}`, { action: { label: "View", onClick: () => (window.location.href = "/monitoring") } });
          }
          last.current = top?.id ?? "";
        })
        .catch(() => undefined);
    poll();
    const t = setInterval(poll, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  return (
    <Button variant="ghost" size="icon-sm" asChild>
      <Link href="/monitoring" aria-label={unseen ? `Monitoring: ${unseen} unread changes` : "Monitoring"} title="Site monitoring" className="relative">
        <Bell className="size-4" />
        {unseen > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-critical px-1 text-[0.6rem] font-semibold text-white tabular-nums">{unseen > 99 ? "99+" : unseen}</span>
        )}
      </Link>
    </Button>
  );
}

export function AppHeader() {
  const pathname = usePathname();
  const sidebar = useSidebar();
  const router = useRouter();
  const crumbs = useCrumbs(pathname);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/70 px-4 backdrop-blur-xl backdrop-saturate-150 sm:px-6">
      <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation">
        <Menu className="size-4" />
      </Button>
      <Button variant="ghost" size="icon-sm" className="hidden lg:inline-flex" onClick={sidebar.toggle} aria-label={sidebar.collapsed ? "Expand sidebar" : "Collapse sidebar"} title="Toggle sidebar (Ctrl+B)">
        <PanelLeft className="size-4" />
      </Button>
      <span className="hidden h-5 w-px bg-border lg:block" aria-hidden />
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-14 items-center border-b border-sidebar-border px-4">
            <Logo />
          </div>
          <div className="overflow-y-auto px-3 py-4">
            <SidebarNav layoutGroup="mobile" onNavigate={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
      <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
        <ol className="flex min-w-0 items-center gap-1.5 text-sm">
          <AnimatePresence initial={false} mode="popLayout">
          {crumbs.map((c, i) => (
            <motion.li key={`${i}-${c.label}`} layout initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex min-w-0 items-center gap-1.5">
              {i > 0 && <span className="text-muted-foreground/60" aria-hidden>/</span>}
              {c.href ? (
                <Link href={c.href} className="truncate text-muted-foreground hover:text-foreground">
                  {c.label}
                </Link>
              ) : (
                <span aria-current="page" className="truncate font-medium">
                  {c.label}
                </span>
              )}
            </motion.li>
          ))}
          </AnimatePresence>
        </ol>
      </nav>
      <form
        role="search"
        className="relative hidden md:block"
        onSubmit={(e) => {
          e.preventDefault();
          router.push(`/audits${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`);
        }}
      >
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search audits by domain" aria-label="Search audits by domain" className="h-9 w-56 rounded-full bg-card/70 pl-8 text-sm transition-[width,box-shadow] duration-300 focus-visible:w-72" />
      </form>
      <RunningIndicator />
      <MonitorBell />
      <ThemeToggle />
      <Button variant="ghost" size="icon-sm" asChild>
        <Link href="/settings" aria-label="Settings">
          <Settings className="size-4" />
        </Link>
      </Button>
    </header>
  );
}
