# Architecture

## Overview

```
┌──────────────────────── Browser ────────────────────────┐
│ Next.js App Router pages (React, Tailwind, shadcn/ui,   │
│ Recharts, TanStack Table, React Hook Form + Zod)        │
│   └─ lib/api.ts  typed client ──fetch/EventSource──┐    │
└────────────────────────────────────────────────────┼────┘
                                                     ▼
┌──────────────── Next.js server (Node, :3000) ───────────────────────────┐
│ middleware.ts   Host allow-list + cross-site write refusal (CSRF)       │
│ app/api/**      route handlers (validation with Zod, uniform errors)    │
│ lib/server/                                                             │
│   url-guard.ts   URL syntax + DNS resolution + private/metadata blocks  │
│   jobs.ts        spawn engine (argv array, no shell, own process group),│
│                  log to file, cancel, timeout, restart recovery         │
│   audits.ts      discover report folders, parse audit.json (LRU cache)  │
│   results.ts     paginated projections for each view                    │
│   progress.ts    snapshot = job + parsed engine log (paths redacted)    │
│   state.ts       data/state.json (history visibility, rec. status, …)   │
│   secrets.ts     data/secrets.env (600); status/mask only to clients    │
│   diagnostics.ts `jevseo doctor`, Chromium probe, directory checks      │
└───────────────┬─────────────────────────────────────────▲───────────────┘
                │ spawn: <venv>/python -m jevseo run URL   │ read
                │        --out <reports>/<id> --max-pages… │
                ▼                                          │
┌──────────── jev-seo engine (unchanged) ──────────┐       │
│ crawl → 52 rules → DataForSEO → AI   → PageSpeed  │       │
│ → scoring → render (PDF / XLSX / MD)             │───────┘ jev-seo-reports/<domain>-<stamp>/
└──────────────────────────────────────────────────┘          audit.json, digest.md, report.*
```

## Why Next.js only (no Python web server)

The engine is a CLI with no web API, and the brief was to build the frontend without changing the Python engine. The Node server therefore acts as a thin backend. It runs the same command a user would type, `python -m jevseo run`, and reads the same files. Nothing in the engine is re-implemented:

- Scores, grades, findings, actions, AI answers and PageSpeed data come straight from `audit.json`.
- Reports are the engine's own files, served unchanged.

## Engine integration

| Engine fact (from the source) | How the dashboard uses it |
| --- | --- |
| `jevseo/cli.py` `run` = `audit` + `render` | One subprocess per audit. |
| Flags `--max-pages --max-depth --time-budget --render --no-jev --jev-pages --jev-budget --no-psi --psi-pages --full --dfs-budget --location-code --language --formats --out` | Every New Audit option maps to exactly one flag (`engineArgs()` in `lib/server/jobs.ts`). |
| Default folder `jev-seo-reports/<host>-<YYYY-MM-DD-HHMM>` | The dashboard passes `--out` with the same naming and adds `-2`, `-3` instead of ever reusing a folder. The folder name is the audit ID. |
| Progress: `[jevseo mm:ss] == n/7 Stage: detail` on stderr | Parsed by `lib/progress.ts` into stage states and measured counters (`crawled x/y URLs`, `Jev: i/n pages judged`, `PageSpeed k/n`). |
| `bin/jevseo` uses `python3` from `PATH` | The dashboard calls the venv interpreter directly with `PYTHONPATH=<engine>`, so the right environment is always used. |
| Keys from env, then `$JEVSEO_ENV_FILE`, `./.env`, repo `.env`, `~/Desktop/Keys/.env` | Dashboard-stored keys are injected as env vars (highest priority). Other sources keep working. |
| `jevseo doctor` prints JSON | Reused for diagnostics. |
| The SSRF guard `public_host()` checks every redirect hop | The dashboard also checks before spawning (defence in depth). |

## Audit lifecycle

1. `POST /api/audits` validates the body with Zod and merges the saved defaults.
2. The URL goes through the syntax check and DNS resolution, and every address must be public.
3. Paid mode requires `confirmPaid` and DataForSEO keys.
4. The concurrency and duplicate checks run.
5. `startJob` creates `data/jobs/<id>/job.json` and `engine.log`, then spawns the engine detached in its own process group, with stdout and stderr appended to the log file and a minimal environment (PATH, HOME, proxy and CA variables, keys).
6. Progress: `GET /events` (SSE) re-reads the log every second and sends a snapshot when it changes. The browser falls back to polling `GET /progress`.
7. On exit, code 0 with `audit.json` present means **completed**. A non-zero code means **failed**, with the engine's last line (for example "Refusing to crawl …"). A cancel request means **cancelled**.
8. Cancel sends `SIGTERM` to the job's process group, then `SIGKILL` after 5 s. Only that audit is affected.
9. Restart recovery: on the next read, a "running" job whose PID is gone (or no longer a jevseo process) is resolved from disk. It becomes **completed** if all reports exist, otherwise **interrupted**. A job whose engine is still alive keeps streaming from its log file.
10. Results are read from the report folder. While a job runs, its half-written folder is never parsed.

## Storage (files only, by design)

| File | Content | Notes |
| --- | --- | --- |
| `<reports>/<id>/audit.json` etc. | Engine output | Source of truth; never written by the dashboard |
| `data/state.json` | `hidden` audit IDs, recommendation `{status, notes, updatedAt}` per audit and finding, audit defaults | Atomic writes (temp file + rename), serialized updates, corrupt files are backed up and reset |
| `data/secrets.env` | API keys | Mode 600, git-ignored, never returned by the API |
| `data/jobs/<id>/job.json`, `engine.log` | Job metadata and raw engine output | Used for progress and recovery |

SQLite was considered and declined in favour of files. Because the report folders are the history, any audit the CLI writes (including the existing InboxWarm folder) appears automatically with no import step and no risk of the index drifting from the files.

## Frontend

- `app/layout.tsx` wraps the app in `AppShell` (collapsible sidebar on desktop, a Sheet drawer on mobile, and a header with breadcrumbs, domain search, a live "Auditing …" indicator and settings).
- `app/audits/[id]/layout.tsx` loads the audit summary once, provides it through context, and renders the tab bar. Each tab fetches only its own projection.
- Sidebar analysis links stay scoped to the audit being viewed. Elsewhere they go to `/technical` etc., which redirect to the latest completed audit.
- Design tokens are in `app/globals.css`: a deep-slate sidebar, light workspace, green brand accent, and red/orange/amber/blue for severity, always paired with an icon and label.
</gr_insert>
<gr_insert after="1065" cat="add_content" conf="lo" orig="EOF">
