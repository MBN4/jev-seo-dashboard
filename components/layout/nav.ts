import { Radar, BadgeCheck, BarChart3, Bot, Table2, ClipboardList, FileText, Gauge, History, LayoutDashboard, ListChecks, PlusCircle, SearchCheck, Settings, Wrench } from "lucide-react";

export type AuditTab = "overview" | "checklist" | "explorer" | "technical" | "extra" | "pages" | "ai" | "performance" | "recommendations" | "reports";

export interface NavItem {
  label: string;
  icon: typeof LayoutDashboard;
  /** static href, or for audit-scoped sections the tab key */
  href?: string;
  tab?: AuditTab;
  /** fallback route when no audit is in context (redirects to the latest audit) */
  fallback?: string;
}

export const NAV: NavItem[] = [
  { label: "Overview", icon: LayoutDashboard, href: "/" },
  { label: "New Audit", icon: PlusCircle, href: "/audits/new" },
  { label: "Audit History", icon: History, href: "/audits" },
  { label: "Monitoring", icon: Radar, href: "/monitoring" },
  { label: "Google Checklist", icon: BadgeCheck, tab: "checklist", fallback: "/google-checklist" },
  { label: "Site Explorer", icon: Table2, tab: "explorer", fallback: "/site-explorer" },
  { label: "Technical SEO", icon: Wrench, tab: "technical", fallback: "/technical" },
  { label: "Extra Checks", icon: SearchCheck, tab: "extra", fallback: "/extra-checks" },
  { label: "Page Analysis", icon: ClipboardList, tab: "pages", fallback: "/page-analysis" },
  { label: "AI Content Analysis", icon: Bot, tab: "ai", fallback: "/ai-content" },
  { label: "Performance", icon: Gauge, tab: "performance", fallback: "/performance" },
  { label: "Recommendations", icon: ListChecks, tab: "recommendations", fallback: "/recommendations" },
  { label: "Reports", icon: FileText, href: "/reports" },
  { label: "Settings", icon: Settings, href: "/settings" },
];

export const AUDIT_TABS: Array<{ key: AuditTab; label: string; icon: typeof BarChart3 }> = [
  { key: "overview", label: "Overview", icon: BarChart3 },
  { key: "checklist", label: "Google Checklist", icon: BadgeCheck },
  { key: "explorer", label: "Site Explorer", icon: Table2 },
  { key: "technical", label: "Technical SEO", icon: Wrench },
  { key: "extra", label: "Extra Checks", icon: SearchCheck },
  { key: "pages", label: "Pages", icon: ClipboardList },
  { key: "ai", label: "AI Content", icon: Bot },
  { key: "performance", label: "Performance", icon: Gauge },
  { key: "recommendations", label: "Recommendations", icon: ListChecks },
  { key: "reports", label: "Reports", icon: FileText },
];

/** /audits/<id>/<tab> -> { id, tab } */
export function auditContext(pathname: string): { id: string; tab: string | null } | null {
  const m = pathname.match(/^\/audits\/([^/]+)(?:\/([^/]+))?/);
  if (!m || m[1] === "new") return null;
  return { id: decodeURIComponent(m[1]), tab: m[2] ?? null };
}

export function navHref(item: NavItem, pathname: string): string {
  if (item.href) return item.href;
  const ctx = auditContext(pathname);
  if (ctx && ctx.tab !== "progress") return `/audits/${encodeURIComponent(ctx.id)}/${item.tab}`;
  return item.fallback ?? "/";
}

export function isActive(item: NavItem, pathname: string): boolean {
  const ctx = auditContext(pathname);
  if (item.tab) return (ctx?.tab === item.tab) || pathname === item.fallback;
  if (item.href === "/") return pathname === "/";
  if (item.href === "/audits") return pathname === "/audits" || Boolean(ctx && (ctx.tab === null || ctx.tab === "overview" || ctx.tab === "progress"));
  if (item.href === "/reports") return pathname === "/reports" || ctx?.tab === "reports";
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
