import "server-only";
import { getAuditSummary } from "./audits";
import { readJob, readJobLog, refreshJob } from "./jobs";
import { parseEngineLog, summarizeProgress } from "@/lib/progress";
import { redactPaths } from "./redact";

export function progressSnapshot(id: string) {
  const summary = getAuditSummary(id);
  if (!summary) return null;
  refreshJob(id);
  const job = readJob(id);
  const log = job ? redactPaths(readJobLog(id)) : "";
  const events = parseEngineLog(log);
  const progress = job
    ? summarizeProgress(events, job.status)
    : null; // imported audits have no live log
  return {
    id,
    status: summary.status,
    url: summary.url,
    domain: summary.domain,
    startedAt: job?.startedAt ?? summary.startedAt,
    finishedAt: job?.finishedAt ?? summary.finishedAt,
    error: job?.error ? redactPaths(job.error) : null,
    note: job?.note ?? null,
    options: job?.options ?? summary.options,
    hasResults: summary.hasResults,
    tracked: Boolean(job),
    progress,
    events: events.slice(-300),
    eventCount: events.length,
  };
}
