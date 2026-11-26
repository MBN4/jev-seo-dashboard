import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { JobError } from "./jobs";
import { AuditLoadError } from "./audits";

export function json<T>(data: T, init?: number | ResponseInit) {
  const res = NextResponse.json(data, typeof init === "number" ? { status: init } : init);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export function problem(status: number, message: string, details?: unknown) {
  return json({ error: { status, message, ...(details ? { details } : {}) } }, status);
}

/** Uniform error mapping; never leaks stack traces or absolute paths. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response> | Response) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof ZodError) return problem(400, "Invalid request.", err.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
      if (err instanceof JobError) return problem(err.status, err.message);
      if (err instanceof AuditLoadError) return problem(422, err.message);
      const status = (err as { status?: number }).status;
      if (status && status >= 400 && status < 600) return problem(status, (err as Error).message);
      console.error("[auditpilot]", err);
      return problem(500, "Unexpected server error. See the dashboard server log for details.");
    }
  };
}

export async function readJson(req: Request, limitBytes = 64 * 1024): Promise<unknown> {
  const type = req.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) throw Object.assign(new Error("Content-Type must be application/json."), { status: 415 });
  const text = await req.text();
  if (text.length > limitBytes) throw Object.assign(new Error("Request body too large."), { status: 413 });
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw Object.assign(new Error("Request body is not valid JSON."), { status: 400 });
  }
}

export type RouteCtx<P> = { params: Promise<P> };
