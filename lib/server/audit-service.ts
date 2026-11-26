import "server-only";
import { createAuditSchema, DEFAULT_AUDIT_OPTIONS, auditOptionsSchema, type AuditOptions } from "@/lib/schemas";
import { validateAuditTarget, type Resolver } from "./url-guard";
import { startJob, JobError } from "./jobs";
import { readState, updateState } from "./state";
import { isConfigured } from "./secrets";
import { maxCrawlPages } from "./config";

/** Validate a create-audit request end to end and launch the engine. */
export async function createAudit(body: unknown, resolver?: Resolver) {
  const req = createAuditSchema.parse(body);
  const defaults = readState().defaults ?? DEFAULT_AUDIT_OPTIONS;
  const options: AuditOptions = auditOptionsSchema.parse({ ...defaults, ...req.options });
  const target = await validateAuditTarget(req.url, resolver);
  if (!target.ok || !target.url) throw new JobError(422, target.error ?? "Invalid URL.");
  if (options.full) {
    if (!req.confirmPaid) throw new JobError(400, "Full mode calls paid DataForSEO endpoints. Confirm the spend to continue.");
    if (!isConfigured("DATAFORSEO_USERNAME") || !isConfigured("DATAFORSEO_PASSWORD")) {
      throw new JobError(422, "Full mode needs DATAFORSEO_USERNAME and DATAFORSEO_PASSWORD. Add them in Settings first.");
    }
  }
  const domain = new URL(target.url).hostname.toLowerCase().replace(/^www\./, "");
  const warnings: string[] = [];
  if (options.maxPages > maxCrawlPages()) {
    warnings.push(`This server crawls at most ${maxCrawlPages().toLocaleString()} pages per audit (AUDITPILOT_MAX_PAGES); the limit was lowered from ${options.maxPages.toLocaleString()}.`);
    options.maxPages = maxCrawlPages();
  }
  // No key, no AI stage: turn it off up front instead of letting the engine log a warning.
  if (options.ai && !isConfigured("TYPESAFE_API_KEY")) {
    options.ai = false;
    warnings.push("AI judgments are off: no TYPESAFE_API_KEY is set. The rest of the audit runs normally.");
  }
  if (options.psi && !isConfigured("PAGESPEED_API_KEY")) warnings.push("PageSpeed runs without a key and is often rate limited (HTTP 429). Add a free key in Settings for reliable results.");
  const job = startJob(target.url, domain, options);
  const kws = [...new Set((req.keywords ?? []).map((k) => k.trim()).filter(Boolean))];
  if (kws.length) await updateState((s) => void (s.keywords[job.id] = kws));
  return { job, warnings };
}
