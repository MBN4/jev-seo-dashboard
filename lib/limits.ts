/**
 * Crawl limits, shared by the browser and the server.
 *
 * The audit engine has no page limit of its own. AuditPilot caps crawls to keep memory use
 * reasonable: each crawled page adds roughly 50–100 KB to audit.json (more on sites with large
 * menus), and the whole file is loaded to build the reports and views. 5,000 pages ≈ 250–500 MB.
 * The server can allow more with AUDITPILOT_MAX_PAGES (up to HARD_MAX_PAGES) on a machine with
 * enough memory.
 */
export const DEFAULT_MAX_PAGES = 5000;
export const HARD_MAX_PAGES = 20000;
/** Crawl time budget ceiling in seconds (4 hours). Crawls usually run at 2–4 pages per second. */
export const MAX_TIME_BUDGET = 14400;

/** Time budget that comfortably fits `pages` (about 2 s per page, at least 10 minutes). */
export function suggestedTimeBudget(pages: number): number {
  return Math.min(MAX_TIME_BUDGET, Math.max(600, Math.ceil((pages * 2) / 60) * 60));
}
