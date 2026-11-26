import { NextResponse, type NextRequest } from "next/server";

/**
 * The dashboard is a local, single-user tool. These checks stop other websites open in
 * the same browser from driving its API (CSRF) and stop DNS-rebinding hosts from reaching it.
 */
const DEFAULT_HOSTS = ["localhost", "127.0.0.1", "[::1]", "::1"];

function allowedHosts(): string[] {
  const extra = (process.env.AUDITPILOT_ALLOWED_HOSTS ?? process.env.RANKORA_ALLOWED_HOSTS ?? process.env.JEVSEO_ALLOWED_HOSTS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return [...DEFAULT_HOSTS, ...extra];
}

function hostname(hostHeader: string | null): string | null {
  if (!hostHeader) return null;
  const h = hostHeader.toLowerCase();
  if (h.startsWith("[")) return h.slice(0, h.indexOf("]") + 1);
  return h.split(":")[0];
}

export function middleware(req: NextRequest) {
  const hosts = allowedHosts();
  const host = hostname(req.headers.get("host"));
  if (!host || !hosts.includes(host)) {
    return NextResponse.json({ error: { status: 403, message: "Host not allowed. Add it to AUDITPILOT_ALLOWED_HOSTS to expose the dashboard." } }, { status: 403 });
  }
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.headers.get("origin");
    if (origin) {
      let originHost: string | null = null;
      try {
        originHost = hostname(new URL(origin).host);
      } catch {
        originHost = null;
      }
      if (!originHost || !hosts.includes(originHost)) {
        return NextResponse.json({ error: { status: 403, message: "Cross-site request refused." } }, { status: 403 });
      }
    }
    const fetchSite = req.headers.get("sec-fetch-site");
    if (fetchSite && fetchSite === "cross-site") {
      return NextResponse.json({ error: { status: 403, message: "Cross-site request refused." } }, { status: 403 });
    }
  }
  return NextResponse.next();
}

export const config = { matcher: ["/api/:path*"] };
