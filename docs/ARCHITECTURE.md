# Architecture

```
┌──────────────────────────── Browser ─────────────────────────────┐
│ Next.js App Router pages (React, Tailwind, shadcn/ui, Recharts,   │
│ TanStack Table, React Hook Form + Zod, motion)                    │
│   └─ lib/api.ts typed client ── fetch / EventSource ──┐           │
└────────────────────────────────────────────────────────┼──────────┘
                                                         ▼
┌──────────────────── Rankora server (Node, :3000) ─────────────────┐
│ middleware.ts        Host allow-list + cross-site write refusal   │
│ instrumentation.ts   on start: unpack seed audits, start scheduler │
│ app/api/**           route handlers (Zod validation, uniform errors)
│ lib/server/                                                       │
│   url-guard.ts       URL syntax + DNS + private/metadata blocks   │
│   jobs.ts            spawn engine (argv array, own process group),│
│                      log to file, cancel, timeout, restart recovery
│   engine-adapter.ts  engine audit.json -> Rankora model           │
│   audits.ts          discover audits, parse with byte-budget LRU, │
│                      summaries persisted to data/summaries.json   │
│   results.ts         paginated projections per view               │
│   checklist.ts       Google guidelines checklist grading          │
│   finding-breakdown.ts  plain-language "exactly where" per finding│
│   explorer.ts        Site Explorer tabs / filters / CSV           │
│   extra-checks.ts    31 extra checks (memoised per audit)         │
│   branding.ts        branded report copies (scripts/brand_report.py)
│   site-size.ts       page count from robots.txt + sitemaps        │
│   progress.ts        live snapshot from the engine log            │
│   monitor.ts         scheduled audits, change checks, event feed  │
│   audit-diff.ts      what changed between two audits              │
│   gsc.ts             Search Console: key, token, sync, snapshots  │
│   history.ts         daily compact reports per site (kept forever)│
│   state.ts, secrets.ts, diagnostics.ts, seeds.ts, verify.ts       │
└───────────┬───────────────────────────────────────▲───────────────┘
            │ spawn: <engine python> -m <engine> run │ read
            ▼                                        │
┌──────── audit engine (open source, unmodified) ────┴──┐
│ crawl → 52 rules → DataForSEO → AI → PageSpeed        │──► <reports>/<site>-<date>/
│ → scoring → render (PDF / XLSX / MD)                  │     audit.json, report.*
└───────────────────────────────────────────────────────┘
```

## The engine boundary

The engine is a Python CLI with no web API. Rankora treats it as a black box with a small, documented interface, kept in two files:

- **`lib/engine-protocol.ts`** holds the engine's command name, log line format, CLI flags and raw data key names. It is the only place those appear.
- **`lib/server/engine-adapter.ts`** translates each raw `audit.json` into Rankora's model when the file is loaded, in memory only:
  - the AI block becomes `ai`;
  - AI check IDs get the `ai_` prefix;
  - action IDs become `RK-001`;
  - engine-written explanations are reworded so the upstream name never appears in the UI.

Replacing the engine with your own later means re-implementing that contract (the same CLI arguments and the same `audit.json` shape) or changing those two files.

| Engine behaviour | How Rankora uses it |
| --- | --- |
| `run` = crawl, check, judge, score, render | One subprocess per audit. Every New Audit option maps to one flag (`engineArgs()` in `lib/server/jobs.ts`). |
| Progress lines `[<engine> mm:ss] == n/7 Stage` | Parsed by `lib/progress.ts` into stage states, measured counters and grouped notices. |
| Output folder `<host>-<YYYY-MM-DD-HHMM>` | Rankora passes `--out` with the same naming and never reuses a folder. The folder name is the audit ID. |
| Keys from env, then its own `.env` files | Keys saved in Rankora are injected as environment variables (highest priority). |
| `doctor` prints JSON | Reused for Settings → Diagnostics. |

## Audit lifecycle

1. `POST /api/audits` validates the request and merges the saved defaults.
2. The URL is checked for syntax and its DNS is resolved; every address must be public.
3. Paid mode needs confirmation and keys. With no AI key, the AI stage is switched off up front.
4. The concurrency and duplicate checks run.
5. `startJob` writes `data/jobs/<id>/job.json` and spawns the engine detached in its own process group, appending its output to `engine.log`.
6. Progress is served by `GET /events` (SSE, every second) or by polling `GET /progress`.
7. The exit code decides **completed**, **failed** or **cancelled**. On completion, the branded reports are built in the background.
8. Cancel sends `SIGTERM` to the process group, then `SIGKILL` after 5 s.
9. Restart recovery: a running job whose process is gone is resolved from what is on disk. A process that is still alive keeps streaming from its log.

## Storage (files only)

| Location | Content |
| --- | --- |
| `<reports>/<id>/` | Engine output. Source of truth, never modified by Rankora. |
| `data/state.json` | Hidden audit IDs, recommendation status and notes, focus keywords, audit defaults |
| `data/secrets.env` | API keys (mode 600, never returned by the API) |
| `data/jobs/<id>/` | Job metadata and raw engine log |
| `data/branded/<id>/` | Branded report copies, rebuilt when the source or brand changes |
| `data/history/<site>/` | One compact report per day (issues with pages, score), Search Console daily numbers |
| `data/gsc/` | Search Console service account key (mode 600) and one snapshot per site |
| `data/monitor.json`, `data/monitor/` | Monitored sites, change feed, last sitemap URL list per site |
| `data/summaries.json` | Audit list summaries, reused while `audit.json` is unchanged |
| `seed/*.tar.xz` | Bundled audits of your sites, unpacked on first start |

## Branded reports

`scripts/brand_report.py` runs with the engine's Python, which already has WeasyPrint. It builds the branded copies from the engine's originals:

- **Branding:** it rewrites upstream names in visible text and changes action IDs to `RK-`.
- **Colours:** it rotates the magenta palette to the brand green by changing hue and keeping lightness. This covers CSS, the inline SVG charts, spreadsheet colours and embedded PNGs.
- **PDF:** it re-renders the PDF from the engine's `report.html`.

Each format is independent: if one fails, the others are still produced, and an unbranded original is never served in its place.

## Performance on large sites

A 1,620-page audit is about 119 MB of JSON. Rankora handles it as follows:

- Parsed audits are cached within a memory budget (`RANKORA_AUDIT_CACHE_MB`).
- The audit list uses the summaries saved in `data/summaries.json`.
- Extra checks and Site Explorer rows are computed once per parsed audit.
- Every list endpoint is paginated.

Measured on the 1,620-page audit (warm cache): History in 15 ms, the Google checklist in 15 ms, an explorer filter in 24 ms.

## Monitoring

`lib/server/monitor.ts` runs a scheduler pass every minute inside the Rankora server process. Each pass does three things:

1. **Reports new audits.** Each new completed audit of a monitored site becomes an event with a `diffAudits()` comparison against the previous completed audit.
2. **Checks for changes.** Every 3 hours per site, it reads the homepage tags and the sitemap URL list through the same guarded client as **Count pages**. Differences become a `change` event, and an audit then runs within 3 hours of the previous one.
3. **Starts one due audit.** This happens only when the concurrency limit allows. It goes through the normal `createAudit()` path, so validation, duplicate checks and keyless-stage handling are identical to a manual audit. The crawl limit comes from the latest sitemap count.

When Rankora was closed at the due time, the next pass starts the overdue audit.

## Search Console

`lib/server/gsc.ts` signs a service account JWT with Node's crypto module and exchanges it at Google's fixed token endpoint. The key file's own `token_uri` is ignored. The access token is cached for its lifetime.

Each daily sync makes about 30 Search Analytics requests and up to 50 URL Inspection requests per site, well within Google's quotas (URL Inspection allows 2,000 per property per day). The scheduler syncs one site per pass, and failed syncs retry after 6 hours.

The sync stores `data/gsc/<domain>.json`. `lib/gsc-insights.ts` derives totals, opportunities, the indexing summary and alerts from that file. The alert IDs are stable, so monitoring reports each problem once.

## Progress history

On each scheduler pass, a new completed audit of a monitored site is turned into a daily record (`lib/server/history.ts`). Audits already on disk are backfilled one per pass. If two audits finish on the same day, the later one is kept and the earlier is remembered as superseded, so it is never reloaded.

`lib/issue-progress.ts` walks the records in date order to derive:

- what was fixed, new, worse or better;
- how long each issue has been open;
- reopened issues;
- page-level fixes;
- the timeline and the fix log.

Priority and owner come from `lib/priorities.ts`. Optional retention (`keepAuditDays`) only deletes full folders of scheduler-started audits that already have a record, never the two newest per site.
