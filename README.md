# Rankora — SEO audit dashboard

A local web dashboard for SEO audits, built on the open-source [jev-seo](https://github.com/agricidaniel/jev-seo) audit engine (MIT). Start audits from the browser, watch the engine's real progress, explore findings, pages, AI judgments and Core Web Vitals, track fixes, and download the engine's own PDF, Excel and Markdown reports.

**The engine is not modified.** The dashboard runs the unchanged `jevseo` CLI as a subprocess and reads the `audit.json` it writes. The 52 rules, scoring and report generators are exactly the engine's own, and the CLI keeps working on its own.

```
Browser ──► Next.js (UI + /api routes, port 3000) ──spawn──► python -m jevseo run … (your engine venv)
                     │                                                    │
                     └──────── reads ◄── jev-seo-reports/<domain>-<stamp>/audit.json, report.pdf/.xlsx/.md
```

## Features

- **Overview dashboard:** the latest audit's score, grade and completeness, severity and category charts, score history (from saved audits only), crawl statistics and recent audits.
- **Count pages:** before an audit, reads the site's robots.txt and XML sitemaps (sitemap indexes and `.gz` included, no crawl) to report how many pages it has. One click sets the crawl limit, up to 2,000 pages. Audits that hit their page limit show a banner with a one-click re-run at a higher limit.
- **New audit:** URL validation in the browser and on the server, including the SSRF guard. Every option maps to a real engine flag: max pages and depth, time budget, JS rendering, AI judgments, PageSpeed, DataForSEO and formats, plus optional focus keywords. A summary shows missing dependencies, and paid mode needs explicit confirmation.
- **Live progress:** Server-Sent Events from the engine's own `== n/7` stage lines and counters (URLs crawled, pages judged, PageSpeed runs), plus warnings, errors, the engine log and cancellation. Progress survives page reloads and dashboard restarts.
- **Results workspace:** Overview, Technical SEO (filters, search, sort, pagination, detail drawer), Pages (sortable table and lazy-loaded page analysis), AI Content (real AI answers only), Performance (mobile and desktop, with 429 and missing data shown as such), Recommendations (status and notes stored separately from audit data) and Reports.
- **Extra checks:** 31 dashboard-side checks on the saved crawl data, beyond the engine's 52 rules. They are reported separately and never change the engine's score.
  - Rank Math-style focus-keyword placement: title, H1, URL, meta, intro and density.
  - E-E-A-T and trust signals: About, Contact, privacy and terms pages, authors and dates on articles, Organization schema with sameAs.
  - URL structure, Breadcrumb and Article schema coverage, internal linking, readability, keyword stuffing, image lazy loading and social cards.
  - A list of what cannot be checked from crawl data.
- **History:** search, status and date filters, sorting, pagination, and removal from history that never deletes files. Existing folders in `jev-seo-reports/`, such as an InboxWarm audit, are picked up automatically.
- **Reports center:** original engine files with secure downloads and in-browser PDF preview.
- **Settings:** write-only, masked API keys (stored in `data/secrets.env`, mode 600) with a **Verify** button for PageSpeed and DataForSEO (one live test request), audit defaults, and system diagnostics (engine `doctor`, Python, Playwright/Chromium, directories, keys).
- **Interface:** light, dark and system themes, and a sidebar you can drag to resize, click (or press Ctrl+B) to collapse to an icon rail, and double-click to reset. Smooth motion (page transitions, animated score gauge, count-up metrics, animated charts) automatically switches off when the OS asks for reduced motion.

## Quick start (Ubuntu 20.04+)

```bash
# 1. engine (skip if you already have it with a working venv)
git clone https://github.com/agricidaniel/jev-seo ~/jev-seo
cd ~/jev-seo && uv venv .venv -p 3.12 && uv pip install -p .venv/bin/python -r requirements.txt

# 2. dashboard
git clone https://github.com/MBN4/jev-seo-dashboard ~/jev-seo-dashboard
cd ~/jev-seo-dashboard
echo "JEVSEO_DIR=$HOME/jev-seo" > .env.local
./start.sh            # first run installs and builds, then serves http://localhost:3000
```

Open **http://localhost:3000**, go to **New Audit**, enter a URL and press **Start audit**.

| What | Where |
| --- | --- |
| Dashboard | http://localhost:3000 |
| API | http://localhost:3000/api (for example `/api/system/health`) |
| Development mode | `./start.sh --dev` |

Full instructions: [docs/INSTALLATION.md](docs/INSTALLATION.md). Using the app: [docs/USER_GUIDE.md](docs/USER_GUIDE.md). Internals: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Endpoints: [docs/API.md](docs/API.md).

## Branding

The product name and tagline come from `lib/brand.ts`. To change them without editing code, add these lines to `.env.local` and rebuild (`npm run build`):

```
NEXT_PUBLIC_BRAND_NAME=Your Name
NEXT_PUBLIC_BRAND_TAGLINE=SEO audit workspace
```

The logo is a lettermark built from the name's initials. The PDF, Excel and Markdown reports are produced by the engine and keep the engine's own design.

## Configuration

`.env.local` (see `.env.example`):

| Variable | Default | Purpose |
| --- | --- | --- |
| `JEVSEO_DIR` | `../jev-seo` | Engine checkout |
| `JEVSEO_PYTHON` | `$JEVSEO_DIR/.venv/bin/python` | Interpreter with the engine requirements |
| `JEVSEO_REPORTS_DIR` | `$JEVSEO_DIR/jev-seo-reports` | Audit folders (same place the CLI writes) |
| `JEVSEO_DATA_DIR` | `./data` | Dashboard state, secrets, job logs |
| `JEVSEO_MAX_CONCURRENT` | `1` | Simultaneous audits (max 4) |
| `JEVSEO_MAX_AUDIT_SECONDS` | `3600` | Hard limit per audit process |
| `JEVSEO_ALLOWED_HOSTS` | (localhost only) | Extra hostnames allowed to reach the dashboard |

API keys (`TYPESAFE_API_KEY`, `PAGESPEED_API_KEY`, `DATAFORSEO_USERNAME`, `DATAFORSEO_PASSWORD`) are set in **Settings → API keys**. Keys already present in the engine's `.env` or your environment are detected and used. Every key is optional:

- Without the TypeSafe key, the audit is marked partial.
- Without a PageSpeed key, runs are unkeyed and often rate limited.
- DataForSEO keys are needed only for paid full mode.

## Development

```bash
npm run dev        # http://127.0.0.1:3000 with hot reload
npm test           # 91 Vitest tests: backend routes/services + React components
npm run typecheck && npm run lint && npm run build
```

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `jev-seo engine not found` | Set `JEVSEO_DIR` in `.env.local`. |
| `Engine Python … missing packages` | `$JEVSEO_DIR/.venv/bin/python -m pip install -r $JEVSEO_DIR/requirements.txt` |
| Performance shows "Rate limited (HTTP 429)" | Google's unkeyed quota is shared by everyone. Create a free key (Google Cloud Console → enable *PageSpeed Insights API* → Credentials → API key), paste it in Settings → API keys, press **Verify**, then re-run the audit. |
| AI Content says "not available" | Add `TYPESAFE_API_KEY` in Settings and run a new audit. |
| Chromium unavailable (Ubuntu 20.04) | Optional. Crawling works without it; JavaScript-only pages are read as raw HTML. |
| "Only 1 audit(s) can run at once" | Wait, cancel the running audit, or raise `JEVSEO_MAX_CONCURRENT`. |
| Audit shows "Interrupted" | The engine process stopped while the dashboard was down. Start a new audit. |
| 403 "Host not allowed" | Open the dashboard via `localhost`, or add your hostname to `JEVSEO_ALLOWED_HOSTS`. |

Settings → Diagnostics runs all of these checks and suggests the fix.
