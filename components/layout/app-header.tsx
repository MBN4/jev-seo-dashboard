"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2, Menu, Search, Settings } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { Logo } from "./logo";
import { SidebarNav } from "./app-sidebar";
import { AUDIT_TABS, auditContext, NAV } from "./nav";

function useCrumbs(pathname: string): Array<{ label: string; href?: string }> {
  const ctx = auditContext(pathname);
  if (ctx) {
    const tab = ctx.tab === "progress" ? "Progress" : AUDIT_TABS.find((t) => t.key === (ctx.tab ?? "overview"))?.label ?? "Overview";
    return [{ label: "Audit History", href: "/audits" }, { label: ctx.id, href: `/audits/${encodeURIComponent(ctx.id)}` }, { label: tab }];
  }
  if (pathname === "/") return [{ label: "Overview" }];
  if (pathname === "/audits/new") return [{ label: "Audit History", href: "/audits" }, { label: "New Audit" }];
  const item = NAV.find((n) => n.href === pathname || n.fallback === pathname);
  return [{ label: item?.label ?? "Jev SEO" }];
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
      <span role="status" className="hidden items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground sm:inline-flex">
        <span className="size-1.5 rounded-full bg-brand" /> Engine idle
      </span>
    );
  const r = running[0];
  return (
    <Link
      href={`/audits/${encodeURIComponent(r.id)}/progress`}
      role="status"
      className="inline-flex max-w-[14rem] items-center gap-1.5 rounded-md bg-info-soft px-2 py-1 text-xs font-medium text-info hover:underline"
    >
      <Loader2 className="size-3 shrink-0 animate-spin" aria-hidden />
      <span className="truncate">Auditing {r.domain}{running.length > 1 ? ` +${running.length - 1}` : ""}</span>
    </Link>
  );
}

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const crumbs = useCrumbs(pathname);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/75 sm:px-6">
      <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation">
        <Menu className="size-4" />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-14 items-center border-b border-sidebar-border px-4">
            <Logo />
          </div>
          <div className="overflow-y-auto px-3 py-4">
            <SidebarNav onNavigate={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
      <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
        <ol className="flex min-w-0 items-center gap-1.5 text-sm">
          {crumbs.map((c, i) => (
            <li key={i} className="flex min-w-0 items-center gap-1.5">
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
            </li>
          ))}
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
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search audits by domain" aria-label="Search audits by domain" className="h-8 w-56 bg-card pl-8 text-sm" />
      </form>
      <RunningIndicator />
      <Button variant="ghost" size="icon-sm" asChild>
        <Link href="/settings" aria-label="Settings">
          <Settings className="size-4" />
        </Link>
      </Button>
    </header>
  );
}
