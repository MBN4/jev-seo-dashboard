"use client";
import { useState } from "react";
import { CheckCircle2, Eye, EyeOff, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SecretStatus } from "@/lib/api-types";

const SOURCE: Record<string, string> = {
  dashboard: "Saved in dashboard (data/secrets.env)",
  environment: "From an environment variable",
  "engine-env-file": "From the engine's .env file",
  "user-keys-file": "From ~/Desktop/Keys/.env",
};

/**
 * Write-only secret input: the current value is never sent to the browser, only whether it
 * is configured, where it comes from and a masked hint.
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
  const id = `secret-${status.key}`;
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      setValue("");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2 rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Label htmlFor={id} className="font-mono text-sm">{status.key}</Label>
          <p className="mt-0.5 text-xs text-muted-foreground">{status.usedFor}</p>
        </div>
        {status.configured ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-success-soft px-1.5 py-0.5 text-xs font-medium text-brand-strong"><CheckCircle2 className="size-3" /> Configured {status.hint && <span className="font-mono">{status.hint}</span>}</span>
        ) : (
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">Not configured</span>
        )}
      </div>
      {status.source && <p className="text-[0.7rem] text-muted-foreground">Source: {SOURCE[status.source] ?? status.source}{status.source !== "dashboard" && " · a value saved here takes precedence for dashboard audits."}</p>}
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
            className="h-8 pr-9 font-mono text-xs"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${id}-err` : undefined}
          />
          <button type="button" onClick={() => setShow((s) => !s)} className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={show ? "Hide value" : "Show value"}>
            {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </button>
        </div>
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={busy || !value.trim()}>{busy && <Loader2 className="size-3.5 animate-spin" />} Save</Button>
          {status.source === "dashboard" && (
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void run(onRemove)}><Trash2 className="size-3.5" /> Remove</Button>
          )}
        </div>
      </form>
      {error && <p id={`${id}-err`} role="alert" className="text-xs text-critical">{error}</p>}
    </div>
  );
}
