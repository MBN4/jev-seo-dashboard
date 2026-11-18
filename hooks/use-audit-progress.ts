"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { ProgressSnapshot } from "@/lib/api-types";

const TERMINAL = ["completed", "failed", "cancelled", "interrupted"];

/**
 * Live audit progress over Server-Sent Events, falling back to polling when the
 * stream cannot be opened. State lives on the server, so leaving and returning is safe.
 */
export function useAuditProgress(id: string) {
  const [snap, setSnap] = useState<ProgressSnapshot | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [transport, setTransport] = useState<"sse" | "polling" | "idle">("idle");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let closed = false;
    let es: EventSource | null = null;
    const stopPoll = () => pollRef.current && clearInterval(pollRef.current);
    const startPolling = () => {
      setTransport("polling");
      stopPoll();
      const tick = () =>
        api.progress(id).then((s) => {
          if (closed) return;
          setSnap(s);
          setError(null);
          if (TERMINAL.includes(s.status)) stopPoll();
        }).catch((e) => !closed && setError(e));
      tick();
      pollRef.current = setInterval(tick, 2000);
    };
    // Initial snapshot first, so completed audits render without a stream.
    api.progress(id).then((s) => {
      if (closed) return;
      setSnap(s);
      if (TERMINAL.includes(s.status)) return;
      if (typeof EventSource === "undefined") return startPolling();
      es = new EventSource(`/api/audits/${encodeURIComponent(id)}/events`);
      setTransport("sse");
      es.addEventListener("snapshot", (e) => setSnap(JSON.parse((e as MessageEvent).data)));
      es.addEventListener("end", () => es?.close());
      es.onerror = () => {
        if (es?.readyState === EventSource.CLOSED) {
          es = null;
          if (!closed) startPolling();
        }
      };
    }).catch((e) => !closed && setError(e));
    return () => {
      closed = true;
      es?.close();
      stopPoll();
    };
  }, [id]);

  return { snap, error, transport };
}
