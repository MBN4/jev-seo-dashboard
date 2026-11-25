// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { setPathname } from "./test-utils";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SIDEBAR_DEFAULT, SIDEBAR_MAX, SidebarProvider } from "@/components/layout/sidebar-state";
import { TooltipProvider } from "@/components/ui/tooltip";

const ui = () => (
  <TooltipProvider>
    <SidebarProvider>
      <AppSidebar />
    </SidebarProvider>
  </TooltipProvider>
);

describe("resizable, collapsible sidebar", () => {
  it("collapses and expands on click, and with Ctrl+B, persisting the choice", () => {
    setPathname("/");
    localStorage.clear();
    render(ui());
    const btn = screen.getByRole("button", { name: "Collapse sidebar" });
    expect(btn).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(btn);
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toHaveAttribute("aria-expanded", "false");
    expect(localStorage.getItem("rankora.sidebar.collapsed")).toBe("true");
    fireEvent.keyDown(window, { key: "b", ctrlKey: true });
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBeInTheDocument();
  });

  it("resizes with the keyboard on the drag handle, within bounds, and resets on double-click", () => {
    setPathname("/");
    localStorage.clear();
    render(ui());
    const handle = screen.getByRole("separator", { name: "Resize sidebar" });
    expect(handle).toHaveAttribute("aria-valuenow", String(SIDEBAR_DEFAULT));
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(handle).toHaveAttribute("aria-valuenow", String(SIDEBAR_DEFAULT + 16));
    for (let i = 0; i < 20; i++) fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(handle).toHaveAttribute("aria-valuenow", String(SIDEBAR_MAX));
    fireEvent.doubleClick(handle);
    expect(handle).toHaveAttribute("aria-valuenow", String(SIDEBAR_DEFAULT));
    expect(localStorage.getItem("rankora.sidebar.width")).toBe(String(SIDEBAR_DEFAULT));
  });

  it("collapses when the handle is pushed below the minimum width", () => {
    setPathname("/");
    localStorage.clear();
    render(ui());
    const handle = screen.getByRole("separator", { name: "Resize sidebar" });
    for (let i = 0; i < 10; i++) fireEvent.keyDown(handle, { key: "ArrowLeft" });
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument();
  });
});
