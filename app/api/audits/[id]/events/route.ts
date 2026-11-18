import { problem, type RouteCtx } from "@/lib/server/http";
import { isValidAuditId } from "@/lib/server/paths";
import { progressSnapshot } from "@/lib/server/progress";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TERMINAL = new Set(["completed", "failed", "cancelled", "interrupted"]);

/**
 * GET /api/audits/{id}/events  (Server-Sent Events)
 * Emits `snapshot` events whenever the engine log or job status changes, `ping` every 15 s,
 * and closes after a terminal status. Clients can reconnect at any time; state is on disk.
 */
export async function GET(req: Request, ctx: RouteCtx<{ id: string }>) {
  const { id } = await ctx.params;
  if (!isValidAuditId(id) || !progressSnapshot(id)) return problem(404, "Audit not found.");
  const encoder = new TextEncoder();
  let closed = false;
  const stream = new ReadableStream({
    start(controller) {
      let last = "";
      let lastPing = Date.now();
      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(timer);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      const tick = () => {
        try {
          const snap = progressSnapshot(id);
          if (!snap) return close();
          const sig = `${snap.status}|${snap.eventCount}|${snap.error}|${snap.finishedAt}`;
          if (sig !== last) {
            last = sig;
            send("snapshot", snap);
          } else if (Date.now() - lastPing > 15000) {
            lastPing = Date.now();
            controller.enqueue(encoder.encode(`: ping\n\n`));
          }
          if (TERMINAL.has(snap.status)) {
            send("end", { status: snap.status });
            close();
          }
        } catch {
          close();
        }
      };
      controller.enqueue(encoder.encode(`retry: 3000\n\n`));
      const timer = setInterval(tick, 1000);
      tick();
      req.signal.addEventListener("abort", close);
    },
    cancel() {
      closed = true;
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
