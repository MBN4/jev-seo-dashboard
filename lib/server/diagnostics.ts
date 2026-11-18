import "server-only";
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { dataDir, engineDir, enginePython, maxConcurrentAudits, reportsDir } from "./config";
import { secretStatuses } from "./secrets";
import { stateWritable } from "./state";

const run = promisify(execFile);

export type CheckState = "ok" | "warning" | "error";
export interface DiagnosticCheck {
  key: string;
  label: string;
  state: CheckState;
  detail: string;
  action?: string;
}

async function py(args: string[], timeoutMs = 20000) {
  return run(enginePython(), args, {
    cwd: engineDir(),
    timeout: timeoutMs,
    env: { PATH: process.env.PATH ?? "/usr/bin:/bin", HOME: process.env.HOME ?? "", PYTHONPATH: engineDir(), LANG: "C.UTF-8" } as unknown as NodeJS.ProcessEnv,
    maxBuffer: 1024 * 1024,
  });
}

/** Cheap check used by the header badge and /api/system/health. */
export function health() {
  const engine = fs.existsSync(path.join(engineDir(), "jevseo", "cli.py"));
  return {
    status: engine ? "ok" : "degraded",
    engineFound: engine,
    reportsDirExists: fs.existsSync(reportsDir()),
    time: new Date().toISOString(),
  };
}

let cached: { at: number; data: Awaited<ReturnType<typeof computeDiagnostics>> } | null = null;

export async function diagnostics(force = false) {
  if (!force && cached && Date.now() - cached.at < 30_000) return cached.data;
  const data = await computeDiagnostics();
  cached = { at: Date.now(), data };
  return data;
}

async function computeDiagnostics() {
  const checks: DiagnosticCheck[] = [];
  const engine = engineDir();
  const engineOk = fs.existsSync(path.join(engine, "jevseo", "cli.py"));
  checks.push({
    key: "engine",
    label: "Jev SEO engine",
    state: engineOk ? "ok" : "error",
    detail: engineOk ? "Engine package found." : "The jevseo package was not found in the configured engine folder.",
    action: engineOk ? undefined : "Set JEVSEO_DIR in .env.local to your jev-seo checkout and restart the dashboard.",
  });

  let doctor: Record<string, string> | null = null;
  let pythonVersion: string | null = null;
  let doctorError: string | null = null;
  try {
    const { stdout } = await py(["-m", "jevseo", "doctor"]);
    doctor = JSON.parse(stdout);
    pythonVersion = doctor?.python ?? null;
  } catch (err) {
    doctorError = (err as Error).message.split("\n").slice(-3).join(" ").slice(0, 400);
  }
  checks.push({
    key: "python",
    label: "Python interpreter",
    state: doctor ? "ok" : "error",
    detail: doctor ? `Python ${pythonVersion} (engine virtualenv)` : `Could not run "jevseo doctor": ${doctorError}`,
    action: doctor ? undefined : "Create the engine virtualenv and install requirements (see docs/INSTALLATION.md), or set JEVSEO_PYTHON.",
  });

  const deps = ["requests", "bs4", "lxml", "matplotlib", "jinja2", "weasyprint", "openpyxl"];
  if (doctor) {
    const missing = deps.filter((d) => doctor![d] !== "ok");
    checks.push({
      key: "dependencies",
      label: "Engine dependencies",
      state: missing.length ? "error" : "ok",
      detail: missing.length ? `Missing: ${missing.join(", ")}` : `All required packages import (${deps.join(", ")}).`,
      action: missing.length ? "Run: <engine>/.venv/bin/pip install -r <engine>/requirements.txt" : undefined,
    });
  }

  // Optional JavaScript rendering
  let playwrightPkg = doctor ? doctor.playwright === "ok" : false;
  let chromium: { ok: boolean; detail: string } = { ok: false, detail: "Not checked (Playwright package missing)." };
  if (doctor && playwrightPkg) {
    try {
      await py(["-c", "from playwright.sync_api import sync_playwright\np=sync_playwright().start()\nb=p.chromium.launch()\nb.close()\np.stop()"], 30000);
      chromium = { ok: true, detail: "Chromium launches; JavaScript rendering is available." };
    } catch (err) {
      chromium = { ok: false, detail: `Chromium could not be launched: ${(err as Error).message.split("\n").find((l) => l.trim()) ?? "unknown error"}`.slice(0, 300) };
    }
  } else if (doctor && !playwrightPkg) {
    playwrightPkg = false;
  }
  checks.push({
    key: "playwright",
    label: "Playwright package",
    state: playwrightPkg ? "ok" : "warning",
    detail: playwrightPkg ? "Installed." : "Not installed. Optional: only needed to render JavaScript-only pages.",
    action: playwrightPkg ? undefined : "Optional: <engine>/.venv/bin/pip install playwright",
  });
  checks.push({
    key: "chromium",
    label: "Chromium browser",
    state: chromium.ok ? "ok" : "warning",
    detail: chromium.detail,
    action: chromium.ok ? undefined : "Optional. Standard crawling works without it; JavaScript-only pages are then analysed from raw HTML.",
  });

  const reports = reportsDir();
  let reportsState: DiagnosticCheck;
  try {
    fs.mkdirSync(reports, { recursive: true });
    fs.accessSync(reports, fs.constants.W_OK);
    const n = fs.readdirSync(reports).length;
    reportsState = { key: "reports", label: "Report directory", state: "ok", detail: `Writable; ${n} item(s) present.` };
  } catch (err) {
    reportsState = { key: "reports", label: "Report directory", state: "error", detail: (err as Error).message, action: "Set JEVSEO_REPORTS_DIR to a writable folder." };
  }
  checks.push(reportsState);

  const st = stateWritable();
  checks.push({ key: "storage", label: "Dashboard data store", state: st.ok ? "ok" : "error", detail: st.ok ? "data/ is writable (state.json, secrets.env, job logs)." : st.detail });

  const secrets = secretStatuses();
  for (const s of secrets) {
    const optional = s.key !== "TYPESAFE_API_KEY";
    checks.push({
      key: `secret:${s.key}`,
      label: s.key,
      state: s.configured ? "ok" : optional ? "warning" : "warning",
      detail: s.configured ? `Configured (${sourceLabel(s.source)}).` : `Not configured. ${s.usedFor}`,
      action: s.configured ? undefined : "Add it under Settings > API keys.",
    });
  }

  return {
    checkedAt: new Date().toISOString(),
    versions: {
      engine: doctor?.version ?? null,
      python: pythonVersion,
      node: process.version,
      dashboard: process.env.npm_package_version ?? "0.1.0",
    },
    paths: {
      // Shown as configured names only; no absolute server paths leave the server.
      engine: path.basename(engine),
      reports: path.basename(reports),
      data: path.basename(dataDir()),
    },
    limits: { maxConcurrentAudits: maxConcurrentAudits() },
    rendering: { playwright: playwrightPkg, chromium: chromium.ok },
    checks,
  };
}

export function sourceLabel(src: string | null) {
  switch (src) {
    case "dashboard":
      return "saved in dashboard";
    case "environment":
      return "environment variable";
    case "engine-env-file":
      return "engine .env file";
    case "user-keys-file":
      return "~/Desktop/Keys/.env";
    default:
      return "not set";
  }
}
