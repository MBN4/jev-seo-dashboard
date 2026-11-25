import "server-only";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { engineDir, enginePython, ensureDir, jobsDir, maxAuditSeconds, maxConcurrentAudits, reportsDir } from "./config";
import { engineSecretEnv } from "./secrets";
import { writeAtomic } from "./state";
import { isValidAuditId, REPORT_FILES } from "./paths";
import { aiStageArgs, migrateOptionKeys } from "./engine-adapter";
import { prebuildBranded } from "./branding";
import { ENGINE_ENV_FILE_VAR, ENGINE_LOG_PREFIX, ENGINE_MODULE } from "@/lib/engine-protocol";
import type { AuditOptions } from "@/lib/schemas";
import type { AuditStatus } from "@/types/api";

/**
 * Audit jobs: one engine process per audit, launched with an argument array
 * (never a shell string), stderr+stdout appended to data/jobs/<id>/engine.log.
 * Because the log is a file, a job keeps reporting progress across dashboard restarts.
 */

export interface Job {
  id: string;
  url: string;
  domain: string;
  status: AuditStatus;
  options: AuditOptions;
  pid: number | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  exitCode: number | null;
  signal: string | null;
  cancelRequested: boolean;
  error: string | null;
  note: string | null;
}

interface Registry {
  children: Map<string, ChildProcess>;
  timers: Map<string, NodeJS.Timeout>;
}

const g = globalThis as unknown as { __rankoraJobs?: Registry };
const registry: Registry = (g.__rankoraJobs ??= { children: new Map(), timers: new Map() });

const TERMINAL: AuditStatus[] = ["completed", "failed", "cancelled", "interrupted"];
export const isTerminal = (s: AuditStatus) => TERMINAL.includes(s);

function jobDir(id: string) {
  return path.join(jobsDir(), id);
}
export function jobLogPath(id: string) {
  return path.join(jobDir(id), "engine.log");
}
function jobFile(id: string) {
  return path.join(jobDir(id), "job.json");
}

export function readJob(id: string): Job | null {
  if (!isValidAuditId(id)) return null;
  try {
    const job = JSON.parse(fs.readFileSync(jobFile(id), "utf8")) as Job;
    job.options = migrateOptionKeys(job.options as unknown as Record<string, unknown>) as unknown as AuditOptions;
    return job;
  } catch {
    return null;
  }
}

function saveJob(job: Job) {
  ensureDir(jobDir(job.id));
  writeAtomic(jobFile(job.id), JSON.stringify(job, null, 2));
}

export function listJobIds(): string[] {
  try {
    return fs.readdirSync(jobsDir()).filter((d) => isValidAuditId(d) && fs.existsSync(jobFile(d)));
  } catch {
    return [];
  }
}

export function readJobLog(id: string): string {
  try {
    return fs.readFileSync(jobLogPath(id), "utf8");
  } catch {
    return "";
  }
}

/** Build the exact engine argument list. Every value is validated by zod before this point. */
export function engineArgs(url: string, outDir: string, o: AuditOptions): string[] {
  const args = [
    "-m", ENGINE_MODULE, "run", url,
    "--out", outDir,
    "--max-pages", String(o.maxPages),
    "--max-depth", String(o.maxDepth),
    "--time-budget", String(o.timeBudget),
    "--render", o.render,
    "--formats", o.formats.join(","),
  ];
  args.push(...aiStageArgs(o));
  if (o.psi) args.push("--psi-pages", String(o.psiPages));
  else args.push("--no-psi");
  if (o.full) args.push("--full", "--dfs-budget", String(o.dfsBudget), "--location-code", String(o.locationCode), "--language", o.language);
  return args;
}

/** Same naming convention as the engine's default_out(): <host>-<YYYY-MM-DD-HHMM>, never reused. */
export function newAuditId(url: string, now = new Date()): string {
  const host = new URL(url).host.toLowerCase().replace(/^www\./, "").replace(/[^a-z0-9.-]/g, "-");
  const p = (n: number) => String(n).padStart(2, "0");
  const base = `${host}-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}`;
  let id = base;
  for (let i = 2; fs.existsSync(path.join(reportsDir(), id)) || fs.existsSync(jobDir(id)); i++) id = `${base}-${i}`;
  return id;
}

function pidAlive(pid: number | null): boolean {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
  } catch {
    return false;
  }
  // Guard against PID reuse after a restart: the process must still be an engine run.
  try {
    const cmd = fs.readFileSync(`/proc/${pid}/cmdline`, "utf8");
    return cmd.includes(ENGINE_MODULE);
  } catch {
    return true; // no /proc (non-Linux): trust kill(0)
  }
}

export function runningJobs(): Job[] {
  return listJobIds()
    .map((id) => refreshJob(id))
    .filter((j): j is Job => !!j && (j.status === "running" || j.status === "queued"));
}

function lastErrorLines(log: string): string | null {
  const lines = log.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const refusing = lines.find((l) => /Refusing to crawl/.test(l));
  if (refusing) return refusing.replace(ENGINE_LOG_PREFIX, "");
  const tail = lines.slice(-1)[0];
  if (!tail) return null;
  return tail.replace(ENGINE_LOG_PREFIX, "").slice(0, 500);
}

function finalize(id: string, code: number | null, signal: NodeJS.Signals | null) {
  const job = readJob(id);
  registry.children.delete(id);
  const timer = registry.timers.get(id);
  if (timer) clearTimeout(timer);
  registry.timers.delete(id);
  if (!job || isTerminal(job.status)) return;
  job.exitCode = code;
  job.signal = signal;
  job.finishedAt = new Date().toISOString();
  const folder = path.join(reportsDir(), id);
  const hasAudit = fs.existsSync(path.join(folder, "audit.json"));
  if (job.cancelRequested) {
    job.status = "cancelled";
    job.error = "Cancelled by user.";
  } else if (code === 0 && hasAudit) {
    job.status = "completed";
    const missing = job.options.formats.filter((f) => !fs.existsSync(path.join(folder, REPORT_FILES[f].filename)));
    if (missing.length) job.note = `Audit finished but these reports are missing: ${missing.join(", ")}.`;
    // Prepare the branded report copies in the background so downloads are instant.
    setImmediate(() => prebuildBranded(id));
  } else {
    job.status = "failed";
    job.error = job.error ?? lastErrorLines(readJobLog(id)) ?? `Engine exited with code ${code ?? signal}.`;
  }
  saveJob(job);
}

/**
 * Re-check a job that may have been orphaned by a dashboard restart.
 * If the engine process is gone and we never saw it exit, infer the outcome from disk.
 */
export function refreshJob(id: string): Job | null {
  const job = readJob(id);
  if (!job || isTerminal(job.status)) return job;
  if (registry.children.has(id)) return job;
  if (job.status === "running" && pidAlive(job.pid)) return job; // orphan still running: keep tailing its log
  const folder = path.join(reportsDir(), id);
  const hasAudit = fs.existsSync(path.join(folder, "audit.json"));
  const hasAllReports = job.options.formats.every((f) => fs.existsSync(path.join(folder, REPORT_FILES[f].filename)));
  job.finishedAt = new Date().toISOString();
  if (job.cancelRequested) {
    job.status = "cancelled";
    job.error = "Cancelled by user.";
  } else if (hasAudit && hasAllReports) {
    job.status = "completed";
    job.note = "The audit finished while the dashboard was not watching it (for example after a restart).";
  } else {
    job.status = "interrupted";
    job.error = hasAudit
      ? "The dashboard restarted while reports were being generated. Audit data was saved; some report files may be missing."
      : "The audit process stopped unexpectedly (the dashboard may have restarted). Start a new audit to try again.";
  }
  saveJob(job);
  return job;
}

export class JobError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function startJob(url: string, domain: string, options: AuditOptions): Job {
  const active = runningJobs();
  if (active.some((j) => j.domain === domain)) {
    throw new JobError(409, `An audit of ${domain} is already running.`);
  }
  if (active.length >= maxConcurrentAudits()) {
    throw new JobError(429, `Only ${maxConcurrentAudits()} audit(s) can run at once. Wait for the current audit to finish or cancel it.`);
  }
  ensureDir(reportsDir(), 0o755);
  const id = newAuditId(url);
  const outDir = path.join(reportsDir(), id);
  const now = new Date().toISOString();
  const job: Job = {
    id, url, domain, status: "running", options, pid: null,
    createdAt: now, startedAt: now, finishedAt: null,
    exitCode: null, signal: null, cancelRequested: false, error: null, note: null,
  };
  ensureDir(jobDir(id));
  const logFd = fs.openSync(jobLogPath(id), "a", 0o600);
  let child: ChildProcess;
  try {
    child = spawn(enginePython(), engineArgs(url, outDir, options), {
      cwd: engineDir(),
      shell: false,
      detached: true, // own process group, so cancel can stop the whole tree
      stdio: ["ignore", logFd, logFd],
      env: {
        PATH: process.env.PATH ?? "/usr/bin:/bin",
        HOME: process.env.HOME ?? "",
        LANG: process.env.LANG ?? "C.UTF-8",
        ...(process.env[ENGINE_ENV_FILE_VAR] ? { [ENGINE_ENV_FILE_VAR]: process.env[ENGINE_ENV_FILE_VAR] as string } : {}),
        ...(process.env.PLAYWRIGHT_BROWSERS_PATH ? { PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH } : {}),
        ...pickEnv(["TYPESAFE_API_KEY", "PAGESPEED_API_KEY", "DATAFORSEO_USERNAME", "DATAFORSEO_PASSWORD", "HTTPS_PROXY", "HTTP_PROXY", "NO_PROXY", "https_proxy", "http_proxy", "no_proxy", "REQUESTS_CA_BUNDLE", "SSL_CERT_FILE"]),
        ...engineSecretEnv(),
        PYTHONPATH: engineDir(),
        PYTHONUNBUFFERED: "1",
        MPLBACKEND: "Agg",
      } as unknown as NodeJS.ProcessEnv,
    });
  } finally {
    fs.closeSync(logFd);
  }
  job.pid = child.pid ?? null;
  saveJob(job);
  registry.children.set(id, child);
  child.on("error", (err) => {
    const j = readJob(id);
    if (j && !isTerminal(j.status)) {
      j.error = `Could not start the engine (${enginePython()}): ${err.message}. Check RANKORA_ENGINE_PYTHON and RANKORA_ENGINE_DIR (see Settings > Diagnostics).`;
      saveJob(j);
    }
    finalize(id, null, null);
  });
  child.on("exit", (code, signal) => finalize(id, code, signal));
  registry.timers.set(
    id,
    setTimeout(() => {
      const j = readJob(id);
      if (j && !isTerminal(j.status)) {
        j.error = `Stopped: exceeded the ${maxAuditSeconds()} second limit for one audit.`;
        saveJob(j);
        killTree(j.pid);
      }
    }, maxAuditSeconds() * 1000),
  );
  return job;
}

function pickEnv(keys: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of keys) if (process.env[k]) out[k] = process.env[k] as string;
  return out;
}

function killTree(pid: number | null) {
  if (!pid) return;
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      /* already gone */
    }
  }
  setTimeout(() => {
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      /* already gone */
    }
  }, 5000).unref();
}

export function cancelJob(id: string): Job {
  const job = refreshJob(id);
  if (!job) throw new JobError(404, "Audit job not found.");
  if (isTerminal(job.status)) throw new JobError(409, `This audit already ${job.status}.`);
  job.cancelRequested = true;
  saveJob(job);
  // Only this audit's process group is signalled; other audits and the dashboard are untouched.
  if (pidAlive(job.pid)) killTree(job.pid);
  else refreshJob(id);
  return readJob(id) ?? job;
}

/** Remove the dashboard's job record and log. Never touches the report folder. */
export function deleteJobRecord(id: string) {
  const job = readJob(id);
  if (job && !isTerminal(job.status)) throw new JobError(409, "Cancel the running audit before removing it.");
  fs.rmSync(jobDir(id), { recursive: true, force: true });
}
