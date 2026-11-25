import { z } from "zod";
import { handle, json, problem, readJson } from "@/lib/server/http";
import { countSitePages } from "@/lib/server/site-size";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const body = z.object({ url: z.string().min(1).max(2048) });

// Light protection against accidental hammering: a few counts per minute.
const g = globalThis as unknown as { __siteSizeHits?: number[] };
const hits: number[] = (g.__siteSizeHits ??= []);

/** POST /api/site-size { url } -> page count from robots.txt + XML sitemaps (no crawl). */
export const POST = handle(async (req: Request) => {
  const { url } = body.parse(await readJson(req));
  const now = Date.now();
  while (hits.length && now - hits[0] > 60_000) hits.shift();
  if (hits.length >= 10) return problem(429, "Too many page counts in the last minute. Try again shortly.");
  hits.push(now);
  return json(await countSitePages(url));
});
