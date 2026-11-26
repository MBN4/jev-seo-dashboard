# AuditPilot

**AuditPilot is a local SEO audit workspace.** Audit any public website from your browser, see exactly which of Google's guidelines it meets and which it breaks, explore every crawled URL to find what is missing, track fixes, and download branded PDF, Excel and Markdown reports.

```
Browser ──► AuditPilot (Next.js UI + API, port 3000) ──runs──► audit engine (Python, separate process)
                     │                                              │
                     └───── reads ◄── reports folder: <site>-<date>/audit.json + report files
```

AuditPilot drives an open-source audit engine (credited in [NOTICE.md](NOTICE.md)) as an unmodified separate process, and adds everything around it: the interface, the Google checklist, the Site Explorer, 31 extra checks, branded reports, history and settings.

## What you get after an audit

- **Google guidelines checklist:** shown first. Every check is mapped to the Google Search Central guidance it comes from. The areas are:
  - crawling, indexing, titles and snippets, keywords
  - helpful content and E-E-A-T, links, images, structured data
  - page experience, international, spam policies, AI features, visibility

  Each rule is written in plain language and marked **Passed**, **Needs work**, **Not checked** (with the reason) or **Manual check**. Each failure shows what was found, how to fix it, the affected URLs and a link to Google's own page.
- **Site Explorer:** a spreadsheet-style view of every crawled URL, in the style of a desktop crawler.
  - Tabs: Response codes, Page titles, Meta description, H1, H2, Images, Canonicals, Directives, Links, Structured data, Content, Security, Hreflang, Social.
  - Filters such as *Missing*, *Duplicate*, *Over 60 characters* and *Non-indexable*.
  - An **Issues** view that ranks everything missing across all tabs.
  - CSV export of any tab and filter.
- **Every issue comes with its fix:** each issue opens short. You see a verdict, the problem in one line and a **Do this** line. Below that:
  - **Exact changes:** which page, what to find, what to replace it with. A suggested target is given when the data shows one, for example where other links with the same text go, or a page whose title matches.
  - **Ready-to-paste code**, in Next.js, Express, nginx and Apache variants: redirects, host redirect, 404 handling, security headers, viewport, canonical, Open Graph and hreflang tags. Draft meta descriptions appear only when the page has real text to draft from.
  - **Copy for developer:** a Markdown task with the problem, the changes and the code, for a Bitbucket issue or a task tool. The next daily audit confirms the fix.
- **Every warning explained:** open any finding to see, in plain words, everything below. Findings open from Technical SEO, Recommendations and Monitoring, and the explanation also shows inline when you expand a rule in the Google checklist.
  - what was found and why it matters;
  - numbered steps to fix it;
  - exactly where it occurs. Broken links are grouped by the broken address, with every page that links to it and the link text. Redirects show the address to link to instead, and redirect chains show each hop.
  - Every address is clickable, and **Inspect** opens that page's full details. Copy and CSV buttons cover all affected pages.
  - A verdict says whether to act: **Fix soon**, **Worth fixing**, **Nice to have**, or **Probably intended: no action needed**. For example, noindex on page 2+ of archives, author pages and legal pages is recognised as intended, and those rules no longer look like failures in the Google checklist.
  - Common causes are recognised and explained, such as Cloudflare email protection, Markdown pasted into a link, stray quote characters in an href, tracking pixels without alt text, and pagination sharing a title.
- **Overview:** the score and grade, completeness, severity and category charts, the most important fixes, and score history across audits.
- **Technical SEO, Pages, AI Content, Performance:** every finding with its evidence and fix, page-by-page analysis, AI content judgments (with a key), and Core Web Vitals (with a PageSpeed key).
- **Extra Checks:** 31 more checks on the crawl data.
  - Focus-keyword placement in the Rank Math style.
  - E-E-A-T signals: About, Contact, privacy and terms pages, authors, dates, Organization schema.
  - URL structure, breadcrumb and article schema, internal linking, readability, keyword stuffing, lazy loading.
- **Recommendations:** ranked actions with your own status and notes.
- **Reports:** AuditPilot-branded PDF, Excel, Markdown and JSON, with an in-browser PDF preview.

## Monitoring (automatic daily audits)

The five sites (emailverify.io, clustox.com, mycoldinbox.com, inboxwarm.ai, tellbear.com) are monitored from the first start. You can add more on the **Monitoring** page.

- **Daily audits:** each site is re-audited every 24 hours. You can change this to 6 hours, 12 hours, 2 days or a week, pause a site, or press **Run now**. The crawl limit is set from the site's current sitemap size, up to 2,000 pages.
- **Change checks between audits:** every 3 hours, AuditPilot reads each homepage's title, description, H1, canonical and robots tag, plus the sitemap's URL list (no crawl). New or removed pages and homepage edits are reported straight away, and an audit runs within 3 hours of the last one.
- **What changed:** every new audit is compared with the previous one. You see the score change, new problems, issues that got worse, fixed and improved issues, and pages that broke, changed title or description, became noindex, or are new. A "still to fix" list puts the most important item first and marks anything that is probably intended.
- **Notifications:** a bell in the header counts unread changes, and a toast appears when one arrives.
- Scheduling runs inside AuditPilot, so it needs AuditPilot to be running (`./start.sh`). Missed audits start within a minute of the next start. Your own audits are never interrupted: scheduled ones wait for a free slot. Set `AUDITPILOT_MONITOR=0` to turn monitoring off.

## Progress (stored daily)

Every daily audit is stored as a compact report in `data/history/<site>/<date>.json`. Each report holds every open issue with its affected pages, the score and, when connected, the day's Search Console numbers. The reports are kept forever (a few hundred KB each). The **Progress** page compares each report with the previous one:

- **Since the last report:** what was fixed, what is new, what got worse or better, and which pages inside an open issue were fixed or newly affected.
- **Still to fix:** sorted by priority (P0 critical, P1 high, P2 important, weekly) and then by how long each issue has been open. Each issue has an owner role (Dev, SEO, Content), a page-count trend, and a flag when it came back after a fix. You can filter by owner.
- **Over time:** a chart of open issues by priority with the score, a fix log of every resolved issue, and Search Console clicks per day.
- **Download report:** a Markdown progress report to share or paste into a task tool.
- **Storage:** full audit files can be large (100 MB or more for a big site). You can let AuditPilot clean up scheduled audits older than 14 to 365 days. Your own audits, the two newest per site and the daily history are never removed. This is off by default.

Priorities and owners for every check live in `lib/priorities.ts`, generated from [docs/COMBINED_LIST.md](docs/COMBINED_LIST.md). Findings the data shows are intentional, such as noindex on pagination or legal pages, are not counted as open.

## Google Search Console

Connect Search Console once, in **Settings → Search Console**. AuditPilot then syncs each monitored site every day. It is read-only and never changes anything in Search Console. The **Search Console** page shows:

- **Traffic:** clicks, impressions, CTR and average position, each compared with the previous 7, 28 or 90 days, plus a chart of up to 16 months.
- **Breakdowns:** queries, pages, countries, devices, search appearance and search type (web, image, video, news, Discover).
- **Opportunities:**
  - searches ranking in positions 4–20;
  - page-1 results with low CTR (against an estimated benchmark);
  - losing and rising queries and pages;
  - new queries;
  - several of your pages competing for the same search.
- **Index status from Google's URL Inspection:** covers the homepage and top pages. Shows indexed or not and why, last crawl, Google's chosen canonical against yours, and rich result issues.
- **Sitemap status:** errors and warnings as Google reports them.
- **Alerts in Monitoring and the bell:** clicks down 20% or more week on week (50% or more is P0), impressions down 30% or more, a page dropping out of the index, important pages not indexed, sitemap errors, canonical mismatches and rich result errors. Each problem is reported once.
- **Page details:** the page panel inside an audit gets a **Google Search** tab with that page's clicks, top searches and index status.

**Setup (about 5 minutes):** in Google Cloud, create a project, enable *Google Search Console API*, create a service account and download a JSON key. Paste the key in Settings, then add the service account's email as a user (Restricted is enough) on each Search Console property. Press **Test connection**. The key is stored in `data/gsc/service-account.json` (mode 600) and is never returned by the API.

Google's API does not provide the Page indexing totals, Core Web Vitals, Links, Manual actions or Security issues reports, so those stay in Search Console itself. Traffic from other channels needs Google Analytics.

## Before and during an audit

- **Your sites and automatic page count:** pick one of your sites from the **Your sites** menu, or type any URL. AuditPilot reads its sitemaps (no crawl), counts the pages, and sets the crawl limit and time budget to match automatically, up to 2,000 pages.
- **Live progress:** the engine's real stages, URLs crawled, pages judged and PageSpeed runs. Warnings are grouped by cause, each with its fix, so six rate-limited requests are one notice, not six.
- **No keyless warnings:** AI judgments stay off until a key is added, and PageSpeed is off by default without one.
- **Your sites:** audits of emailverify.io, clustox.com, mycoldinbox.com and inboxwarm.ai ship with AuditPilot and appear on first start. The New Audit placeholder rotates through them. The list is in `lib/brand.ts`.

## Interface

Light, dark and system themes. The sidebar can be resized by dragging and collapsed with a click or **Ctrl+B**. Motion is smooth and switches off automatically when your system asks for reduced motion. The layout is responsive down to phone size.

## Quick start (Ubuntu 20.04+)

You need the audit engine with its Python environment (see [docs/INSTALLATION.md](docs/INSTALLATION.md)) and Node.js 18.18 or newer. Then:

```bash
git clone https://github.com/MBN4/auditpilot ~/auditpilot
cd ~/auditpilot
echo "AUDITPILOT_ENGINE_DIR=$HOME/path/to/engine" > .env.local
./start.sh
```

Open **http://localhost:3000**. `start.sh` installs dependencies and rebuilds only when something changed (for example after `git pull`).

| What | Where |
| --- | --- |
| App | http://localhost:3000 |
| API | http://localhost:3000/api (for example `/api/system/health`) |
| Development mode | `./start.sh --dev` |

More detail: [Combined list](docs/COMBINED_LIST.md) · [Daily priority issues](docs/PRIORITY_ISSUES.md) · [Everything AuditPilot checks](docs/CHECKS.md) · [Installation](docs/INSTALLATION.md) · [User guide](docs/USER_GUIDE.md) · [Architecture](docs/ARCHITECTURE.md) · [API](docs/API.md)

## Configuration

`.env.local` (see `.env.example`). Older `JEVSEO_*` names for the same settings still work.

| Variable | Default | Purpose |
| --- | --- | --- |
| `AUDITPILOT_ENGINE_DIR` | `../jev-seo` | Audit engine folder |
| `AUDITPILOT_ENGINE_PYTHON` | `<engine>/.venv/bin/python` | Python with the engine's requirements (a path, or a command such as `python3`) |
| `AUDITPILOT_REPORTS_DIR` | the engine's output folder | Where audit folders live |
| `AUDITPILOT_DATA_DIR` | `./data` | AuditPilot state, secrets, job logs, branded reports |
| `AUDITPILOT_MAX_CONCURRENT` | `1` | Simultaneous audits (max 4) |
| `AUDITPILOT_MAX_AUDIT_SECONDS` | `7200` | Hard limit per audit process |
| `AUDITPILOT_ALLOWED_HOSTS` | localhost only | Extra hostnames allowed to reach the app |
| `AUDITPILOT_AUDIT_CACHE_MB` | `350` | Memory budget for parsed audits (large crawls are 100+ MB) |
| `AUDITPILOT_MONITOR` | on | `0` turns off scheduled audits, change checks and Search Console syncing |
| `AUDITPILOT_GSC_KEY_FILE` | `data/gsc/service-account.json` | Optional path to the Search Console service account key, instead of pasting it in Settings |
| `NEXT_PUBLIC_BRAND_NAME` / `NEXT_PUBLIC_BRAND_TAGLINE` | `AuditPilot` / `SEO audit workspace` | Product name and tagline (rebuild after changing) |

API keys are entered in **Settings → API keys**, and each one has a **Verify** button. All of them are optional:

| Key | Without it |
| --- | --- |
| `TYPESAFE_API_KEY` | AI judgments are off and the score is marked partial |
| `PAGESPEED_API_KEY` | No Core Web Vitals. Get a free key in Google Cloud Console (enable *PageSpeed Insights API*, then Credentials, then API key). |
| `DATAFORSEO_USERNAME` / `DATAFORSEO_PASSWORD` | No paid rankings and backlinks mode |

## Development

```bash
npm run dev      # hot reload on http://127.0.0.1:3000
npm test         # Vitest: API routes, services, checks, branding, components
npm run typecheck && npm run lint && npm run build
```

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| "Audit engine not found" | Set `AUDITPILOT_ENGINE_DIR` in `.env.local`. |
| "Engine Python … missing packages" | `<engine>/.venv/bin/python -m pip install -r <engine>/requirements.txt` |
| Performance shows "rate limited (HTTP 429)" | Add a free `PAGESPEED_API_KEY` in Settings, press **Verify**, re-run the audit. |
| Branded PDF "could not be prepared" | The engine Python needs WeasyPrint (it is in the engine's requirements). Check Settings → Diagnostics. |
| "Only 1 audit can run at once" | Wait, cancel the running audit, or raise `AUDITPILOT_MAX_CONCURRENT`. |
| Audit shows "Interrupted" | The engine process stopped while AuditPilot was down. Start a new audit. |
| 403 "Host not allowed" | Open the app via `localhost`, or add your hostname to `AUDITPILOT_ALLOWED_HOSTS`. |

Settings → Diagnostics runs these checks and suggests the fix.
