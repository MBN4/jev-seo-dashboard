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

## Update: extra checks layer and rebrand (branch `extra-checks-rebrand`, built on `ui-refresh`)

- **Extra checks** (`lib/server/extra-checks.ts`): 31 checks computed in the dashboard from the saved `audit.json`. The engine is unchanged, and so is its score.
  - **Focus keywords (Rank Math style):** each keyword is matched to its best page (light plural stemming), then checked in the title, H1, URL, meta description and opening text, plus density (stuffing), thin target page and "no page mentions it".
  - **Without keywords:** title/H1 mismatch and single-word stuffing.
  - **URLs:** uppercase, underscores, long, query parameters.
  - **E-E-A-T and trust:** About, Contact, privacy, terms, contact details; author and dates on articles; Organization schema and sameAs.
  - **Schema coverage:** BreadcrumbList on deeper pages, Article markup on articles.
  - **Links:** few internal links, single inlink, articles that cite no external sources.
  - **Other:** readability (Flesch, English), image lazy loading, X card.
  - Each check carries a Google Search Central link, or is labelled *heuristic* when it is a plugin convention rather than a documented Google rule.
  - The tab also lists what cannot be checked from crawl data (image formats, compression, freshness values, interstitials, Search Console data, backlinks, Google Business Profile).
- **Keywords:** an optional field on New Audit, editable afterwards on the Extra Checks tab (including imported audits). They are stored in `data/state.json`, never sent to the engine. API: `GET /api/audits/{id}/extra`, `GET/PUT /api/audits/{id}/keywords`.
- **Rebrand:** the product is named **Rankora** (placeholder). The name and tagline live in `lib/brand.ts` and can be overridden with `NEXT_PUBLIC_BRAND_NAME` / `NEXT_PUBLIC_BRAND_TAGLINE`. The logo is a lettermark built from the initials. The AI feature is called "AI judgments", and engine log text is shown with neutral wording (it is parsed before rewording, so the progress counters still work).
  - Not renamed, on purpose: the internal `JEVSEO_*` environment variables (renaming them would break existing `.env.local` files), and the PDF/XLSX/MD reports, which the engine generates.
- **Tests:** 112/112, adding 13 extra-check tests (each check fires and passes on crafted pages, keyword API validation) plus component tests for the tab, the keyword field and branding. Typecheck, lint and build are clean. Verified in a real browser against the python.org audit with 4 keywords in light and dark mode; there were no console errors.

## Update: page counting and larger crawls

- **Count pages** (New Audit) via `POST /api/site-size`: robots.txt → declared sitemaps (or `/sitemap.xml`, `/sitemap_index.xml`, `/wp-sitemap.xml`) → sitemap indexes → gzipped sitemaps, counting unique same-site URLs. Falls back to the homepage's internal links as a lower bound. Every fetch and redirect hop passes the SSRF guard.
  - Verified live: clustox.com lists 732 URLs across 11 sitemap files (about 80 per language plus 312 blog posts). python.org has no sitemap, so the count falls back to 65 homepage links.
- **Crawl caps raised:** max pages 500 → 2,000, crawl time budget up to 5,400 s, hard process limit 7,200 s. Applying a count sets a matching time budget.
- **Page-limit banner** on the audit Overview, with a "Re-run with a higher limit" link that prefills New Audit (`?url=&maxPages=`).
- **Rebrand fix:** engine-written explanations (partial-audit reasons, score notes, finding titles and fixes) are reworded in memory, so "Jev" no longer appears in the UI. audit.json on disk is unchanged.
- **Tests:** 121/121 passing, including the sitemap parser, index and gzip handling, the same-site filter, blocking redirects into private networks, the homepage fallback, and the counter UI.

## Remaining tasks

- Push to `MBN4/jev-seo-dashboard` once the empty repository exists.
- Optional future work: a DataForSEO data view, and comparing two audits of the same domain.
