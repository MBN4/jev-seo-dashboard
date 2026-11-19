import "server-only";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { engineDir, secretsFile } from "./config";
import { writeAtomic } from "./state";
import { SECRET_KEYS, type SecretKey } from "@/lib/schemas";

/**
 * API credentials.
 *
 * Keys entered in the dashboard are stored in data/secrets.env (mode 600, git-ignored)
 * and injected into the engine process environment. Keys that already exist elsewhere
 * (process environment, the engine's own .env files) are detected for status display
 * but never read back to the browser and never modified.
 */

export type SecretSource = "dashboard" | "environment" | "engine-env-file" | "user-keys-file";

export interface SecretStatus {
  key: SecretKey;
  configured: boolean;
  source: SecretSource | null;
  /** Masked hint, e.g. "••••3f9a". Never the value. */
  hint: string | null;
  usedFor: string;
}

export const SECRET_PURPOSE: Record<SecretKey, string> = {
  TYPESAFE_API_KEY: "AI judgments (content quality, intent, trust, title and meta fit). Without it the audit runs as a partial audit.",
  PAGESPEED_API_KEY: "Optional. Raises the Google PageSpeed Insights quota; unkeyed runs are often rate limited (HTTP 429).",
  DATAFORSEO_USERNAME: "Full mode only: rankings, keywords, competitors, backlinks (billed per call by DataForSEO).",
  DATAFORSEO_PASSWORD: "Full mode only, paired with DATAFORSEO_USERNAME.",
};

function parseEnvFile(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  let text: string;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return out;
  }
  for (let line of text.split(/\r?\n/)) {
    line = line.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("export ")) line = line.slice(7);
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const k = line.slice(0, eq).trim();
    const v = line.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    if (v) out[k] = v;
  }
  return out;
}

export function readDashboardSecrets(): Partial<Record<SecretKey, string>> {
  const all = parseEnvFile(secretsFile());
  const out: Partial<Record<SecretKey, string>> = {};
  for (const k of SECRET_KEYS) if (all[k]) out[k] = all[k];
  return out;
}

export function mask(value: string): string {
  return value.length >= 12 ? `••••${value.slice(-4)}` : "••••";
}

export function validateSecret(key: SecretKey, value: string): string | null {
  if (!value.trim()) return "Value is empty.";
  if (/[\s"'`$\\]/.test(value.trim())) return "Value contains spaces, quotes or shell characters.";
  if (value.length > 512) return "Value is too long.";
  if (key === "DATAFORSEO_USERNAME" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$|^[A-Za-z0-9._-]{3,}$/.test(value)) return "Expected the DataForSEO login (usually an email).";
  if ((key === "TYPESAFE_API_KEY" || key === "PAGESPEED_API_KEY") && value.trim().length < 16) return "This looks too short to be an API key.";
  return null;
}

export function writeDashboardSecrets(update: Partial<Record<SecretKey, string | null>>): void {
  const current = readDashboardSecrets();
  for (const [k, v] of Object.entries(update) as Array<[SecretKey, string | null | undefined]>) {
    if (v === undefined) continue;
    if (v === null || v === "") delete current[k];
    else current[k] = v.trim();
  }
  const body =
    "# Written by the SEO dashboard. Do not commit. Mode 600.\n" +
    SECRET_KEYS.filter((k) => current[k]).map((k) => `${k}=${current[k]}`).join("\n") +
    "\n";
  writeAtomic(secretsFile(), body);
  fs.chmodSync(secretsFile(), 0o600);
}

/** Same lookup order the engine uses (jevseo/env.py), with the dashboard store first. */
export function secretStatuses(): SecretStatus[] {
  const dash = readDashboardSecrets();
  const engineEnv = parseEnvFile(path.join(engineDir(), ".env"));
  const userKeys = parseEnvFile(path.join(os.homedir(), "Desktop", "Keys", ".env"));
  return SECRET_KEYS.map((key) => {
    let source: SecretSource | null = null;
    let value: string | undefined;
    if (dash[key]) [source, value] = ["dashboard", dash[key]];
    else if (process.env[key]) [source, value] = ["environment", process.env[key]];
    else if (engineEnv[key]) [source, value] = ["engine-env-file", engineEnv[key]];
    else if (userKeys[key]) [source, value] = ["user-keys-file", userKeys[key]];
    return { key, configured: Boolean(value), source, hint: value ? mask(value) : null, usedFor: SECRET_PURPOSE[key] };
  });
}

/** Server-only: the effective value of a key, using the same precedence as secretStatuses(). */
export function resolveSecret(key: SecretKey): string | null {
  const dash = readDashboardSecrets();
  if (dash[key]) return dash[key] as string;
  if (process.env[key]) return process.env[key] as string;
  const engineEnv = parseEnvFile(path.join(engineDir(), ".env"));
  if (engineEnv[key]) return engineEnv[key];
  const userKeys = parseEnvFile(path.join(os.homedir(), "Desktop", "Keys", ".env"));
  return userKeys[key] ?? null;
}

export function isConfigured(key: SecretKey): boolean {
  return secretStatuses().find((s) => s.key === key)?.configured ?? false;
}

/** Environment for the engine child process: dashboard-stored keys win. */
export function engineSecretEnv(): Record<string, string> {
  return { ...readDashboardSecrets() } as Record<string, string>;
}
