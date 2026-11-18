import { describe, expect, it } from "vitest";
import { checkUrlSyntax } from "@/lib/url";
import { isBlockedIp, validateAuditTarget } from "@/lib/server/url-guard";

const resolveTo = (...ips: string[]) => async () => ips;

describe("URL syntax (shared by browser and server)", () => {
  it.each([
    ["", "Enter a website URL."],
    ["   ", "Enter a website URL."],
    ["ftp://example.com", "Unsupported protocol"],
    ["javascript:alert(1)", "Unsupported protocol"],
    ["file:///etc/passwd", "Unsupported protocol"],
    ["https://user:pw@example.com", "credentials"],
    ["https://example.com:8080", "standard web ports"],
    ["https://localhost", "Local, internal"],
    ["https://foo.internal", "Local, internal"],
    ["https://printer.local", "Local, internal"],
    ["https://example", "full domain"],
    ["https://exa mple.com", "characters"],
    ["https://-bad-.com", "invalid characters"],
    ["https://example.c0m", "top-level domain"],
  ])("rejects %j", (input, msg) => {
    const r = checkUrlSyntax(input);
    expect(r.ok).toBe(false);
    expect(r.error).toContain(msg);
  });

  it.each([
    ["example.com", "https://example.com/"],
    ["https://www.Example.com/path?q=1", "https://www.example.com/path?q=1"],
    ["http://example.org", "http://example.org/"],
    ["https://bücher.de", "https://xn--bcher-kva.de/"],
  ])("accepts %j", (input, url) => {
    const r = checkUrlSyntax(input);
    expect(r.ok).toBe(true);
    expect(r.url).toBe(url);
  });
});

describe("SSRF guard", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "fe80::1", "fd00:ec2::254", "::ffff:127.0.0.1", "::ffff:10.0.0.1", "64:ff9b::a00:1"])(
    "blocks %s",
    (ip) => expect(isBlockedIp(ip)).toBe(true),
  );
  it.each(["93.184.216.34", "8.8.8.8", "2606:2800:220:1:248:1893:25c8:1946"])("allows public %s", (ip) => expect(isBlockedIp(ip)).toBe(false));

  it("refuses cloud metadata and private IP literals", async () => {
    for (const u of ["http://169.254.169.254/latest/meta-data", "http://127.0.0.1", "http://[::1]/", "http://2130706433/", "http://0x7f000001/"]) {
      const r = await validateAuditTarget(u, resolveTo("93.184.216.34"));
      expect(r.ok, u).toBe(false);
    }
  });

  it("refuses domains resolving to private space (including mixed answers used for DNS rebinding)", async () => {
    expect((await validateAuditTarget("https://evil.example.org", resolveTo("10.0.0.5"))).ok).toBe(false);
    expect((await validateAuditTarget("https://evil.example.org", resolveTo("93.184.216.34", "127.0.0.1"))).ok).toBe(false);
  });

  it("refuses unresolvable domains", async () => {
    const r = await validateAuditTarget("https://nope.example.org", async () => {
      throw new Error("ENOTFOUND");
    });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("could not be resolved");
  });

  it("accepts a public domain", async () => {
    const r = await validateAuditTarget("example.org", resolveTo("93.184.216.34"));
    expect(r).toMatchObject({ ok: true, url: "https://example.org/", addresses: ["93.184.216.34"] });
  });
});
