"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, FileStack, Hash, Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CountUp } from "@/components/motion/primitives";
import { api, ApiError } from "@/lib/api";
import { checkUrlSyntax } from "@/lib/url";
import { cn } from "@/lib/utils";
import type { SiteSize } from "@/lib/server/site-size";

export const MAX_PAGES_CAP = 2000;

/** Crawl time budget that comfortably fits `pages` (seconds), within the engine's limits. */
export function suggestedTimeBudget(pages: number): number {
  return Math.min(5400, Math.max(600, Math.ceil((pages * 2) / 60) * 60));
}

/**
 * "Count pages" for the URL in the form: reads robots.txt and sitemaps (no crawl) and lets the
 * user apply the count as the crawl limit.
 */
export function SiteSizeCounter({ url, currentMax, onApply }: { url: string; currentMax: number; onApply: (pages: number, timeBudget: number) => void }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SiteSize | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showFiles, setShowFiles] = useState(false);
  const valid = checkUrlSyntax(url).ok;

  const count = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await api.siteSize(url));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not count pages.");
    } finally {
      setBusy(false);
    }
  };

  const target = result ? Math.min(result.estimate, MAX_PAGES_CAP) : 0;
  const covered = result && currentMax >= result.estimate;

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" size="sm" className="h-9" onClick={count} disabled={!valid || busy}>
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Hash className="size-3.5" />}
        {busy ? "Counting pages…" : "Count pages"}
      </Button>
      {busy && <p className="text-[0.7rem] text-muted-foreground">Reading robots.txt and sitemaps; nothing is crawled. Usually a few seconds.</p>}
      {error && <p role="alert" className="text-xs text-critical">{error}</p>}
      <AnimatePresence>
        {result && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: -6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border bg-muted/30 p-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">{result.basis === "sitemap" ? "Pages listed in the site's sitemaps" : "Pages linked from the homepage (no sitemap found)"}</p>
                  <p className="text-3xl leading-tight font-semibold tracking-tight tabular">
                    <CountUp value={result.estimate} />
                    {(result.truncated || result.basis === "homepage-links") && <span className="text-lg text-muted-foreground">+</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {result.host} · {result.basis === "sitemap" ? `${result.sitemapFiles.filter((f) => !f.error).length} sitemap file(s)` : "lower bound"}
                    {result.basis === "sitemap" && ` · homepage links to ${result.homepageLinks}`}
                  </p>
                </div>
                {covered ? (
                  <p className="text-xs font-medium text-brand-strong">Your crawl limit ({currentMax}) already covers this.</p>
                ) : (
                  <Button type="button" size="sm" onClick={() => onApply(target, suggestedTimeBudget(target))}>
                    <Wand2 className="size-3.5" /> Crawl {target.toLocaleString()} pages
                  </Button>
                )}
              </div>
              {result.estimate > MAX_PAGES_CAP && (
                <p className="mt-2 text-xs text-warning-ink">The dashboard crawls at most {MAX_PAGES_CAP.toLocaleString()} pages per audit; the limit will be set to that.</p>
              )}
              {!covered && <p className="mt-2 text-[0.7rem] text-muted-foreground">Applying also raises the crawl time budget so the crawl is not cut short. Larger crawls take longer, roughly a few minutes per 100 pages on a typical site.</p>}
              {result.notes.map((n) => <p key={n} className="mt-1 text-[0.7rem] text-muted-foreground">{n}</p>)}
              {result.sitemapFiles.length > 0 && (
                <div className="mt-2">
                  <button type="button" onClick={() => setShowFiles((s) => !s)} aria-expanded={showFiles} className="inline-flex items-center gap-1 text-xs text-info hover:underline">
                    <FileStack className="size-3.5" /> Sitemap files ({result.sitemapFiles.length})
                    <ChevronDown className={cn("size-3.5 transition-transform", showFiles && "rotate-180")} />
                  </button>
                  {showFiles && (
                    <ul className="mt-2 max-h-48 space-y-0.5 overflow-y-auto rounded-md border bg-card p-2 font-mono text-[0.7rem]">
                      {result.sitemapFiles.map((f) => (
                        <li key={f.url} className="flex justify-between gap-3">
                          <span className="truncate" title={f.url}>{f.url.replace(/^https?:\/\/[^/]+/, "")}</span>
                          <span className={cn("shrink-0", f.error ? "text-critical" : "text-muted-foreground")}>
                            {f.error ?? (f.type === "sitemapindex" ? `index → ${f.children}` : `${f.urls} URLs`)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
