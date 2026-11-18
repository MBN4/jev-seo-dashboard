import { z } from "zod";
import { handle, json, readJson } from "@/lib/server/http";
import { discoverReportFolders } from "@/lib/server/audits";
import { readState, updateState } from "@/lib/server/state";

export const dynamic = "force-dynamic";

const body = z.object({ restore: z.array(z.string()).optional(), restoreAll: z.boolean().optional() });

/**
 * POST /api/audits/import
 * Re-scans the engine's reports folder (read only) and optionally restores entries
 * previously removed from history. Report folders are never modified.
 */
export const POST = handle(async (req: Request) => {
  const b = body.parse(await readJson(req).catch(() => ({})));
  const folders = discoverReportFolders();
  const hidden = readState().hidden;
  const toRestore = b.restoreAll ? Object.keys(hidden) : (b.restore ?? []).filter((id) => hidden[id]);
  if (toRestore.length) await updateState((s) => toRestore.forEach((id) => delete s.hidden[id]));
  const stillHidden = Object.keys(readState().hidden);
  return json({
    discovered: folders.length,
    visible: folders.filter((f) => !stillHidden.includes(f)).length,
    restored: toRestore,
    hidden: stillHidden,
  });
});

export const GET = handle(async () => {
  const hidden = readState().hidden;
  return json({ discovered: discoverReportFolders().length, hidden: Object.entries(hidden).map(([id, at]) => ({ id, hiddenAt: at })) });
});
