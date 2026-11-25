// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockFetch, push } from "./test-utils";
import { settings } from "./fixtures";
import NewAuditPage from "@/app/audits/new/page";

const diag = { rendering: { playwright: false, chromium: false }, checks: [], versions: {}, paths: {}, limits: {}, checkedAt: "" };

describe("new audit form", () => {
  beforeEach(() => push.mockReset());

  it("validates the URL in the browser before calling the API", async () => {
    const calls = mockFetch({ "GET /api/settings": settings, "GET /api/system/diagnostics": diag });
    render(<NewAuditPage />);
    const input = await screen.findByLabelText("Website URL");
    await userEvent.type(input, "ftp://example.com");
    await userEvent.click(screen.getByRole("button", { name: /start audit/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Unsupported protocol/);
    expect(calls.some((c) => c.init?.method === "POST")).toBe(false);
  });

  it("shows engine defaults, missing dependencies and rendering availability", async () => {
    mockFetch({ "GET /api/settings": settings, "GET /api/system/diagnostics": diag });
    render(<NewAuditPage />);
    expect(await screen.findByLabelText("Maximum pages")).toHaveValue(60);
    expect(screen.getByText("Engine default: 60 · up to 2,000")).toBeInTheDocument();
    expect(screen.getByText(/TYPESAFE_API_KEY missing/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/Chromium: unavailable/)).toBeInTheDocument());
  });

  it("starts an audit and navigates to its progress page", async () => {
    let posted: unknown;
    mockFetch({
      "GET /api/settings": settings,
      "GET /api/system/diagnostics": diag,
      "POST /api/audits": (init?: RequestInit) => ((posted = JSON.parse(String(init?.body))), { id: "example.org-2026-01-01-0000", status: "running", warnings: [] }),
    });
    render(<NewAuditPage />);
    await userEvent.type(await screen.findByLabelText("Website URL"), "example.org");
    await userEvent.type(screen.getByLabelText(/Focus keywords/), "seo audit, site speed, seo audit");
    const btn = screen.getByRole("button", { name: /start audit/i });
    await userEvent.click(btn);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/audits/example.org-2026-01-01-0000/progress"));
    expect(posted).toMatchObject({ url: "example.org", keywords: ["seo audit", "site speed"], options: { maxPages: 60, jev: true, psi: true, full: false } });
    expect((posted as { options: Record<string, unknown> }).options).not.toHaveProperty("keywordsText");
  });

  it("requires confirmation before a paid DataForSEO audit", async () => {
    const dfsSettings = { ...settings, secrets: settings.secrets.map((s) => (s.key.startsWith("DATAFORSEO") ? { ...s, configured: true } : s)) };
    const calls = mockFetch({ "GET /api/settings": dfsSettings, "GET /api/system/diagnostics": diag, "POST /api/audits": { id: "x-2026", status: "running", warnings: [] } });
    render(<NewAuditPage />);
    await userEvent.type(await screen.findByLabelText("Website URL"), "example.org");
    await userEvent.click(screen.getByRole("switch", { name: /DataForSEO/ }));
    await userEvent.click(screen.getByRole("button", { name: /start audit/i }));
    expect(await screen.findByRole("alertdialog")).toHaveTextContent(/billed/);
    expect(calls.some((c) => c.init?.method === "POST")).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: /yes, run full audit/i }));
    await waitFor(() => expect(calls.find((c) => c.init?.method === "POST")).toBeTruthy());
    expect(JSON.parse(String(calls.find((c) => c.init?.method === "POST")!.init!.body)).confirmPaid).toBe(true);
  });
});
