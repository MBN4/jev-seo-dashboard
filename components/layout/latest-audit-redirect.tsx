import "server-only";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Radar } from "lucide-react";
import { listAudits } from "@/lib/server/audits";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";

/** Sidebar analysis sections open the latest completed audit, or explain why there is none. */
export function LatestAuditRedirect({ tab, label }: { tab: string; label: string }) {
  const latest = listAudits().find((a) => a.status === "completed" && a.hasResults);
  if (latest) redirect(`/audits/${encodeURIComponent(latest.id)}/${tab}`);
  return (
    <EmptyState
      icon={Radar}
      title={`${label} needs a completed audit`}
      description="Run an audit first. This section then shows its results; switch audits from Audit History."
      action={<Button asChild><Link href="/audits/new">Start an audit</Link></Button>}
    />
  );
}
