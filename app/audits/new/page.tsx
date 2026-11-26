"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, ChevronDown, Globe, Info, Loader2, Play, Star, XCircle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { GradeBadge } from "@/components/common/grade-badge";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/common/page-header";
import { SectionCard } from "@/components/common/section-card";
import { ConfirmationDialog } from "@/components/common/confirmation-dialog";
import { LoadingSkeleton } from "@/components/common/loading-skeleton";
import { OptionRow } from "@/components/audit/option-row";
import { SiteSizeCounter } from "@/components/audit/site-size-counter";
import { api, ApiError, type MonitorSite } from "@/lib/api";
import { checkUrlSyntax } from "@/lib/url";
import { SAMPLE_SITES } from "@/lib/brand";
import { auditOptionsSchema, DEFAULT_AUDIT_OPTIONS, type AuditOptions } from "@/lib/schemas";
import type { Diagnostics, SettingsData } from "@/lib/api-types";

const formSchema = auditOptionsSchema.extend({
  url: z.string().superRefine((v, ctx) => {
    const r = checkUrlSyntax(v);
    if (!r.ok) ctx.addIssue({ code: z.ZodIssueCode.custom, message: r.error ?? "Invalid URL" });
  }),
  /** Optional, comma-separated focus keywords for the extra checks (not sent to the engine) */
  keywordsText: z
    .string()
    .max(900)
    .refine((v) => splitKeywords(v).length <= 10, "Up to 10 keywords.")
    .refine((v) => splitKeywords(v).every((k) => k.length <= 80), "Each keyword must be 80 characters or fewer."),
});

function splitKeywords(v: string | undefined): string[] {
  return [...new Set((v ?? "").split(",").map((k) => k.trim()).filter(Boolean))];
}
type FormValues = z.infer<typeof formSchema>;

function NumberField({ id, label, hint, min, max, step = 1, value, onChange, error }: {
  id: string; label: string; hint?: string; min: number; max: number; step?: number; value: number; onChange: (n: number) => void; error?: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <Input id={id} type="number" inputMode="decimal" min={min} max={max} step={step} value={Number.isFinite(value) ? value : ""} onChange={(e) => onChange(e.target.valueAsNumber)} aria-invalid={Boolean(error)} aria-describedby={hint ? `${id}-hint` : undefined} className="h-8" />
      {hint && <p id={`${id}-hint`} className="text-[0.7rem] text-muted-foreground">{hint}</p>}
      {error && <p className="text-[0.7rem] text-critical">{error}</p>}
    </div>
  );
}

export default function NewAuditPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [diag, setDiag] = useState<Diagnostics | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  // The URL placeholder cycles through your own sites.
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setPlaceholderIdx((i) => (i + 1) % SAMPLE_SITES.length), 2800);
    return () => clearInterval(t);
  }, []);

  const [monitored, setMonitored] = useState<MonitorSite[] | null>(null);
  useEffect(() => {
    api.monitor().then((m) => setMonitored(m.sites)).catch(() => setMonitored(null));
  }, []);
  const mySites = (monitored ?? SAMPLE_SITES.map((url) => ({ url, domain: new URL(url).hostname.replace(/^www\./, ""), lastAudit: null, pagesCounted: null }))).map((s) => ({
    url: s.url,
    domain: s.domain,
    score: s.lastAudit?.score ?? null,
    grade: s.lastAudit?.grade ?? null,
    detail: [s.pagesCounted != null ? `${s.pagesCounted.toLocaleString()} pages in sitemap` : null, s.lastAudit?.finishedAt ? `last audit ${formatRelative(s.lastAudit.finishedAt)}` : null].filter(Boolean).join(" · ") || "Not audited yet",
  }));

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { url: "", keywordsText: "", ...DEFAULT_AUDIT_OPTIONS },
    mode: "onTouched",
  });
  const { register, handleSubmit, watch, setValue, formState, reset } = form;
  const v = watch();

  useEffect(() => {
    api.settings().then((s) => {
      setSettings(s);
      // Prefill from links such as "Re-run with a higher limit" (?url=…&maxPages=…).
      const q = new URLSearchParams(window.location.search);
      const qMax = Number(q.get("maxPages"));
      const preMax = Number.isInteger(qMax) && qMax >= 1 && qMax <= 2000 ? qMax : null;
      reset({
        url: q.get("url")?.slice(0, 2048) || form.getValues("url"),
        keywordsText: form.getValues("keywordsText"),
        ...s.defaults,
        ...(preMax ? { maxPages: preMax, timeBudget: Math.max(s.defaults.timeBudget, Math.min(5400, Math.max(600, Math.ceil((preMax * 2) / 60) * 60))) } : {}),
        full: false,
        // Without keys these stages only produce warnings, so start them off (users can still turn PageSpeed on).
        ...(s.secrets.find((x) => x.key === "TYPESAFE_API_KEY")?.configured ? {} : { ai: false }),
        ...(s.secrets.find((x) => x.key === "PAGESPEED_API_KEY")?.configured ? {} : { psi: false }),
      });
    }).catch(() => setSettings({ secrets: [], defaults: DEFAULT_AUDIT_OPTIONS }));
    api.diagnostics().then(setDiag).catch(() => setDiag(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const has = (k: string) => settings?.secrets.find((s) => s.key === k)?.configured ?? false;
  const dfsReady = has("DATAFORSEO_USERNAME") && has("DATAFORSEO_PASSWORD");
  const chromium = diag?.rendering.chromium ?? false;

  const notes = useMemo(() => {
    const n: Array<{ tone: "ok" | "warn" | "error" | "info"; text: string }> = [];
    if (v.ai) n.push({ tone: "ok", text: "AI judgments: TYPESAFE_API_KEY configured." });
    else if (!has("TYPESAFE_API_KEY")) n.push({ tone: "info", text: "AI judgments off (no key). The audit is complete otherwise; the score is marked partial." });
    if (v.psi) n.push(has("PAGESPEED_API_KEY") ? { tone: "ok", text: "PageSpeed: API key configured." } : { tone: "warn", text: "PageSpeed without a key: Google usually refuses unkeyed requests (HTTP 429)." });
    else if (!has("PAGESPEED_API_KEY")) n.push({ tone: "info", text: "PageSpeed off (no key). Add a free key in Settings for Core Web Vitals." });
    if (v.full) n.push(dfsReady ? { tone: "warn", text: `DataForSEO full mode is billed per call (hard cap $${v.dfsBudget}).` } : { tone: "error", text: "DataForSEO credentials missing: full mode cannot run." });
    if (v.render === "always" && !chromium) n.push({ tone: "warn", text: "Chromium is not available: pages will be analysed from raw HTML." });
    if (v.render === "auto") n.push({ tone: chromium ? "ok" : "info", text: chromium ? "JavaScript rendering available when a page needs it." : "JavaScript rendering unavailable (no Chromium); raw HTML is used. Standard crawling is unaffected." });
    return n;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.ai, v.psi, v.full, v.render, v.dfsBudget, settings, chromium, dfsReady]);

  const launch = async (values: FormValues, confirmPaid = false) => {
    setSubmitting(true);
    setServerError(null);
    const { url, keywordsText, ...options } = values;
    const keywords = splitKeywords(keywordsText);
    try {
      const res = await api.createAudit({ url, options: options as AuditOptions, confirmPaid, ...(keywords.length ? { keywords } : {}) });
      res.warnings.forEach((w) => toast.message(w));
      toast.success("Audit started");
      router.push(`/audits/${encodeURIComponent(res.id)}/progress`);
    } catch (e) {
      setServerError(e instanceof ApiError ? e.message : "Could not start the audit.");
      setSubmitting(false);
    }
  };

  const onSubmit = handleSubmit((values) => {
    if (values.full) {
      if (!dfsReady) {
        setServerError("Add DataForSEO credentials in Settings before using full mode.");
        return;
      }
      setConfirmOpen(true);
      return;
    }
    void launch(values);
  });

  if (!settings) return <LoadingSkeleton />;
  const err = formState.errors;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <PageHeader title="New Audit" description="Crawl a public website with the audit engine. Results, scores and reports are saved to your reports folder." />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <SectionCard title="Website">
            <div className="space-y-1.5">
              <Label htmlFor="url">Website URL</Label>
              <div className="flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <Globe className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input id="url" placeholder={SAMPLE_SITES[placeholderIdx]} autoComplete="url" autoFocus className="h-10 pl-9" aria-invalid={Boolean(err.url)} aria-describedby="url-help url-error" {...register("url")} />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" className="h-10 shrink-0 gap-1.5">
                      <Star className="size-4" /> <span className="hidden sm:inline">Your sites</span> <ChevronDown className="size-3.5 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-80">
                    <DropdownMenuLabel className="text-xs text-muted-foreground">Monitored sites · pick one to audit now</DropdownMenuLabel>
                    {mySites.map((s) => (
                      <DropdownMenuItem key={s.url} onSelect={() => setValue("url", s.url, { shouldValidate: true, shouldTouch: true })} className="flex items-center justify-between gap-3 py-2">
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{s.domain}</span>
                          <span className="block text-[0.7rem] text-muted-foreground">{s.detail}</span>
                        </span>
                        {s.score != null && <GradeBadge grade={s.grade} score={s.score} />}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/monitoring" className="text-xs">Manage monitoring and daily audits →</Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {mySites.map((s) => (
                  <button key={s.url} type="button" onClick={() => setValue("url", s.url, { shouldValidate: true, shouldTouch: true })} className={cn("rounded-full border px-2.5 py-0.5 text-xs transition-colors hover:border-brand hover:text-foreground", v.url === s.url ? "border-brand bg-brand-soft text-brand-strong" : "text-muted-foreground")}>
                    {s.domain}
                  </button>
                ))}
              </div>
              <p id="url-help" className="text-xs text-muted-foreground">The homepage of a public site. A bare domain works too. Local and private network addresses are refused.</p>
              {err.url && <p id="url-error" role="alert" className="text-xs text-critical">{err.url.message}</p>}
              <div className="pt-1">
                <SiteSizeCounter
                  url={v.url}
                  currentMax={v.maxPages}
                  auto
                  onApply={(pages, budget, automatic) => {
                    setValue("maxPages", pages, { shouldValidate: true });
                    if (budget > form.getValues("timeBudget")) setValue("timeBudget", budget, { shouldValidate: true });
                    if (!automatic) toast.success(`Crawl limit set to ${pages.toLocaleString()} pages`);
                  }}
                />
              </div>
            </div>
            <div className="mt-4 space-y-1.5">
              <Label htmlFor="keywordsText">Focus keywords <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Input id="keywordsText" placeholder="e.g. seo audit tool, technical seo services" className="h-10" aria-invalid={Boolean(err.keywordsText)} aria-describedby="kw-help" {...register("keywordsText")} />
              <p id="kw-help" className="text-xs text-muted-foreground">Comma-separated, up to 10. Used by the Extra Checks for Rank Math-style keyword placement checks. You can also add or change them after the audit.</p>
              {err.keywordsText && <p role="alert" className="text-xs text-critical">{err.keywordsText.message}</p>}
            </div>
          </SectionCard>

          <SectionCard title="Crawl" description="Maps to the engine's --max-pages, --max-depth and --time-budget.">
            <div className="grid gap-4 sm:grid-cols-3">
              <NumberField id="maxPages" label="Maximum pages" hint="Set automatically from the page count · up to 2,000" min={1} max={2000} value={v.maxPages} onChange={(n) => setValue("maxPages", n, { shouldValidate: true })} error={err.maxPages?.message} />
              <NumberField id="maxDepth" label="Maximum depth" hint="Engine default: 5" min={1} max={10} value={v.maxDepth} onChange={(n) => setValue("maxDepth", n, { shouldValidate: true })} error={err.maxDepth?.message} />
              <NumberField id="timeBudget" label="Crawl time budget (s)" hint="Engine default: 600 · up to 5,400" min={30} max={5400} value={v.timeBudget} onChange={(n) => setValue("timeBudget", n, { shouldValidate: true })} error={err.timeBudget?.message} />
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="render" className="text-xs">JavaScript rendering</Label>
                <Select value={v.render} onValueChange={(x) => setValue("render", x as FormValues["render"])}>
                  <SelectTrigger id="render" className="h-8 w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto: render only JavaScript-dependent pages</SelectItem>
                    <SelectItem value="always">Always render</SelectItem>
                    <SelectItem value="never">Never render (raw HTML)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[0.7rem] text-muted-foreground">
                  Playwright: {diag ? (diag.rendering.playwright ? "installed" : "not installed") : "checking…"} · Chromium: {diag ? (chromium ? "available" : "unavailable") : "checking…"}
                </p>
              </div>
              <fieldset className="space-y-1">
                <legend className="text-xs font-medium">Report formats</legend>
                <div className="flex flex-wrap gap-4 pt-1.5">
                  {(["pdf", "xlsx", "md"] as const).map((f) => (
                    <label key={f} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={v.formats.includes(f)}
                        onCheckedChange={(c) => setValue("formats", c ? [...v.formats, f] : v.formats.filter((x) => x !== f), { shouldValidate: true })}
                      />
                      {f.toUpperCase()}
                    </label>
                  ))}
                </div>
                {err.formats && <p className="text-[0.7rem] text-critical">Choose at least one format.</p>}
              </fieldset>
            </div>
          </SectionCard>

          <SectionCard title="Analysis" description="Optional data sources. Each one degrades gracefully when unavailable.">
            <div className="space-y-3">
              <OptionRow
                id="ai"
                title="AI content evaluation"
                checked={v.ai}
                onChange={(c) => setValue("ai", c)}
                disabled={!has("TYPESAFE_API_KEY")}
                badge={!has("TYPESAFE_API_KEY") && <span className="rounded bg-muted px-1.5 py-0.5 text-[0.68rem] font-medium text-muted-foreground">Needs key</span>}
                description={
                  <>
                    Asks the AI model typed questions about each page: intent, helpfulness, specificity, trust, title and meta fit. About one cent per site.{" "}
                    {!has("TYPESAFE_API_KEY") && <Link href="/settings" className="font-medium text-info hover:underline">Add TYPESAFE_API_KEY in Settings to turn this on.</Link>}
                  </>
                }
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <NumberField id="aiPages" label="Pages sent to AI" min={1} max={200} value={v.aiPages} onChange={(n) => setValue("aiPages", n, { shouldValidate: true })} error={err.aiPages?.message} />
                  <NumberField id="aiBudget" label="Hard spend cap (USD)" step={0.05} min={0.01} max={5} value={v.aiBudget} onChange={(n) => setValue("aiBudget", n, { shouldValidate: true })} error={err.aiBudget?.message} />
                </div>
              </OptionRow>
              <OptionRow
                id="psi"
                title="PageSpeed Insights"
                checked={v.psi}
                onChange={(c) => setValue("psi", c)}
                badge={!has("PAGESPEED_API_KEY") && <span className="rounded bg-muted px-1.5 py-0.5 text-[0.68rem] font-medium text-muted-foreground">No key</span>}
                description={
                  <>
                    Core Web Vitals field data and a Lighthouse lab run, mobile and desktop.{" "}
                    {!has("PAGESPEED_API_KEY") && (
                      <>Off by default without a key: Google&apos;s shared free quota usually refuses requests (HTTP 429). <Link href="/settings" className="font-medium text-info hover:underline">Add a free PAGESPEED_API_KEY</Link> for reliable results.</>
                    )}
                  </>
                }
              >
                <NumberField id="psiPages" label="Pages measured" hint="Each page = 2 requests (mobile + desktop)" min={1} max={10} value={v.psiPages} onChange={(n) => setValue("psiPages", n, { shouldValidate: true })} error={err.psiPages?.message} />
              </OptionRow>
              <OptionRow
                id="full"
                title="Advanced analysis (DataForSEO)"
                checked={v.full}
                onChange={(c) => setValue("full", c)}
                badge={<span className="rounded bg-critical-soft px-1.5 py-0.5 text-[0.68rem] font-medium text-critical">Paid per call</span>}
                description={<>Rankings, keywords, competitors, backlinks, live SERPs and AI answer mentions. Requires DataForSEO credentials; typically about $0.30 per site. {dfsReady ? "" : "Credentials are not configured."}</>}
              >
                <div className="grid gap-4 sm:grid-cols-3">
                  <NumberField id="dfsBudget" label="Hard spend cap (USD)" step={0.1} min={0.05} max={10} value={v.dfsBudget} onChange={(n) => setValue("dfsBudget", n, { shouldValidate: true })} error={err.dfsBudget?.message} />
                  <NumberField id="locationCode" label="Location code" hint="2840 = United States" min={1} max={99999999} value={v.locationCode} onChange={(n) => setValue("locationCode", n, { shouldValidate: true })} error={err.locationCode?.message} />
                  <div className="space-y-1">
                    <Label htmlFor="language" className="text-xs">Language</Label>
                    <Input id="language" className="h-8" {...register("language")} aria-invalid={Boolean(err.language)} />
                    {err.language && <p className="text-[0.7rem] text-critical">Use a language code such as en.</p>}
                  </div>
                </div>
              </OptionRow>
            </div>
          </SectionCard>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <SectionCard title="Audit summary">
            <dl className="space-y-2 text-sm">
              {[
                ["Website", v.url ? (checkUrlSyntax(v.url).url ?? v.url) : "—"],
                ["Focus keywords", splitKeywords(v.keywordsText).length ? `${splitKeywords(v.keywordsText).length} set` : "none"],
                ["Pages / depth", `${v.maxPages} pages, depth ${v.maxDepth}`],
                ["Rendering", v.render],
                ["AI judgments", v.ai ? `on, ${v.aiPages} pages, cap $${v.aiBudget}` : "off"],
                ["PageSpeed", v.psi ? `on, ${v.psiPages} page(s)` : "off"],
                ["DataForSEO", v.full ? `on, cap $${v.dfsBudget}` : "off"],
                ["Reports", v.formats.map((f) => f.toUpperCase()).join(", ")],
              ].map(([k, val]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="truncate text-right font-medium" title={val}>{val}</dd>
                </div>
              ))}
            </dl>
            <ul className="mt-4 space-y-2 border-t pt-3 text-xs">
              {notes.map((n) => (
                <li key={n.text} className="flex gap-2">
                  {n.tone === "ok" ? <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-brand" aria-hidden /> : n.tone === "warn" ? <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden /> : n.tone === "info" ? <Info className="mt-0.5 size-3.5 shrink-0 text-info" aria-hidden /> : <XCircle className="mt-0.5 size-3.5 shrink-0 text-critical" aria-hidden />}
                  <span className="text-muted-foreground">{n.text}</span>
                </li>
              ))}
            </ul>
            {serverError && <p role="alert" className="mt-3 rounded-md bg-critical-soft p-2.5 text-xs text-critical">{serverError}</p>}
            <Button type="submit" className="mt-4 w-full" disabled={submitting}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
              {submitting ? "Starting…" : "Start audit"}
            </Button>
            <p className="mt-2 text-center text-[0.7rem] text-muted-foreground">Typical run: 1 to 4 minutes.</p>
          </SectionCard>
        </aside>
      </div>

      <ConfirmationDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Run paid DataForSEO analysis?"
        description={
          <>
            <p>Full mode calls DataForSEO endpoints that are billed to your DataForSEO account per request.</p>
            <p>The engine stops spending at your cap of <strong className="text-foreground">${v.dfsBudget}</strong>.</p>
          </>
        }
        confirmLabel="Yes, run full audit"
        onConfirm={() => void launch(form.getValues(), true)}
      />
    </form>
  );
}
