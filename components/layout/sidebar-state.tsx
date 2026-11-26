"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

/**
 * Desktop sidebar state: width (resizable by dragging) and collapsed (icon rail).
 * Persisted per browser in localStorage; everything works if storage is unavailable.
 */
export const SIDEBAR_MIN = 208;
export const SIDEBAR_MAX = 380;
export const SIDEBAR_DEFAULT = 256;
export const SIDEBAR_RAIL = 72;

interface SidebarState {
  width: number;
  collapsed: boolean;
  dragging: boolean;
  setWidth: (w: number) => void;
  setCollapsed: (c: boolean) => void;
  toggle: () => void;
  setDragging: (d: boolean) => void;
}

const Ctx = createContext<SidebarState | null>(null);

function load<T>(key: string, fallback: T): T {
  try {
    // Fall back to the value saved under the app's previous name.
    const v = localStorage.getItem(key) ?? localStorage.getItem(key.replace(/^auditpilot\./, "rankora."));
    return v == null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}
function save(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage unavailable */
  }
}

export const clampWidth = (w: number) => Math.round(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, w)));

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [width, setW] = useState(SIDEBAR_DEFAULT);
  const [collapsed, setC] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    setW(clampWidth(load("auditpilot.sidebar.width", SIDEBAR_DEFAULT)));
    setC(load("auditpilot.sidebar.collapsed", false));
  }, []);

  const setWidth = useCallback((w: number) => {
    const c = clampWidth(w);
    setW(c);
    save("auditpilot.sidebar.width", c);
  }, []);
  const setCollapsed = useCallback((c: boolean) => {
    setC(c);
    save("auditpilot.sidebar.collapsed", c);
  }, []);
  const toggle = useCallback(() => setC((c) => (save("auditpilot.sidebar.collapsed", !c), !c)), []);

  // Ctrl/Cmd + B toggles the sidebar, like most editors.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      const typing = t instanceof Element && Boolean(t.closest("input, textarea, [contenteditable]"));
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b" && !typing) {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  return <Ctx.Provider value={{ width, collapsed, dragging, setWidth, setCollapsed, toggle, setDragging }}>{children}</Ctx.Provider>;
}

export function useSidebar() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSidebar outside SidebarProvider");
  return c;
}
