/**
 * URL syntax checks shared by the browser form and the server.
 * DNS and private-network checks happen only on the server (lib/server/url-guard.ts).
 */
export interface UrlCheck {
  ok: boolean;
  url?: string;
  host?: string;
  error?: string;
}

const LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;
const BLOCKED_HOSTS = new Set(["localhost", "localhost.localdomain", "ip6-localhost", "ip6-loopback", "metadata.google.internal", "metadata"]);
const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal", ".lan", ".home", ".corp", ".intranet", ".localdomain", ".home.arpa", ".onion", ".test", ".invalid", ".example"];

function looksLikeIPv4(host: string) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

/** Integer/hex/octal IPv4 shorthands such as 2130706433, 0x7f000001, 0177.0.0.1 */
function isObfuscatedNumericHost(host: string) {
  return /^(0x[0-9a-f]+|\d+)$/i.test(host) || /^[0-9a-fx.]+$/i.test(host) && /(^|\.)0[0-7x]/i.test(host) && !looksLikeIPv4(host.replace(/^0+(?=\d)/g, ""));
}

export function checkUrlSyntax(raw: string): UrlCheck {
  const input = (raw ?? "").trim();
  if (!input) return { ok: false, error: "Enter a website URL." };
  if (input.length > 2048) return { ok: false, error: "That URL is too long." };
  if (/[\s<>"'`\\\u0000-\u001f]/.test(input)) return { ok: false, error: "The URL contains characters that are not allowed." };

  const schemeMatch = input.match(/^([a-z][a-z0-9+.-]*):/i);
  let candidate = input;
  if (schemeMatch && !/^[^:]+:\d+/.test(input)) {
    const scheme = schemeMatch[1].toLowerCase();
    if (scheme !== "http" && scheme !== "https") {
      return { ok: false, error: `Unsupported protocol "${scheme}:". Use http:// or https://.` };
    }
    if (!/^https?:\/\//i.test(input)) return { ok: false, error: "Use the form https://example.com." };
  } else {
    candidate = `https://${input}`;
  }

  let u: URL;
  try {
    u = new URL(candidate);
  } catch {
    return { ok: false, error: "This is not a valid URL." };
  }
  if (u.username || u.password) return { ok: false, error: "URLs with embedded credentials are not allowed." };
  if (u.port && u.port !== "80" && u.port !== "443") {
    return { ok: false, error: "Only standard web ports (80 and 443) can be audited." };
  }
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  if (!host) return { ok: false, error: "The URL has no domain." };
  if (host.startsWith("[")) {
    // IPv6 literal: syntax is fine; the server decides whether it is public.
    return { ok: true, url: u.toString(), host };
  }
  if (BLOCKED_HOSTS.has(host) || BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) {
    return { ok: false, error: "Local, internal and reserved hostnames cannot be audited." };
  }
  if (looksLikeIPv4(host)) {
    if (host.split(".").some((o) => Number(o) > 255)) return { ok: false, error: "This is not a valid IP address." };
    return { ok: true, url: u.toString(), host };
  }
  if (isObfuscatedNumericHost(host)) return { ok: false, error: "Numeric host shorthands are not allowed. Use the domain name." };
  const labels = host.split(".");
  if (labels.length < 2) return { ok: false, error: "Enter a full domain such as example.com." };
  if (!labels.every((l) => LABEL.test(l))) return { ok: false, error: "The domain contains invalid characters." };
  const tld = labels[labels.length - 1];
  if (!/^(xn--[a-z0-9-]+|[a-z]{2,63})$/.test(tld)) return { ok: false, error: "The domain needs a valid top-level domain such as .com." };
  return { ok: true, url: u.toString(), host };
}
