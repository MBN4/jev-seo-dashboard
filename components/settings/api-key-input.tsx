"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, Eye, EyeOff, Loader2, ShieldCheck, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import type { SecretStatus } from "@/lib/api-types";

const SOURCE: Record<string, string> = {
  dashboard: "Saved in dashboard (data/secrets.env)",
  environment: "From an environment variable",
  "engine-env-file": "From the engine's .env file",
  "user-keys-file": "From ~/Desktop/Keys/.env",
};

/**
 * Write-only secret input: the current value is never sent to the browser, only whether it
 * is configured, where it comes from and a masked hint. PageSpeed and DataForSEO keys can be
 * verified with one live request.
 */
export function ApiKeyInput({ status, onSave, onRemove, error }: {
  status: SecretStatus;
  onSave: (value: string) => Promise<void>;
  onRemove: () => Promise<void>;
  error?: string;
}) {
  const [value, setValue] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verdict, setVerdict] = useState<{ ok: boolean; message: string } | null>(null);
  const id = `secret-${status.key}`;
  const service = status.key === "PAGESPEED_API_KEY" ? "pagespeed" : status.key.startsWith("DATAFORSEO") ? "dataforseo" : null;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setVerdict(null);
    try {
      await fn();
      setValue("");
    } finally {
      setBusy(false);
    }
  };
  const verify = async () => {
    if (!service) return;
    setVerifying(true);
    setVerdict(null);
    try {
      setVerdict(await api.verifyKey(service));
    } catch (e) {
      setVerdict({ ok: false, message: e instanceof Error ? e.message : "Verification failed" });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="surface surface-hover space-y-2.5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Label htmlFor={id} className="font-mono text-sm">{status.key}</Label>
          <p className="mt-0.5 text-xs text-muted-foreground">{status.usedFor}</p>
        </div>
        {status.configured ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-brand-strong">
            <CheckCircle2 className="size-3" /> Configured {status.hint && <span className="font-mono">{status.hint}</span>}
          </span>
        ) : (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Not configured</span>
        )}
      </div>
      {status.source && (
        <p className="text-[0.7rem] text-muted-foreground">
          Source: {SOURCE[status.source] ?? status.source}
          {status.source !== "dashboard" && " · a value saved here takes precedence for dashboard audits."}
        </p>
      )}
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim()) void run(() => onSave(value.trim()));
        }}
      >
        <div className="relative flex-1">
          <Input
            id={id}
            type={show ? "text" : "password"}
            autoComplete="off"
            spellCheck={false}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={status.configured ? "Enter a new value to replace" : "Paste value"}
            className="h-9 pr-9 font-mono text-xs"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${id}-err` : undefined}
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={show ? "Hide value" : "Show value"}
          >
            {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </button>
        </div>
        <div className="flex gap-2">
          <Button type="submit" size="sm" className="h-9" disabled={busy || !value.trim()}>
            {busy && <Loader2 className="size-3.5 animate-spin" />} Save
          </Button>
          {service && status.configured && (
            <Button type="button" variant="outline" size="sm" className="h-9" disabled={verifying} onClick={verify} title="Makes one real request to check the key">
              {verifying ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" />} Verify
            </Button>
          )}
          {status.source === "dashboard" && (
            <Button type="button" variant="outline" size="sm" className="h-9" disabled={busy} onClick={() => void run(onRemove)}>
              <Trash2 className="size-3.5" /> Remove
            </Button>
          )}
        </div>
      </form>
      {verifying && service === "pagespeed" && <p className="text-[0.7rem] text-muted-foreground">Running one PageSpeed test, this takes 10 to 40 seconds…</p>}
      <AnimatePresence>
        {verdict && (
          <motion.p
            role="status"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={
              verdict.ok
                ? "flex gap-1.5 rounded-md bg-success-soft p-2 text-xs text-brand-strong"
                : "flex gap-1.5 rounded-md bg-critical-soft p-2 text-xs text-critical"
            }
          >
            {verdict.ok ? <CheckCircle2 className="mt-px size-3.5 shrink-0" /> : <XCircle className="mt-px size-3.5 shrink-0" />}
            {verdict.message}
          </motion.p>
        )}
      </AnimatePresence>
      {error && <p id={`${id}-err`} role="alert" className="text-xs text-critical">{error}</p>}
    </div>
  );
}
