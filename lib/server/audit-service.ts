import "server-only";
import { createAuditSchema, DEFAULT_AUDIT_OPTIONS, auditOptionsSchema, type AuditOptions } from "@/lib/schemas";
import { validateAuditTarget, type Resolver } from "./url-guard";
import { startJob, JobError } from "./jobs";
import { readState } from "./state";
import { isConfigured } from "./secrets";

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
  if (options.jev && !isConfigured("TYPESAFE_API_KEY")) warnings.push("TYPESAFE_API_KEY is not set: Jev judgments will be skipped and the score marked partial.");
  if (options.psi && !isConfigured("PAGESPEED_API_KEY")) warnings.push("PAGESPEED_API_KEY is not set: PageSpeed runs unkeyed and may be rate limited (HTTP 429).");
  const job = startJob(target.url, domain, options);
  return { job, warnings };
}
