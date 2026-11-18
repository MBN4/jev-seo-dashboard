"use client";
import { ExternalLink } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SeverityBadge } from "@/components/common/severity-badge";
import { LoadingSkeleton } from "@/components/common/loading-skeleton";
import { ErrorState } from "@/components/common/error-state";
import { AnswerValue, BandBadge, describeAnswer } from "./jev-answer";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { formatBytes, shortUrl } from "@/lib/format";
import { cn } from "@/lib/utils";

function Row({ k, v, warn }: { k: string; v: React.ReactNode; warn?: boolean }) {
  return (
    <div className="grid grid-cols-[8.5rem_1fr] gap-2 py-1.5 text-sm">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className={cn("min-w-0 break-words", warn && "text-high")}>{v ?? <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}

const DIM_LABEL: Record<string, string> = {
  page_type: "Page type", intent: "Search intent", importance: "Importance", action: "Suggested handling", helpfulness: "Helpfulness",
  specificity: "Specificity", answer_first: "Answers first", citable: "Citability", trust: "Trustworthiness", clear_next_step: "Clear next step",
  title_fit: "Title relevance", h1_fit: "H1 relevance", meta_fit: "Meta description relevance",
};

export function PageDetailsDrawer({ auditId, url, onClose }: { auditId: string; url: string | null; onClose: () => void }) {
  const { data: p, error } = useApi(url ? () => api.pageDetail(auditId, url) : null, [auditId, url]);
  const ready = p && p.url === url;
  return (
    <Sheet open={Boolean(url)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-2xl">
        <SheetHeader className="border-b p-5">
          <SheetTitle className="pr-6 font-mono text-sm break-all">{url ? shortUrl(url) : ""}</SheetTitle>
          <SheetDescription asChild>
            <a href={url ?? "#"} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-xs break-all hover:underline">
              {url} <ExternalLink className="size-3 shrink-0" />
            </a>
          </SheetDescription>
        </SheetHeader>
        <div className="p-5">
          {error && <ErrorState error={error} />}
          {!ready && !error && <LoadingSkeleton variant="panel" />}
          {ready && (
            <Tabs defaultValue="meta">
              <TabsList className="mb-4 flex h-auto flex-wrap">
                <TabsTrigger value="meta">Metadata</TabsTrigger>
                <TabsTrigger value="headings">Headings</TabsTrigger>
                <TabsTrigger value="content">Content</TabsTrigger>
                <TabsTrigger value="links">Links</TabsTrigger>
                <TabsTrigger value="schema">Structured data</TabsTrigger>
                <TabsTrigger value="findings">Findings ({p.findings.length})</TabsTrigger>
                <TabsTrigger value="ai">AI</TabsTrigger>
              </TabsList>
              <TabsContent value="meta">
                <dl className="divide-y">
                  <Row k="HTTP status" v={p.status ?? p.error} warn={p.status !== 200} />
                  <Row k="Indexable" v={p.indexable == null ? null : p.indexable ? "Yes" : `No (${p.indexabilityNote})`} warn={p.indexable === false} />
                  <Row k="Title" v={p.meta.title && <>{p.meta.title} <span className="text-xs text-muted-foreground">({p.meta.titleLength} chars)</span></>} warn={!p.meta.title} />
                  <Row k="Meta description" v={p.meta.description && <>{p.meta.description} <span className="text-xs text-muted-foreground">({p.meta.descriptionLength} chars)</span></>} warn={!p.meta.description} />
                  <Row k="Canonical" v={p.meta.canonical && <span className="font-mono text-xs">{p.meta.canonical}</span>} />
                  <Row k="Meta robots" v={p.meta.robots} />
                  <Row k="X-Robots-Tag" v={p.meta.xRobots} />
                  <Row k="Language" v={p.meta.lang} />
                  <Row k="Viewport" v={p.meta.viewport} />
                  <Row k="Open Graph" v={Object.entries(p.meta.og).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(" · ") || null} />
                  <Row k="Twitter card" v={p.meta.twitterCard} />
                  <Row k="Depth / inlinks" v={`${p.depth ?? "—"} / ${p.inlinks ?? "—"}`} />
                  <Row k="In sitemap" v={p.inSitemap == null ? null : p.inSitemap ? "Yes" : "No"} />
                  <Row k="TTFB" v={p.ttfbMs != null ? `${p.ttfbMs} ms` : null} />
                  <Row k="Size" v={formatBytes(p.bytes)} />
                  <Row k="Rendered with JS" v={p.rendered ? "Yes" : p.jsDependent ? "JS-dependent, not rendered" : "No"} />
                </dl>
              </TabsContent>
              <TabsContent value="headings">
                <p className="mb-2 text-sm">H1: {p.headings.h1.length ? p.headings.h1.join(" | ") : <span className="text-high">missing</span>} · heading level skips: {p.headings.skips}</p>
                {p.headings.outline.length ? (
                  <ol className="space-y-1 rounded-md border p-3 text-sm">
                    {p.headings.outline.map((h, i) => {
                      const m = h.match(/^h(\d): (.*)$/);
                      const lvl = m ? Number(m[1]) : 1;
                      return (
                        <li key={i} style={{ paddingLeft: `${(lvl - 1) * 14}px` }} className="flex gap-2">
                          <span className="font-mono text-[0.7rem] text-muted-foreground">H{lvl}</span>
                          <span className="min-w-0 break-words">{m ? m[2] : h}</span>
                        </li>
                      );
                    })}
                  </ol>
                ) : <p className="text-sm text-muted-foreground">No headings found.</p>}
              </TabsContent>
              <TabsContent value="content" className="space-y-3 text-sm">
                <dl className="divide-y">
                  <Row k="Main-content words" v={p.content.wordCount} />
                  <Row k="All words" v={p.content.rawWordCount} />
                  <Row k="Images" v={p.content.images && `${p.content.images.total} total, ${p.content.images.missing_alt} missing alt, ${p.content.images.no_dimensions ?? 0} without dimensions`} />
                  <Row k="Calls to action" v={p.content.callsToAction.slice(0, 10).join(" · ") || null} />
                </dl>
                {p.content.excerpt && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Text excerpt (as extracted by the engine)</p>
                    <p className="max-h-48 overflow-y-auto rounded-md bg-muted/60 p-3 text-xs leading-relaxed">{p.content.excerpt}</p>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="links" className="space-y-3 text-sm">
                <p>{p.links.internalTotal} internal · {p.links.externalTotal} external · {p.links.nofollow} nofollow</p>
                <div className="max-h-80 overflow-y-auto rounded-md border">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted"><tr><th className="px-2 py-1.5 text-left">Internal link</th><th className="px-2 py-1.5 text-left">Anchor</th><th className="px-2 py-1.5 text-right">Status</th></tr></thead>
                    <tbody className="divide-y">
                      {p.links.internal.map((l, i) => (
                        <tr key={i}>
                          <td className="max-w-[16rem] truncate px-2 py-1 font-mono" title={l.url}>{shortUrl(l.url)}</td>
                          <td className="max-w-[12rem] truncate px-2 py-1">{l.anchor || <em className="text-muted-foreground">empty</em>}</td>
                          <td className={cn("px-2 py-1 text-right font-mono", (p.links.linkStatus[l.url] ?? 200) >= 400 && "text-critical")}>{p.links.linkStatus[l.url] ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {p.links.external.length > 0 && (
                  <details className="rounded-md border p-2 text-xs">
                    <summary className="cursor-pointer font-medium">External links ({p.links.externalTotal})</summary>
                    <ul className="mt-2 space-y-0.5 font-mono">{p.links.external.map((l, i) => <li key={i} className="truncate" title={l.url}>{l.url}</li>)}</ul>
                  </details>
                )}
              </TabsContent>
              <TabsContent value="schema" className="space-y-2 text-sm">
                {p.structured.types.length ? (
                  <ul className="flex flex-wrap gap-1.5">{p.structured.types.map((t) => <li key={t} className="rounded bg-info-soft px-1.5 py-0.5 font-mono text-xs text-info">{t}</li>)}</ul>
                ) : <p className="text-muted-foreground">No structured data detected.</p>}
                {p.structured.errors.length > 0 && <div className="rounded-md bg-critical-soft p-2 text-xs text-critical">{p.structured.errors.join("; ")}</div>}
                {p.mixedContent.length > 0 && <div className="rounded-md bg-warning-soft p-2 text-xs">Mixed content: {p.mixedContent.join(", ")}</div>}
              </TabsContent>
              <TabsContent value="findings">
                {p.findings.length ? (
                  <ul className="space-y-2">
                    {p.findings.map((f) => (
                      <li key={f.id} className="rounded-md border p-3 text-sm">
                        <div className="flex items-start justify-between gap-2"><p className="font-medium">{f.title}</p><SeverityBadge severity={f.severity} /></div>
                        <p className="mt-1 text-xs text-muted-foreground">{f.evidence}</p>
                        <p className="mt-1 text-xs"><span className="font-medium">Fix:</span> {f.fix}</p>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-muted-foreground">No findings reference this page.</p>}
              </TabsContent>
              <TabsContent value="ai">
                {p.jev ? (
                  <table className="w-full text-sm">
                    <tbody className="divide-y">
                      {Object.entries(p.jev).map(([k, a]) => (
                        <tr key={k}>
                          <td className="py-2 pr-3 text-muted-foreground">{DIM_LABEL[k] ?? k}</td>
                          <td className="py-2 pr-3"><AnswerValue a={a} /><p className="text-[0.7rem] text-muted-foreground">{describeAnswer(a).value}</p></td>
                          <td className="py-2 text-right"><BandBadge band={a.band} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : <p className="text-sm text-muted-foreground">Jev did not judge this page (no TYPESAFE_API_KEY, page not sent, or the budget cap was reached).</p>}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
