import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Isolated sandbox for each test file: a fake engine directory, a reports directory with
 * a real engine audit.json fixture, and a dashboard data directory. Nothing touches the
 * real engine checkout or the user's reports.
 */
export function makeSandbox() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "auditpilot-test-"));
  const engine = path.join(root, "engine");
  const reports = path.join(engine, "jev-seo-reports");
  const data = path.join(root, "data");
  fs.mkdirSync(path.join(engine, "jevseo"), { recursive: true });
  fs.writeFileSync(path.join(engine, "jevseo", "cli.py"), "# placeholder\n");
  fs.mkdirSync(reports, { recursive: true });
  for (const k of ["JEVSEO_DIR", "JEVSEO_REPORTS_DIR", "JEVSEO_DATA_DIR", "JEVSEO_PYTHON"]) delete process.env[k];
  process.env.AUDITPILOT_BRANDED_PREBUILD = "0";
  process.env.AUDITPILOT_ENGINE_DIR = engine;
  process.env.AUDITPILOT_REPORTS_DIR = reports;
  process.env.AUDITPILOT_DATA_DIR = data;
  process.env.AUDITPILOT_ENGINE_PYTHON = path.join(__dirname, "fixtures", "fake-engine.sh");
  for (const k of ["TYPESAFE_API_KEY", "PAGESPEED_API_KEY", "DATAFORSEO_USERNAME", "DATAFORSEO_PASSWORD"]) delete process.env[k];
  return { root, engine, reports, data, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

export function fixtureAudit() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "audit.json"), "utf8"));
}

/** Install an audit folder (engine output) under the sandbox reports dir. */
export function installAudit(reports: string, id: string, mutate?: (a: ReturnType<typeof fixtureAudit>) => void, files: string[] = ["report.pdf", "report.xlsx", "report.md"]) {
  const dir = path.join(reports, id);
  fs.mkdirSync(dir, { recursive: true });
  const a = fixtureAudit();
  mutate?.(a);
  fs.writeFileSync(path.join(dir, "audit.json"), JSON.stringify(a));
  for (const f of files) fs.writeFileSync(path.join(dir, f), `test ${f}`);
  return dir;
}

export async function waitFor(fn: () => boolean, ms = 15000) {
  const start = Date.now();
  while (!fn()) {
    if (Date.now() - start > ms) throw new Error("timed out");
    await new Promise((r) => setTimeout(r, 100));
  }
}

export function jsonReq(url: string, method: string, body?: unknown) {
  return new Request(`http://localhost:3000${url}`, {
    method,
    headers: { "content-type": "application/json", host: "localhost:3000" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
