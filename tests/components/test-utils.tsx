import { vi } from "vitest";

export const push = vi.fn();
let pathname = "/";
export function setPathname(p: string) {
  pathname = p;
}

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
}));

/** Route-aware fetch stub: map "METHOD path-prefix" to a JSON response. */
export function mockFetch(routes: Record<string, unknown | ((init?: RequestInit) => unknown)>) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    const method = (init?.method ?? "GET").toUpperCase();
    const key = Object.keys(routes).sort((a, b) => b.length - a.length).find((k) => {
      const [m, p] = k.split(" ");
      return m === method && url.startsWith(p);
    });
    if (!key) return new Response(JSON.stringify({ error: { message: `unmocked ${method} ${url}` } }), { status: 500 });
    const v = routes[key];
    const body = typeof v === "function" ? (v as (i?: RequestInit) => unknown)(init) : v;
    if (body instanceof Response) return body;
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return calls;
}

// Recharts' ResponsiveContainer needs ResizeObserver in jsdom.
class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;
if (typeof window !== "undefined") {
  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.HTMLElement.prototype.hasPointerCapture = () => false;
  window.HTMLElement.prototype.releasePointerCapture = () => {};
}
