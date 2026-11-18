import { handle, json, readJson } from "@/lib/server/http";
import { listAudits } from "@/lib/server/audits";
import { createAudit } from "@/lib/server/audit-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/audits?q=&status=&from=&to=&sort=date|score|domain&dir=&page=&pageSize= */
export const GET = handle(async (req: Request) => {
  const sp = new URL(req.url).searchParams;
  let items = listAudits();
  const q = sp.get("q")?.toLowerCase().trim();
  if (q) items = items.filter((a) => a.domain.includes(q) || a.url.toLowerCase().includes(q));
  const status = sp.getAll("status").filter(Boolean);
  if (status.length) items = items.filter((a) => status.includes(a.status));
  const from = sp.get("from");
  const to = sp.get("to");
  if (from) items = items.filter((a) => (a.startedAt ?? a.createdAt) >= from);
  if (to) items = items.filter((a) => (a.startedAt ?? a.createdAt).slice(0, 10) <= to);
  const sort = sp.get("sort") ?? "date";
  const dir = sp.get("dir") === "asc" ? 1 : -1;
  items.sort((a, b) => {
    if (sort === "score") return dir * ((a.score ?? -1) - (b.score ?? -1));
    if (sort === "domain") return dir * a.domain.localeCompare(b.domain);
    if (sort === "findings") return dir * ((a.findingsTotal ?? -1) - (b.findingsTotal ?? -1));
    return dir * (a.startedAt ?? a.createdAt).localeCompare(b.startedAt ?? b.createdAt);
  });
  const pageSize = Math.min(Math.max(Number(sp.get("pageSize")) || 20, 1), 100);
  const page = Math.max(Number(sp.get("page")) || 1, 1);
  return json({ items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, pageSize });
});

/** POST /api/audits { url, options?, confirmPaid? } -> 202 { id, status, warnings } */
export const POST = handle(async (req: Request) => {
  const body = await readJson(req);
  const { job, warnings } = await createAudit(body);
  return json({ id: job.id, status: job.status, url: job.url, domain: job.domain, warnings }, 202);
});
