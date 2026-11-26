"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/common/page-header";
import { DEFAULT_MAX_PAGES, MAX_TIME_BUDGET } from "@/lib/limits";
import { SectionCard } from "@/components/common/section-card";
import { SearchConsoleCard } from "@/components/settings/search-console-card";
import { ErrorState } from "@/components/common/error-state";
import { LoadingSkeleton } from "@/components/common/loading-skeleton";
import { ApiKeyInput } from "@/components/settings/api-key-input";
import { SystemStatusCard } from "@/components/settings/system-status-card";
import { useApi } from "@/hooks/use-api";
import { api, ApiError } from "@/lib/api";
import { auditOptionsSchema, DEFAULT_AUDIT_OPTIONS, type AuditOptions } from "@/lib/schemas";
import { formatDate } from "@/lib/format";

function KeysTab() {
  const { data, error, reload, setData } = useApi(() => api.settings(), []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <LoadingSkeleton variant="panel" />;
  const save = async (key: string, value: string | null) => {
    try {
      const res = await api.saveSettings({ secrets: { [key]: value } });
      setData(res);
      setErrors((e) => ({ ...e, [key]: "" }));
      toast.success(value ? `${key} saved` : `${key} removed from the dashboard store`);
    } catch (e) {
      if (e instanceof ApiError && e.details && typeof e.details === "object") setErrors(e.details as Record<string, string>);
      else toast.error(e instanceof Error ? e.message : "Could not save");
    }
  };
  return (
    <div className="space-y-4">
      <div className="flex gap-3 rounded-lg border bg-info-soft/50 p-4 text-sm">
        <ShieldCheck className="size-5 shrink-0 text-info" aria-hidden />
        <p className="text-muted-foreground">
          Keys are stored on this machine in <code>data/secrets.env</code> (file mode 600, ignored by Git) and passed only to the engine process. They are never sent back to the browser. Your existing engine <code>.env</code> is read for status only and never modified.
        </p>
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        {data.secrets.map((s) => (
          <ApiKeyInput key={s.key} status={s} error={errors[s.key] || undefined} onSave={(v) => save(s.key, v)} onRemove={() => save(s.key, null)} />
        ))}
      </div>
    </div>
  );
}

function DefaultsTab() {
  const { data, error, reload } = useApi(() => api.settings(), []);
  const [v, setV] = useState<AuditOptions>(DEFAULT_AUDIT_OPTIONS);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (data) setV(data.defaults); }, [data]);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <LoadingSkeleton variant="panel" />;
  const parsed = auditOptionsSchema.safeParse(v);
  const num = (k: keyof AuditOptions, label: string, min: number, max: number, step = 1) => (
    <div className="space-y-1">
      <Label htmlFor={`d-${k}`} className="text-xs">{label}</Label>
      <Input id={`d-${k}`} type="number" min={min} max={max} step={step} value={v[k] as number} onChange={(e) => setV({ ...v, [k]: e.target.valueAsNumber })} className="h-8" />
    </div>
  );
  const sw = (k: "ai" | "psi" | "full", label: string, desc: string) => (
    <div className="flex items-start justify-between gap-4 rounded-md border p-3">
      <div><Label htmlFor={`d-${k}`} className="text-sm">{label}</Label><p className="text-xs text-muted-foreground">{desc}</p></div>
      <Switch id={`d-${k}`} checked={v[k]} onCheckedChange={(c) => setV({ ...v, [k]: c })} />
    </div>
  );
  const save = async () => {
    setSaving(true);
    try {
      await api.saveSettings({ defaults: v });
      toast.success("Audit defaults saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };
  return (
    <SectionCard title="Audit defaults" description="Pre-filled on the New Audit form. Each maps to an audit engine option.">
      <div className="grid gap-4 sm:grid-cols-3">
        {num("maxPages", "Crawl limit (pages)", 1, DEFAULT_MAX_PAGES)}
        {num("maxDepth", "Max depth", 1, 10)}
        {num("timeBudget", "Crawl time budget (s)", 30, MAX_TIME_BUDGET)}
        {num("aiPages", "Pages sent to AI", 1, 200)}
        {num("aiBudget", "AI spend cap (USD)", 0.01, 5, 0.05)}
        {num("psiPages", "PageSpeed pages", 1, 10)}
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {sw("ai", "AI content evaluation", "Needs TYPESAFE_API_KEY")}
        {sw("psi", "PageSpeed analysis", "Unkeyed runs may hit HTTP 429")}
        {sw("full", "Advanced analysis (DataForSEO)", "Paid; still asks for confirmation on every audit")}
        <div className="flex items-center justify-between gap-4 rounded-md border p-3">
          <div><Label htmlFor="d-render" className="text-sm">JavaScript rendering</Label><p className="text-xs text-muted-foreground">Needs Playwright + Chromium for rendering</p></div>
          <Select value={v.render} onValueChange={(r) => setV({ ...v, render: r as AuditOptions["render"] })}>
            <SelectTrigger id="d-render" className="h-8 w-32"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="auto">Auto</SelectItem><SelectItem value="always">Always</SelectItem><SelectItem value="never">Never</SelectItem></SelectContent>
          </Select>
        </div>
      </div>
      {!parsed.success && <p role="alert" className="mt-3 text-xs text-critical">Some values are out of range: {parsed.error.issues.map((i) => i.path.join(".")).join(", ")}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={() => setV(DEFAULT_AUDIT_OPTIONS)}>Reset to engine defaults</Button>
        <Button onClick={save} disabled={saving || !parsed.success}>{saving && <Loader2 className="size-4 animate-spin" />} Save defaults</Button>
      </div>
    </SectionCard>
  );
}

function DiagnosticsTab() {
  const [refresh, setRefresh] = useState(0);
  const { data, error, loading, reload } = useApi(() => api.diagnostics(refresh > 0), [refresh]);
  const [health, setHealth] = useState<string>("checking");
  useEffect(() => { api.health().then((h) => setHealth(h.status)).catch(() => setHealth("unreachable")); }, [refresh]);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <LoadingSkeleton variant="panel" />;
  const counts = { ok: 0, warning: 0, error: 0 };
  data.checks.forEach((c) => counts[c.state]++);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Backend health", health === "ok" ? "Healthy" : health],
          ["Frontend ↔ backend", health === "unreachable" ? "Disconnected" : "Connected"],
          ["Audit engine", data.versions.engine ? `v${data.versions.engine}` : "Not found"],
          ["Python", data.versions.python ?? "Unavailable"],
          ["Node.js", data.versions.node],
        ].map(([k, val]) => (
          <div key={k} className="surface p-3"><p className="text-xs text-muted-foreground">{k}</p><p className="mt-0.5 text-sm font-semibold">{val}</p></div>
        ))}
      </div>
      <SectionCard
        title="System checks"
        description={`${counts.ok} ok · ${counts.warning} warnings · ${counts.error} errors · checked ${formatDate(data.checkedAt)}`}
        actions={<Button variant="outline" size="sm" onClick={() => setRefresh((r) => r + 1)} disabled={loading}><RefreshCw className={loading ? "size-3.5 animate-spin" : "size-3.5"} /> Re-run</Button>}
      >
        <ul className="grid gap-2 lg:grid-cols-2">{data.checks.map((c) => <SystemStatusCard key={c.key} check={c} />)}</ul>
        <p className="mt-3 text-xs text-muted-foreground">Max concurrent audits: {data.limits.maxConcurrentAudits}. The engine and reports folders are set with <code>AUDITPILOT_ENGINE_DIR</code> and <code>AUDITPILOT_REPORTS_DIR</code> in <code>.env.local</code>.</p>
      </SectionCard>
    </div>
  );
}

export default function SettingsPage() {
  const [tab, setTab] = useState("keys");
  useEffect(() => {
    const h = window.location.hash.slice(1);
    if (["keys", "gsc", "defaults", "diagnostics"].includes(h)) setTab(h);
  }, []);
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="API credentials, audit defaults and system diagnostics." />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="keys">API keys</TabsTrigger>
          <TabsTrigger value="gsc">Search Console</TabsTrigger>
          <TabsTrigger value="defaults">Audit defaults</TabsTrigger>
          <TabsTrigger value="diagnostics">Diagnostics</TabsTrigger>
        </TabsList>
        <TabsContent value="keys" className="mt-4"><KeysTab /></TabsContent>
        <TabsContent value="gsc" className="mt-4"><SearchConsoleCard /></TabsContent>
        <TabsContent value="defaults" className="mt-4"><DefaultsTab /></TabsContent>
        <TabsContent value="diagnostics" className="mt-4"><DiagnosticsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
