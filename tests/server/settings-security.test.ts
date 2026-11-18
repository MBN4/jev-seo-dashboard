import fs from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { jsonReq, makeSandbox } from "../helpers";
import { middleware } from "@/middleware";
import { secretsFile } from "@/lib/server/config";

let sb: ReturnType<typeof makeSandbox>;
beforeAll(() => (sb = makeSandbox()));
afterAll(() => sb.cleanup());

const SECRET = "tsk_live_1234567890abcdefSECRET";

describe("settings and credentials", () => {
  it("stores secrets in a 600 file and never returns them", async () => {
    const { GET, PUT } = await import("@/app/api/settings/route");
    const res = await PUT(jsonReq("/api/settings", "PUT", { secrets: { TYPESAFE_API_KEY: SECRET } }));
    const text = await res.text();
    expect(res.status).toBe(200);
    expect(text).not.toContain(SECRET);
    expect(text).not.toContain("1234567890");
    const st = JSON.parse(text).secrets.find((s: { key: string }) => s.key === "TYPESAFE_API_KEY");
    expect(st).toMatchObject({ configured: true, source: "dashboard", hint: "••••CRET" });
    expect(fs.statSync(secretsFile()).mode & 0o777).toBe(0o600);
    expect(await (await GET()).text()).not.toContain(SECRET);
  });

  it("validates and removes secrets", async () => {
    const { PUT } = await import("@/app/api/settings/route");
    const bad = await PUT(jsonReq("/api/settings", "PUT", { secrets: { PAGESPEED_API_KEY: "short" } }));
    expect(bad.status).toBe(400);
    const inj = await PUT(jsonReq("/api/settings", "PUT", { secrets: { PAGESPEED_API_KEY: "abcdefghijklmnop\nEVIL=1" } }));
    expect(inj.status).toBe(400);
    const rm = await (await PUT(jsonReq("/api/settings", "PUT", { secrets: { TYPESAFE_API_KEY: null } }))).json();
    expect(rm.secrets.find((s: { key: string }) => s.key === "TYPESAFE_API_KEY").configured).toBe(false);
    expect(fs.readFileSync(secretsFile(), "utf8")).not.toContain(SECRET);
  });

  it("detects keys from the environment without exposing them", async () => {
    process.env.PAGESPEED_API_KEY = "env-key-abcdefghijklmnop";
    const { GET } = await import("@/app/api/settings/route");
    const body = await (await GET()).text();
    expect(body).not.toContain("env-key-abcdefghijklmnop");
    expect(JSON.parse(body).secrets.find((s: { key: string }) => s.key === "PAGESPEED_API_KEY")).toMatchObject({ configured: true, source: "environment" });
    delete process.env.PAGESPEED_API_KEY;
  });

  it("validates and saves audit defaults", async () => {
    const { PUT } = await import("@/app/api/settings/route");
    expect((await PUT(jsonReq("/api/settings", "PUT", { defaults: { maxPages: 0 } }))).status).toBe(400);
    const ok = await (await PUT(jsonReq("/api/settings", "PUT", { defaults: { maxPages: 25, psi: false } }))).json();
    expect(ok.defaults).toMatchObject({ maxPages: 25, psi: false, jev: true });
  });
});

describe("API request guard (middleware)", () => {
  const mk = (method: string, headers: Record<string, string>) => new NextRequest("http://localhost:3000/api/audits", { method, headers });
  it("blocks foreign Host headers (DNS rebinding)", () => {
    expect(middleware(mk("GET", { host: "attacker.example" })).status).toBe(403);
    expect(middleware(mk("GET", { host: "localhost:3000" })).status).toBe(200);
  });
  it("blocks cross-site writes", () => {
    expect(middleware(mk("POST", { host: "localhost:3000", origin: "https://evil.example" })).status).toBe(403);
    expect(middleware(mk("POST", { host: "localhost:3000", "sec-fetch-site": "cross-site" })).status).toBe(403);
    expect(middleware(mk("POST", { host: "localhost:3000", origin: "http://localhost:3000" })).status).toBe(200);
  });
});

describe("system endpoints", () => {
  it("reports health and diagnostics without absolute paths", async () => {
    const health = await import("@/app/api/system/health/route");
    expect(await (await health.GET()).json()).toMatchObject({ status: "ok", engineFound: true });
    const diag = await import("@/app/api/system/diagnostics/route");
    const text = await (await diag.GET(new Request("http://localhost/api/system/diagnostics"))).text();
    expect(text).not.toContain(sb.root);
    const body = JSON.parse(text);
    expect(body.checks.find((c: { key: string }) => c.key === "engine").state).toBe("ok");
    // fake interpreter cannot run "doctor": reported as an actionable error, not a crash
    expect(body.checks.find((c: { key: string }) => c.key === "python").state).toBe("error");
  });
});
