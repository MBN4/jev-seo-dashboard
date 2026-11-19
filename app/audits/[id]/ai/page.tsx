"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Bot, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionCard } from "@/components/common/section-card";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { LoadingSkeleton } from "@/components/common/loading-skeleton";
import { SeverityBadge } from "@/components/common/severity-badge";
import { AnswerValue, BandBadge, describeAnswer } from "@/components/audit/jev-answer";
import { PageDetailsDrawer } from "@/components/audit/page-details-drawer";
import { useAudit } from "@/components/audit/audit-context";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { shortUrl } from "@/lib/format";

/** Shown in the overview grid; other dimensions are available in each page's detail. */
const PREFERRED = ["intent", "helpfulness", "specificity", "trust", "citable", "title_fit", "meta_fit", "h1_fit", "answer_first", "clear_next_step"];

export default function AiTab() {
  const { audit } = useAudit();
  const { data, error, reload } = useApi(() => api.ai(audit.id), [audit.id]);
  const [dim, setDim] = useState<string>("all");
  const [open, setOpen] = useState<string | null>(null);
  const cols = useMemo(() => (data ? PREFERRED.filter((k) => data.dimensions.some((d) => d.key === k)).slice(0, 7) : []), [data]);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <LoadingSkeleton />;

  if (!data.available) {
    return (
      <SectionCard>
        <EmptyState
          icon={KeyRound}
          title="AI content analysis was not available for this audit"
          description={
            <>
              {data.skipped ? `Reason: ${data.skipped}. ` : "The engine ran without TYPESAFE_API_KEY, so AI judgments were skipped and content quality was not scored. "}
              Add the key in Settings and run a new audit to get intent, helpfulness, specificity, trust and title/meta relevance per page. No judgments are shown here because none were produced.
            </>
          }
          action={<Button asChild variant="outline"><Link href="/settings">Open settings</Link></Button>}
        />
      </SectionCard>
    );
  }

  const dimMeta = data.dimensions.find((d) => d.key === dim);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="Content quality score" description={data.contentNote ?? undefined}>
          <p className="text-3xl font-semibold tabular">{data.contentScore ?? "—"}</p>
          <p className="mt-1 text-xs text-muted-foreground">{data.pages.filter((p) => p.judged).length} pages judged · {data.notJudged.length} not judged · cost ${Number((data.ledger as Record<string, unknown>).cost_usd ?? 0).toFixed(4)}</p>
        </SectionCard>
        <SectionCard className="lg:col-span-2" title="Site-level judgments" description="AI answers about the whole site, from the homepage and page titles">
          {data.site.length ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {data.site.map((s) => {
                const d = describeAnswer(s.answer, s.question);
                return (
                  <li key={s.key} className="rounded-md border p-3">
                    <div className="flex items-center justify-between gap-2"><p className="text-sm font-medium">{s.label}</p><BandBadge band={s.answer.band} /></div>
                    <div className="mt-1"><AnswerValue a={s.answer} /></div>
                    {d.criterion && <p className="mt-1 text-xs text-muted-foreground">{d.criterion}</p>}
                  </li>
                );
              })}
            </ul>
          ) : <p className="text-sm text-muted-foreground">No site-level answers.</p>}
        </SectionCard>
      </div>

      <SectionCard
        title="Page judgments"
        description="Typed answers from the AI model with the engine's confidence band. The model returns probabilities, not prose, so the explanation shown is the criterion its answer matched."
        actions={
          <Select value={dim} onValueChange={setDim}>
            <SelectTrigger className="h-8 w-52" aria-label="Dimension"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Overview grid</SelectItem>
              {data.dimensions.map((d) => <SelectItem key={d.key} value={d.key}>{d.label}</SelectItem>)}
            </SelectContent>
          </Select>
        }
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          {dim === "all" ? (
            <table className="w-full min-w-[900px] text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Page</th>
                  {cols.map((c) => <th key={c} className="px-3 py-2.5 text-left text-xs font-medium whitespace-nowrap text-muted-foreground">{data.dimensions.find((d) => d.key === c)?.label}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.pages.map((p) => (
                  <tr key={p.url} className="cursor-pointer hover:bg-muted/40" onClick={() => setOpen(p.url)}>
                    <td className="max-w-[16rem] px-3 py-2"><p className="truncate font-mono text-xs" title={p.url}>{shortUrl(p.url)}</p><p className="truncate text-xs text-muted-foreground">{p.title}</p></td>
                    {cols.map((c) => (
                      <td key={c} className="px-3 py-2">{p.answers[c] ? <AnswerValue a={p.answers[c]} /> : <span className="text-xs text-muted-foreground">{p.judged ? "—" : "Not judged"}</span>}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  {["Page", "Result", "Confidence", "Explanation (matched criterion)", "Related finding / suggested improvement"].map((h) => <th key={h} className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.pages.filter((p) => p.answers[dim]).map((p) => {
                  const a = p.answers[dim];
                  const d = describeAnswer(a, dimMeta?.question);
                  const related = p.findings[0];
                  return (
                    <tr key={p.url} className="align-top">
                      <td className="max-w-[14rem] px-3 py-2"><button type="button" onClick={() => setOpen(p.url)} className="truncate font-mono text-xs hover:underline" title={p.url}>{shortUrl(p.url)}</button></td>
                      <td className="px-3 py-2"><AnswerValue a={a} /></td>
                      <td className="px-3 py-2"><BandBadge band={a.band} />{a.confidence != null && <p className="mt-0.5 text-[0.7rem] text-muted-foreground tabular">{a.confidence.toFixed(2)}</p>}</td>
                      <td className="max-w-xs px-3 py-2 text-xs text-muted-foreground">{d.criterion ?? d.value}</td>
                      <td className="max-w-xs px-3 py-2 text-xs">{related ? <><SeverityBadge severity={related.severity} /> <span className="ml-1">{related.fix}</span></> : <span className="text-muted-foreground">None</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        {dimMeta?.question && <p className="border-t px-4 py-3 text-xs text-muted-foreground"><span className="font-medium text-foreground">Question asked:</span> {dimMeta.question.instructions.replace(/`/g, "")}</p>}
      </SectionCard>

      {data.findings.length > 0 && (
        <SectionCard title="AI findings" bodyClassName="p-0">
          <ul className="divide-y">
            {data.findings.map((f) => (
              <li key={f.id} className="flex items-start gap-3 px-4 py-3 text-sm">
                <SeverityBadge severity={f.severity} />
                <div className="min-w-0"><p className="font-medium">{f.title}</p><p className="text-xs text-muted-foreground">{f.evidence}</p><p className="mt-0.5 text-xs">{f.fix}</p></div>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">{f.count} URL(s)</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
      {data.notJudged.length > 0 && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground"><Bot className="size-3.5" /> {data.notJudged.length} page(s) were not judged (request failed or budget cap). Their absence of AI findings is not a pass.</p>
      )}
      <PageDetailsDrawer auditId={audit.id} url={open} onClose={() => setOpen(null)} />
    </div>
  );
}
