import { handle, json } from "@/lib/server/http";
import { health } from "@/lib/server/diagnostics";
import { runningJobs } from "@/lib/server/jobs";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const running = runningJobs().map((j) => ({ id: j.id, domain: j.domain, startedAt: j.startedAt }));
  return json({ ...health(), running });
});
