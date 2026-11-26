import { z } from "zod";
import { handle, json, readJson } from "@/lib/server/http";
import { deleteServiceAccount, gscCredentialStatus, GscError, saveServiceAccount } from "@/lib/server/gsc";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const map = (e: unknown) => {
  if (e instanceof GscError) throw Object.assign(new Error(e.message), { status: e.status });
  throw e;
};

/** PUT /api/gsc/credentials { json } -> store the service account key (mode 600). Returns status only. */
export const PUT = handle(async (req: Request) => {
  const { json: text } = z.object({ json: z.string().min(10).max(20_000) }).parse(await readJson(req));
  try {
    saveServiceAccount(text);
  } catch (e) {
    map(e);
  }
  return json(gscCredentialStatus());
});

/** DELETE /api/gsc/credentials -> remove the stored key. Synced data is kept. */
export const DELETE = handle(async () => {
  try {
    deleteServiceAccount();
  } catch (e) {
    map(e);
  }
  return json(gscCredentialStatus());
});
