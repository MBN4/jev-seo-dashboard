# Development progress

## Status: complete

The dashboard is implemented, tested and verified end to end against the real jev-seo engine (v0.1.1, commit cloned 2026-11-18).

## Decisions confirmed with the owner

- **Frontend only:** the Python engine is untouched. Next.js route handlers run the CLI as a subprocess, with no FastAPI layer.
- **Storage:** files only. Report folders are the source of truth, and the dashboard's own state is in `data/` (not SQLite).
- **Main acceptance test:** a full audit run from the UI, ending with the engine's PDF/XLSX/MD downloaded unchanged.

## Completed work

- Engine analysis: CLI flags, stage logging, output schema, key lookup, SSRF guard, naming convention.
- Server layer: safe subprocess runner, SSE progress, restart recovery, cancel, concurrency and duplicate limits, audit discovery and caching, paginated result projections, recommendation state, secrets store, diagnostics, path-safe downloads, Host/CSRF middleware, URL validation with DNS checks.
- UI: design tokens, app shell (collapsible sidebar, mobile drawer, breadcrumbs, search, live status), Overview, New Audit, Progress, results workspace (7 tabs), History, Reports center, Settings (keys, defaults, diagnostics), and empty, loading and error states.
- Documentation: README, docs/INSTALLATION, ARCHITECTURE, API, USER_GUIDE.

## Files created

`app/**` (pages and API routes), `components/{audit,charts,common,layout,settings}/**`, `components/ui/**` (shadcn), `hooks/*`, `lib/{api,api-types,format,progress,schemas,url,report-labels}.ts`, `lib/server/*`, `types/*`, `middleware.ts`, `tests/**`, `e2e/acceptance.cjs`, `start.sh`, `.env.example`, `vitest.config.mts`, docs.

## Files modified in the engine

**None.** `git status` in the engine checkout is clean.

## Tests executed (actual results)

| Check | Result |
| --- | --- |
| Engine unit tests (`python -m unittest discover -s tests`), before and after | 38/38 OK both times |
| Engine CLI (`run`, `doctor`, `rescore`) after the dashboard was built | Works; outputs unchanged |
| Dashboard Vitest: 7 backend files + 4 component files | 91/91 passed |
| `tsc --noEmit` | 0 errors |
| `eslint .` | 0 problems |
| `next build` | Success |
| E2E acceptance (Playwright, production server, real engine, python.org, 8 pages) | Started from the UI. Live stages streamed. Completed in 34 s, score 96 (A, partial). All result tabs rendered. PDF (220 KB), XLSX (332 KB) and MD (11.6 KB) downloads were SHA-256 identical to the engine's files. 0 console errors. |
| Mobile (iPhone 13 emulation) | No horizontal overflow; drawer navigation works |

The backend tests cover: audit creation and validation, the SSRF and private-IP and metadata guard (including mixed DNS answers and numeric hosts), engine argv mapping, job execution, failure capture, cancel, the concurrency limit, restart recovery, SSE streaming, log parsing, findings and pages pagination and filtering, page detail, the Jev-unavailable state, PSI 429 classification, recommendation persistence (`audit.json` byte-identical afterwards), report downloads, path traversal and symlink escape refusal, import/hide/restore, secrets masking and file mode 600, settings validation, Host/CSRF middleware, and diagnostics without leaking paths.

The component tests cover: navigation, the audit form (URL validation, defaults, paid confirmation, submit and navigate), the progress tracker, dashboard widgets and empty state, finding filters and drawer, lazy page details, recommendations, the history table, report links, and the masked key input.

## Known limitations

- **No live Jev or DataForSEO run:** this environment had no TypeSafe or DataForSEO credentials.
  - The AI Content and DataForSEO paths were verified with engine-shaped fixtures and the missing-key behaviour, which was exercised live.
  - DataForSEO results appear as findings, completeness and the visibility score. There is no dedicated rankings/backlinks view; the engine's PDF covers them.
- **PageSpeed was rate limited (HTTP 429) unkeyed** during testing. The 429 view was verified live, but successful keyed runs were verified only with fixtures matching `jevseo/psi.py`.
- **Progress is stage-level.** The engine logs no overall percentage, so the bar counts finished stages. In-stage counters are shown only where the engine logs them.
- **DNS rebinding gap.** The dashboard rejects hosts that resolve to private space before starting. The engine re-resolves at crawl time with its own guard, so a rebinding window between the two lookups cannot be closed without changing the engine.
- **Secrets on disk.** Keys are stored in plaintext in a mode-600 file, the same model as the engine's `.env`. There is no at-rest encryption.
- **Local single user.** There is no authentication. The server binds to 127.0.0.1, and Host/Origin checks block other sites.
- **Chromium on Ubuntu 20.04** may not install. Rendering then shows as unavailable, and standard crawling is unaffected.
- **One port.** The UI and API share :3000. The spec's :8000 backend does not exist, because no Python web server was added.

## Update: UI refresh (branch `ui-refresh`)

- Light, dark and system themes, each with its own tokens. Status colours meet contrast on both, and the remaining hard-coded colours were replaced with tokens.
- The sidebar can be resized by dragging (208–380 px), and dragging past the minimum collapses it to a 72 px rail. It also collapses on click or Ctrl+B, resets on double-click, and supports arrow keys on the handle. State persists in localStorage, transitions use spring animation, and the active item indicator slides between items.
- Motion (`motion` library):
  - page and tab transitions, cards that rise into view, count-up metrics;
  - an animated score gauge with a glow, animated chart bars and areas, a sliding tab indicator;
  - spring-animated progress bars and stage icons, animated recommendation expansion, blurred overlays behind drawers and dialogs.
  - All of it respects `prefers-reduced-motion`.
- PageSpeed rate limits: Settings → **Verify** checks a PageSpeed or DataForSEO key with one live request. It was tested against Google's real API with an invalid key and returned "invalid". The Performance tab now gives step-by-step instructions for getting a key.
- The Next.js dev badge is disabled (`devIndicators: false`) because it covered the sidebar collapse button.
- Tests: 97/97 (added sidebar resize/collapse/keyboard tests and verify-endpoint tests). Typecheck, lint and production build are clean. A real-browser check covered drag-resize (256 → 340 px), drag-to-collapse, expand on click, scroll-reveal, mobile drawer, and no console errors.

## Remaining tasks

- Push to `MBN4/jev-seo-dashboard` once the empty repository exists.
- Optional future work: a DataForSEO data view, and comparing two audits of the same domain.
