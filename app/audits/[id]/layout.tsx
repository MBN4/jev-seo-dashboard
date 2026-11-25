"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { use } from "react";
import { motion } from "motion/react";
import { FadeIn } from "@/components/motion/primitives";
import { ArrowRight, Download, FileSearch, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/common/status-badge";
import { GradeBadge } from "@/components/common/grade-badge";
import { ErrorState } from "@/components/common/error-state";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingSkeleton } from "@/components/common/loading-skeleton";
import { AuditCtx } from "@/components/audit/audit-context";
import { AUDIT_TABS } from "@/components/layout/nav";
import { useApi } from "@/hooks/use-api";
import { api, ApiError } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function AuditLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id: rawId } = use(params);
  const id = decodeURIComponent(rawId);
  const pathname = usePathname();
  const isProgress = pathname.endsWith("/progress");
  const { data, error, loading, reload } = useApi(() => api.getAudit(id), [id, isProgress]);

  if (isProgress) return <>{children}</>;
  if (loading && !data) return <LoadingSkeleton />;
  if (error) {
    if (error instanceof ApiError && error.status === 404)
      return <EmptyState icon={FileSearch} title="Audit not found" description="It may have been removed from history or its report folder moved." action={<Button asChild variant="outline"><Link href="/audits">Back to history</Link></Button>} />;
    return <ErrorState error={error} onRetry={reload} />;
  }
  const a = data!;
  const base = `/audits/${encodeURIComponent(id)}`;
  const current = pathname.split("/")[3] ?? "overview";

  if (!a.hasResults) {
    return (
      <EmptyState
        icon={a.status === "running" ? Loader2 : FileSearch}
        title={a.status === "running" ? "This audit is still running" : `This audit ${a.status} without results`}
        description={a.error ?? "Results appear here once the engine writes audit.json."}
        action={<Button asChild><Link href={`${base}/progress`}>Open progress <ArrowRight className="size-4" /></Link></Button>}
      />
    );
  }

  return (
    <AuditCtx.Provider value={{ audit: a, reload }}>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-gradient-brand truncate text-2xl font-semibold tracking-tight">{a.domain}</h1>
              <GradeBadge grade={a.grade} score={a.score} />
              <StatusBadge status={a.status} />
              {a.partial.length > 0 && <span className="rounded-md bg-warning-soft px-1.5 py-0.5 text-xs font-medium text-warning-ink" title={a.partial.join("\n")}>Partial audit</span>}
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {a.url} · audited {formatDate(a.finishedAt)} · engine v{a.engineVersion ?? "?"} · {a.origin === "imported" ? "imported from reports folder" : "launched from dashboard"}
            </p>
          </div>
          {a.reports.includes("pdf") && (
            <Button variant="outline" size="sm" asChild>
              <a href={api.reportUrl(id, "pdf")} download><Download className="size-3.5" /> PDF report</a>
            </Button>
          )}
        </div>
        <nav aria-label="Audit sections" className="-mx-4 overflow-x-auto border-b px-4 [mask-image:linear-gradient(to_right,black_calc(100%-48px),transparent)] [scrollbar-width:none] sm:mx-0 sm:px-0 sm:pr-10">
          <ul className="flex min-w-max gap-1">
            {AUDIT_TABS.map((t) => {
              const href = t.key === "overview" ? base : `${base}/${t.key}`;
              const active = current === t.key || (t.key === "overview" && current === "overview");
              const Icon = t.icon;
              return (
                <li key={t.key}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn("group relative flex items-center gap-1.5 px-3 py-3 text-sm whitespace-nowrap transition-colors duration-200", active ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground")}
                  >
                    <span className="absolute inset-x-1 inset-y-1.5 rounded-md bg-muted/0 transition-colors duration-200 group-hover:bg-muted/70" aria-hidden />
                    <Icon className={cn("relative size-3.5 transition-colors", active && "text-brand")} aria-hidden />
                    <span className="relative">{t.label}</span>
                    {active && (
                      <motion.span layoutId="audit-tab-indicator" className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-brand shadow-[0_0_10px_var(--brand)]" transition={{ type: "spring", stiffness: 500, damping: 40 }} aria-hidden />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <FadeIn key={pathname} y={6}>{children}</FadeIn>
      </div>
    </AuditCtx.Provider>
  );
}
