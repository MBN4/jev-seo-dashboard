import { LatestAuditRedirect } from "@/components/layout/latest-audit-redirect";

export const dynamic = "force-dynamic";

export default function Page() {
  return <LatestAuditRedirect tab="technical" label="Technical SEO" />;
}
