"use client";
import { createContext, useContext } from "react";
import type { AuditSummary } from "@/types/api";

export const AuditCtx = createContext<{ audit: AuditSummary; reload: () => void } | null>(null);

export function useAudit() {
  const ctx = useContext(AuditCtx);
  if (!ctx) throw new Error("useAudit must be used inside the audit layout");
  return ctx;
}
