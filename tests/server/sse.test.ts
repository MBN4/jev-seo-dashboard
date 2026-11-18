import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeSandbox } from "../helpers";
import { startJob } from "@/lib/server/jobs";
import { DEFAULT_AUDIT_OPTIONS } from "@/lib/schemas";

let sb: ReturnType<typeof makeSandbox>;
beforeAll(() => (sb = makeSandbox()));
afterAll(() => sb.cleanup());

describe("SSE progress stream", () => {
  it("streams snapshots from the live engine log and closes on completion", async () => {
    const job = startJob("https://stream.example.org/", "stream.example.org", DEFAULT_AUDIT_OPTIONS);
    const { GET } = await import("@/app/api/audits/[id]/events/route");
    const ac = new AbortController();
    const res = await GET(new Request("http://localhost/x", { signal: ac.signal }), { params: Promise.resolve({ id: job.id }) });
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    let text = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      text += dec.decode(value);
    }
    const snapshots = text.split("\n\n").filter((b) => b.startsWith("event: snapshot")).map((b) => JSON.parse(b.split("\ndata: ")[1]));
    expect(snapshots.length).toBeGreaterThanOrEqual(1);
    expect(snapshots.at(-1).status).toBe("completed");
    expect(text).toContain("event: end");
  });

  it("returns 404 for unknown or malformed ids", async () => {
    const { GET } = await import("@/app/api/audits/[id]/events/route");
    expect((await GET(new Request("http://localhost/x"), { params: Promise.resolve({ id: "../etc" }) })).status).toBe(404);
    expect((await GET(new Request("http://localhost/x"), { params: Promise.resolve({ id: "nope-2026" }) })).status).toBe(404);
  });
});
