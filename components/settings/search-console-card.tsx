"use client";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, ExternalLink, FileUp, Loader2, PlugZap, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SectionCard } from "@/components/common/section-card";
import { CopyButton } from "@/components/audit/finding-breakdown-view";
import { useApi } from "@/hooks/use-api";
import { api, ApiError, type GscTest } from "@/lib/api";
import { cn } from "@/lib/utils";

const STEPS: Array<{ title: string; body: React.ReactNode }> = [
  {
    title: "Create a Google Cloud project",
    body: (
      <>
        Open{" "}
        <a className="text-info hover:underline" href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noreferrer noopener">
          Google Cloud Console
        </a>{" "}
        and create a project (any name, free).
      </>
    ),
  },
  {
    title: "Enable the Search Console API",
    body: (
      <>
        In that project, enable{" "}
        <a className="text-info hover:underline" href="https://console.cloud.google.com/apis/library/searchconsole.googleapis.com" target="_blank" rel="noreferrer noopener">
          Google Search Console API
        </a>
        .
      </>
    ),
  },
  {
    title: "Create a service account and a JSON key",
    body: (
      <>
        <a className="text-info hover:underline" href="https://console.cloud.google.com/iam-admin/serviceaccounts" target="_blank" rel="noreferrer noopener">
          IAM → Service accounts
        </a>{" "}
        → Create service account (no roles needed) → open it → Keys → Add key → JSON. A .json file downloads.
      </>
    ),
  },
  { title: "Paste or upload the key below", body: "AuditPilot stores it on this computer only (data/gsc, readable only by you) and never shows it again." },
  {
    title: "Give it access to each site",
    body: (
      <>
        In{" "}
        <a className="text-info hover:underline" href="https://search.google.com/search-console" target="_blank" rel="noreferrer noopener">
          Search Console
        </a>
        , for each of your sites: Settings → Users and permissions → Add user → the service account email shown below → permission <b>Restricted</b>. Then press <b>Test connection</b>.
      </>
    ),
  },
];

export function SearchConsoleCard() {
  const { data, reload } = useApi(() => api.gsc(), []);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [test, setTest] = useState<GscTest | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const conn = data?.connection;
  // Step 5 is done once every site has a readable property (from a test, or from the last sync).
  const allShared = Boolean((test?.ok && test.sites.length && test.sites.every((x) => x.property)) || (data?.sites.length && data.sites.every((x) => x.property && !x.error)));
  const done = (i: number) => Boolean(conn?.configured) && (i < 4 || allShared);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  };
  const save = () =>
    run("save", async () => {
      await api.gscSaveKey(text);
      setText("");
      toast.success("Key saved. Now add the service account email to each Search Console property, then test.");
      reload();
    });
  const doTest = () =>
    run("test", async () => {
      const r = await api.gscTest();
      setTest(r);
      if (r.ok) toast.success(`Connected: ${r.properties.length} propert${r.properties.length === 1 ? "y" : "ies"} readable${r.resyncing?.length ? `. Re-syncing ${r.resyncing.join(", ")} in the background.` : ""}`);
    });
  const syncAll = () =>
    run("sync", async () => {
      await api.gscSync();
      toast.success("Syncing all sites in the background. Data appears on the Search Console page in a minute or two.");
    });

  return (
    <SectionCard
      title="Google Search Console"
      description="Clicks, impressions, CTR, positions, queries, pages, index status and sitemaps for your sites, synced daily. Read-only: AuditPilot never changes anything in Search Console."
      actions={
        conn?.configured ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-xs font-medium text-success">
            <CheckCircle2 className="size-3.5" /> Key saved
          </span>
        ) : (
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">Not connected</span>
        )
      }
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <ol className="space-y-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-3 text-sm">
              <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold", done(i) ? "bg-success-soft text-success" : "bg-brand-soft text-brand-strong")}>
                {done(i) ? <CheckCircle2 className="size-3.5" /> : i + 1}
              </span>
              <div>
                <p className="font-medium">{s.title}</p>
                <p className="text-xs leading-relaxed text-muted-foreground">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="space-y-4">
          {conn?.configured && conn.clientEmail && (
            <div className="rounded-xl border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Add this email as a user on every Search Console property:</p>
              <div className="mt-1 flex items-center gap-1">
                <code className="min-w-0 truncate text-sm font-medium">{conn.clientEmail}</code>
                <CopyButton value={conn.clientEmail} label="Copy email" />
              </div>
              {conn.source === "server-file" && <p className="mt-1 text-[0.7rem] text-muted-foreground">Key loaded from AUDITPILOT_GSC_KEY_FILE on the server.</p>}
            </div>
          )}
          <div className="space-y-2">
            <label htmlFor="gsc-key" className="text-xs font-medium">{conn?.configured ? "Replace the key" : "Service account key (JSON)"}</label>
            <Textarea id="gsc-key" value={text} onChange={(e) => setText(e.target.value)} rows={5} placeholder='{"type": "service_account", "client_email": "…", "private_key": "…"}' className="font-mono text-xs" spellCheck={false} autoComplete="off" />
            <input
              ref={file}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) setText(await f.text());
                e.target.value = "";
              }}
            />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={save} disabled={!text.trim() || busy !== null}>
                {busy === "save" && <Loader2 className="size-3.5 animate-spin" />} Save key
              </Button>
              <Button size="sm" variant="outline" onClick={() => file.current?.click()} disabled={busy !== null}>
                <FileUp className="size-3.5" /> Upload .json
              </Button>
              {conn?.configured && (
                <>
                  <Button size="sm" variant="outline" onClick={doTest} disabled={busy !== null}>
                    {busy === "test" ? <Loader2 className="size-3.5 animate-spin" /> : <PlugZap className="size-3.5" />} Test connection
                  </Button>
                  <Button size="sm" variant="outline" onClick={syncAll} disabled={busy !== null}>
                    {busy === "sync" && <Loader2 className="size-3.5 animate-spin" />} Sync all sites now
                  </Button>
                  {conn.source === "dashboard" && (
                    <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => run("rm", async () => { await api.gscRemoveKey(); setTest(null); reload(); toast.success("Key removed"); })} disabled={busy !== null}>
                      <Trash2 className="size-3.5" /> Remove
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
          {test && (
            <div className="rounded-xl border p-3 text-sm">
              {!test.ok ? (
                <p className="flex items-start gap-2 text-critical"><XCircle className="mt-0.5 size-4 shrink-0" /> {test.error}</p>
              ) : (
                <>
                  <p className="mb-2 text-xs text-muted-foreground">Your sites and the property each one uses:</p>
                  <ul className="space-y-1.5">
                    {test.sites.map((s) => (
                      <li key={s.domain} className="flex items-center justify-between gap-3">
                        <span className="font-medium">{s.domain}</span>
                        {s.property ? (
                          <span className="inline-flex items-center gap-1 text-xs text-success"><CheckCircle2 className="size-3.5" /> {s.property}</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-critical"><XCircle className="size-3.5" /> No access yet: add the email above</span>
                        )}
                      </li>
                    ))}
                  </ul>
                  {test.properties.length > 0 && <p className="mt-2 text-[0.7rem] text-muted-foreground">Readable properties: {test.properties.map((p) => p.siteUrl).join(", ")}</p>}
                </>
              )}
            </div>
          )}
          <a href="https://developers.google.com/webmaster-tools/v1/how-tos/authorizing" target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-xs text-info hover:underline">
            Google&apos;s guide to Search Console API access <ExternalLink className="size-3" />
          </a>
        </div>
      </div>
    </SectionCard>
  );
}
