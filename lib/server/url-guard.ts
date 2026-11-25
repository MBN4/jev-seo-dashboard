import "server-only";
import dns from "node:dns/promises";
import net from "node:net";
import { checkUrlSyntax, type UrlCheck } from "@/lib/url";

/**
 * Server-side SSRF guard for audit targets.
 *
 * The engine applies its own guard too (`public_host` in its crawler, re-checked on
 * every redirect hop), so this is defence in depth: refuse before a process is spawned.
 */

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, o) => (acc << 8) + Number(o), 0) >>> 0;
}

const V4_BLOCKS: Array<[string, number]> = [
  ["0.0.0.0", 8], // "this" network
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local, incl. cloud metadata 169.254.169.254
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // TEST-NET-1
  ["192.88.99.0", 24], // 6to4 relay
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // TEST-NET-2
  ["203.0.113.0", 24], // TEST-NET-3
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved + broadcast
];

export function isBlockedIPv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  return V4_BLOCKS.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (n & mask) === (ipv4ToInt(base) & mask);
  });
}

function expandIPv6(ip: string): number[] | null {
  let s = ip.toLowerCase().split("%")[0];
  // Embedded IPv4 tail (e.g. ::ffff:1.2.3.4)
  const v4 = s.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (v4) {
    const n = ipv4ToInt(v4[1]);
    s = s.slice(0, -v4[1].length) + `${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`;
  }
  const [head, tail] = s.split("::");
  const h = head ? head.split(":") : [];
  const t = tail !== undefined ? (tail ? tail.split(":") : []) : [];
  if (tail === undefined && h.length !== 8) return null;
  const fill = 8 - h.length - t.length;
  if (fill < 0) return null;
  const parts = [...h, ...Array(tail !== undefined ? fill : 0).fill("0"), ...t].map((x) => parseInt(x, 16));
  return parts.length === 8 && parts.every((x) => Number.isFinite(x) && x >= 0 && x <= 0xffff) ? parts : null;
}

export function isBlockedIPv6(ip: string): boolean {
  const p = expandIPv6(ip);
  if (!p) return true;
  const allZeroPrefix = p.slice(0, 5).every((x) => x === 0);
  if (allZeroPrefix && p[5] === 0xffff) {
    // IPv4-mapped
    return isBlockedIPv4(`${p[6] >> 8}.${p[6] & 255}.${p[7] >> 8}.${p[7] & 255}`);
  }
  if (p.every((x) => x === 0)) return true; // ::
  if (p.slice(0, 7).every((x) => x === 0) && p[7] === 1) return true; // ::1
  if (allZeroPrefix && p[5] === 0) return true; // IPv4-compatible (deprecated)
  if (p[0] === 0x64 && p[1] === 0xff9b) return true; // NAT64 can reach internal v4
  if ((p[0] & 0xfe00) === 0xfc00) return true; // unique local fc00::/7 (incl. fd00:ec2::254 metadata)
  if ((p[0] & 0xffc0) === 0xfe80) return true; // link-local
  if ((p[0] & 0xffc0) === 0xfec0) return true; // site-local (deprecated)
  if ((p[0] & 0xff00) === 0xff00) return true; // multicast
  if (p[0] === 0x2001 && p[1] === 0x0db8) return true; // documentation
  if (p[0] === 0x2002) return true; // 6to4 can embed private v4
  if (p[0] === 0x2001 && p[1] === 0) return true; // Teredo
  return false;
}

export function isBlockedIp(ip: string): boolean {
  const kind = net.isIP(ip);
  if (kind === 4) return isBlockedIPv4(ip);
  if (kind === 6) return isBlockedIPv6(ip);
  return true;
}

export type Resolver = (host: string) => Promise<string[]>;

const defaultResolver: Resolver = async (host) => {
  const res = await dns.lookup(host, { all: true, verbatim: true });
  return res.map((r) => r.address);
};

export interface TargetCheck extends UrlCheck {
  addresses?: string[];
}

/**
 * Full validation: syntax (shared with the browser) + DNS resolution where every
 * resolved address must be public. A host that resolves to any private address is refused,
 * which also blunts simple DNS-rebinding setups that return mixed answers.
 */
export async function validateAuditTarget(input: string, resolve: Resolver = defaultResolver): Promise<TargetCheck> {
  const syntax = checkUrlSyntax(input);
  if (!syntax.ok || !syntax.url) return syntax;
  const host = new URL(syntax.url).hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host)) {
    return isBlockedIp(host)
      ? { ok: false, error: "This address is private, local or reserved. Only public websites can be audited." }
      : { ...syntax, addresses: [host] };
  }
  let addresses: string[];
  try {
    addresses = await Promise.race([
      resolve(host),
      new Promise<string[]>((_, reject) => setTimeout(() => reject(new Error("timeout")), 8000)),
    ]);
  } catch {
    return { ok: false, error: `The domain ${host} could not be resolved. Check the spelling and that the site is online.` };
  }
  if (!addresses.length) return { ok: false, error: `The domain ${host} has no DNS records.` };
  const blocked = addresses.filter(isBlockedIp);
  if (blocked.length) {
    return { ok: false, error: `${host} resolves to a private, local or reserved address. Only public websites can be audited.` };
  }
  return { ...syntax, addresses };
}
