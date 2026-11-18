import { handle, json, readJson } from "@/lib/server/http";
import { secretStatuses, validateSecret, writeDashboardSecrets } from "@/lib/server/secrets";
import { readState, updateState } from "@/lib/server/state";
import { auditOptionsSchema, settingsUpdateSchema, type SecretKey } from "@/lib/schemas";

export const dynamic = "force-dynamic";

/** Secrets are reported as configured/source/masked hint only. Values never leave the server. */
export const GET = handle(async () => {
  return json({ secrets: secretStatuses(), defaults: readState().defaults });
});

export const PUT = handle(async (req: Request) => {
  const body = settingsUpdateSchema.parse(await readJson(req));
  if (body.secrets) {
    const errors: Record<string, string> = {};
    for (const [k, v] of Object.entries(body.secrets)) {
      if (typeof v === "string" && v !== "") {
        const e = validateSecret(k as SecretKey, v);
        if (e) errors[k] = e;
      }
    }
    if (Object.keys(errors).length) return json({ error: { status: 400, message: "Some keys are invalid.", details: errors } }, 400);
    writeDashboardSecrets(body.secrets);
  }
  if (body.defaults) {
    const merged = auditOptionsSchema.parse({ ...readState().defaults, ...body.defaults });
    await updateState((s) => {
      s.defaults = merged;
    });
  }
  return json({ secrets: secretStatuses(), defaults: readState().defaults });
});
