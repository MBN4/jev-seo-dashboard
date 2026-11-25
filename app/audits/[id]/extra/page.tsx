"use client";
import { useEffect, useMemo, useState } from "react";
import { UrlLink } from "@/components/audit/finding-breakdown-view";
import { PageDetailsDrawer } from "@/components/audit/page-details-drawer";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import {
  BookOpen, Check, ChevronDown, ExternalLink, FileCode2, ImageIcon, Link2, Loader2, Minus, Plus, SearchCheck, Share2, ShieldCheck, Type, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/common/section-card";
import { MetricCard } from "@/components/common/metric-card";
import { SeverityBadge } from "@/components/common/severity-badge";
import { FilterChip } from "@/components/common/filter-chip";
import { ErrorState } from "@/components/common/error-state";
import { LoadingSkeleton } from "@/components/common/loading-skeleton";
import { useAudit } from "@/components/audit/audit-context";
import { useApi } from "@/hooks/use-api";
import { api, ApiError } from "@/lib/api";
import { shortUrl } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ExtraFinding, ExtraGroup } from "@/lib/server/extra-checks";

const GROUPS: Record<ExtraGroup, { label: string; icon: typeof Type; hint: string }> = {
  keywords: { label: "Focus keywords", icon: Type, hint: "Rank Math-style on-page keyword placement" },
  eeat: { label: "E-E-A-T and trust", icon: ShieldCheck, hint: "About, contact, authors, dates, organization identity" },
  urls: { label: "URL structure", icon: Link2, hint: "Google's URL structure guidance" },
  schema: { label: "Structured data coverage", icon: FileCode2, hint: "Breadcrumbs and article markup" },
  links: { label: "Internal linking", icon: Link2, hint: "How pages connect to each other" },
  content: { label: "Content quality", icon: BookOpen, hint: "Readability and keyword stuffing" },
  images: { label: "Images", icon: ImageIcon, hint: "Lazy loading" },
  social: { label: "Social sharing", icon: Share2, hint: "Preview cards" },
};
const GROUP_ORDER: ExtraGroup[] = ["keywords", "eeat", "content", "urls", "schema", "links", "images", "social"];
const CHECK_LABELS = { title: "Title", h1: "H1", url: "URL", meta: "Meta", intro: "Intro" } as const;

function KeywordEditor({ auditId, initial, onSaved }: { auditId: string; initial: string[]; onSaved: () => void }) {
  const [list, setList] = useState(initial);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => setList(initial), [initial]);
  const dirty = list.join("|") !== initial.join("|");
  const addDraft = () => {
    const parts = draft.split(",").map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    setList((l) => [...new Set([...l, ...parts])].slice(0, 10));
    setDraft("");
  };
  const save = async () => {
    setSaving(true);
    try {
      await api.setKeywords(auditId, list);
      toast.success("Focus keywords saved");
      onSaved();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not save keywords");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5" aria-live="polite">
        <AnimatePresence initial={false}>
          {list.map((k) => (
            <motion.span
              key={k}
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="inline-flex items-center gap-1 rounded-full border border-brand/30 bg-brand-soft py-0.5 pr-1 pl-2.5 text-xs font-medium text-brand-strong"
            >
              {k}
              <button type="button" onClick={() => setList((l) => l.filter((x) => x !== k))} className="grid size-4 place-items-center rounded-full hover:bg-brand/20" aria-label={`Remove ${k}`}>
                <X className="size-3" />
              </button>
            </motion.span>
          ))}
        </AnimatePresence>
        {!list.length && <span className="text-xs text-muted-foreground">No focus keywords yet. Add the searches each important page should rank for.</span>}
      </div>
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          addDraft();
        }}
      >
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="e.g. seo audit tool, technical seo services" aria-label="Add focus keywords" className="h-9" maxLength={200} disabled={list.length >= 10} />
        <div className="flex gap-2">
          <Button type="submit" variant="outline" size="sm" className="h-9" disabled={!draft.trim() || list.length >= 10}><Plus className="size-3.5" /> Add</Button>
          <Button type="button" size="sm" className="h-9" onClick={save} disabled={!dirty || saving}>{saving && <Loader2 className="size-3.5 animate-spin" />} Save and re-check</Button>
        </div>
      </form>
      <p className="text-[0.7rem] text-muted-foreground">Up to 10, comma-separated. Saved in the dashboard for this audit; checks re-run instantly on the saved crawl data.</p>
    </div>
  );
}

function FindingRow({ f, onInspect }: { f: ExtraFinding; onInspect: (u: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="border-b last:border-b-0">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-start gap-3 px-5 py-3 text-left transition-colors hover:bg-muted/40">
        <SeverityBadge severity={f.severity} className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            {f.title}
            {f.heuristic && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 align-middle text-[0.65rem] font-normal text-muted-foreground">heuristic</span>}
          </p>
          <p className="line-clamp-1 text-xs text-muted-foreground" title={f.evidence}>{f.evidence}</p>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground tabular">{f.count} URL{f.count === 1 ? "" : "s"}</span>
        <ChevronDown className={cn("mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180")} aria-hidden />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
            <div className="grid gap-4 px-5 pt-1 pb-4 text-sm lg:grid-cols-2">
              <div className="space-y-2">
                <p><span className="font-medium">How to fix:</span> {f.fix}</p>
                <p className="text-xs break-words text-muted-foreground">{f.evidence}</p>
                {f.source ? (
                  <a href={f.source} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-xs text-info hover:underline">Google Search Central guidance <ExternalLink className="size-3" /></a>
                ) : (
                  <p className="text-xs text-muted-foreground">Common SEO-plugin convention, not a documented Google rule.</p>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Affected pages: open one, or Inspect it to see everything on that page</p>
                <ul className="max-h-56 space-y-0.5 overflow-y-auto rounded-md border p-2 text-xs">
                  {f.urls.map((u) => <li key={u} className="rounded px-1 py-0.5 hover:bg-muted/60"><UrlLink url={u} page onInspect={onInspect} compact className="w-full" /></li>)}
                </ul>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

export default function ExtraChecksTab() {
  const { audit } = useAudit();
  const { data, error, reload } = useApi(() => api.extra(audit.id), [audit.id]);
  const [group, setGroup] = useState<ExtraGroup | "all">("all");
  const [inspect, setInspect] = useState<string | null>(null);
  const grouped = useMemo(() => {
    const m = new Map<ExtraGroup, ExtraFinding[]>();
    for (const f of data?.findings ?? []) m.set(f.group, [...(m.get(f.group) ?? []), f]);
    return m;
  }, [data]);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <LoadingSkeleton />;
  const sev = (s: string) => data.findings.filter((f) => f.severity === s).length;
  const visible = GROUP_ORDER.filter((g) => (group === "all" || g === group) && grouped.get(g)?.length);

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-xl border border-info/20 bg-info-soft/50 p-4 text-sm">
        <SearchCheck className="mt-0.5 size-5 shrink-0 text-info" aria-hidden />
        <p className="text-muted-foreground">
          Extra checks run in the dashboard on this audit&apos;s saved crawl data, covering areas the engine&apos;s 52 rules do not: focus keywords, E-E-A-T and trust signals, URL structure, schema coverage, internal linking, readability and more.
          They are reported separately and <strong className="text-foreground">do not change the engine&apos;s score</strong>. Checks marked <em>heuristic</em> are common SEO-plugin conventions rather than documented Google rules.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard index={0} label="Checks run" value={data.checksTotal - data.skipped.length} hint={`${data.checksTotal} available · ${data.skipped.length} need keywords`} icon={SearchCheck} />
        <MetricCard index={1} label="Issues found" value={data.findings.length} hint={`${sev("high")} high · ${sev("medium")} medium`} icon={X} tone={data.findings.length ? "warning" : "success"} />
        <MetricCard index={2} label="Passed" value={data.passed.length} hint="No issue detected" icon={Check} tone="success" />
        <MetricCard index={3} label="Focus keywords" value={data.keywords.length} hint={data.keywords.length ? "Checked below" : "Add some below"} icon={Type} tone="info" />
      </div>

      <SectionCard title="Focus keywords" description="Each keyword is matched to its best page, then checked like Rank Math: title, H1, URL, meta description, opening text and density.">
        <KeywordEditor auditId={audit.id} initial={data.keywords} onSaved={reload} />
        {data.keywordReport.length > 0 && (
          <div className="mt-5 overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Keyword</th>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Best matching page</th>
                  {Object.values(CHECK_LABELS).map((l) => <th key={l} scope="col" className="px-2 py-2 text-center text-xs font-medium text-muted-foreground">{l}</th>)}
                  <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Density</th>
                  <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Words</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.keywordReport.map((r) => (
                  <tr key={r.keyword}>
                    <td className="px-3 py-2.5 font-medium">{r.keyword}</td>
                    <td className="max-w-[16rem] px-3 py-2.5">
                      {r.targetUrl ? (
                        <>
                          <p className="truncate font-mono text-xs" title={r.targetUrl}>{shortUrl(r.targetUrl)}</p>
                          <p className="truncate text-xs text-muted-foreground">{r.targetTitle}</p>
                        </>
                      ) : <span className="text-xs font-medium text-critical">No page mentions this keyword</span>}
                    </td>
                    {(Object.keys(CHECK_LABELS) as Array<keyof typeof CHECK_LABELS>).map((k) => (
                      <td key={k} className="px-2 py-2.5 text-center">
                        {r.checks == null ? <Minus className="mx-auto size-4 text-muted-foreground" aria-label="not applicable" /> : r.checks[k] ? (
                          <span className="mx-auto grid size-6 place-items-center rounded-full bg-success-soft text-brand-strong" aria-label={`${CHECK_LABELS[k]}: yes`}><Check className="size-3.5" /></span>
                        ) : (
                          <span className="mx-auto grid size-6 place-items-center rounded-full bg-critical-soft text-critical" aria-label={`${CHECK_LABELS[k]}: no`}><X className="size-3.5" /></span>
                        )}
                      </td>
                    ))}
                    <td className={cn("px-3 py-2.5 text-right tabular", (r.densityPct ?? 0) > 3 && "font-medium text-high")}>{r.densityPct == null ? "—" : `${r.densityPct}%`}</td>
                    <td className="px-3 py-2.5 text-right tabular">{r.wordCount ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Issues"
        description="Grouped by area. Expand a row for the fix, evidence and affected URLs."
        bodyClassName="p-0"
        actions={null}
      >
        <div className="flex flex-wrap gap-1.5 border-b px-5 py-3">
          <FilterChip active={group === "all"} onClick={() => setGroup("all")} count={data.findings.length}>All</FilterChip>
          {GROUP_ORDER.filter((g) => grouped.get(g)?.length).map((g) => (
            <FilterChip key={g} active={group === g} onClick={() => setGroup(g)} count={grouped.get(g)?.length}>{GROUPS[g].label}</FilterChip>
          ))}
        </div>
        {visible.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">No issues in this group.</p>
        ) : (
          visible.map((g) => {
            const Icon = GROUPS[g].icon;
            return (
              <div key={g}>
                <div className="flex items-center gap-2 border-b bg-muted/30 px-5 py-2 text-xs">
                  <Icon className="size-3.5 text-muted-foreground" aria-hidden />
                  <span className="font-semibold">{GROUPS[g].label}</span>
                  <span className="text-muted-foreground">· {GROUPS[g].hint}</span>
                </div>
                <ul>{grouped.get(g)!.map((f) => <FindingRow key={f.id} f={f} onInspect={setInspect} />)}</ul>
              </div>
            );
          })
        )}
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title={`Passed (${data.passed.length})`} description="Extra checks with no issue detected">
          <ul className="flex flex-wrap gap-1.5">
            {data.passed.map((id) => <li key={id} className="rounded bg-success-soft px-1.5 py-0.5 font-mono text-[0.7rem] text-brand-strong">{id}</li>)}
          </ul>
          {data.skipped.length > 0 && <p className="mt-3 text-xs text-muted-foreground">{data.skipped.length} keyword checks skipped: no focus keywords set.</p>}
        </SectionCard>
        <SectionCard title="Readability" description="Flesch reading ease of each page's main text (English). 60+ is plain English; below 30 is very hard.">
          {data.readability.length ? (
            <ul className="space-y-1.5 text-sm">
              {data.readability.slice(0, 8).map((r) => (
                <li key={r.url} className="flex items-center gap-3">
                  <span className="min-w-0 flex-1 truncate font-mono text-xs" title={r.url}>{shortUrl(r.url)}</span>
                  <span className="h-1.5 w-24 overflow-hidden rounded-full bg-muted" aria-hidden>
                    <motion.span className={cn("block h-full rounded-full", r.score >= 60 ? "bg-brand" : r.score >= 30 ? "bg-warning" : "bg-critical")} initial={{ width: 0 }} animate={{ width: `${Math.max(4, Math.min(100, r.score))}%` }} transition={{ duration: 0.7 }} />
                  </span>
                  <span className="w-8 text-right tabular">{r.score}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted-foreground">Not enough English text to score.</p>}
        </SectionCard>
      </div>

      <SectionCard title="Not checkable from crawl data" description="Areas that matter for rankings but need data this audit does not collect">
        <ul className="grid gap-2 sm:grid-cols-2">
          {data.notCheckable.map((n) => (
            <li key={n.topic} className="rounded-lg border p-3 text-sm">
              <p className="font-medium">{n.topic}</p>
              <p className="text-xs text-muted-foreground">{n.why}</p>
            </li>
          ))}
        </ul>
      </SectionCard>
      <PageDetailsDrawer auditId={audit.id} url={inspect} onClose={() => setInspect(null)} />
    </div>
  );
}
