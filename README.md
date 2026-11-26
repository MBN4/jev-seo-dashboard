# Rankora

**Rankora is a local SEO audit workspace.** Audit any public website from your browser, see exactly which of Google's guidelines it meets and which it breaks, explore every crawled URL to find what is missing, track fixes, and download branded PDF, Excel and Markdown reports.

```
Browser ──► Rankora (Next.js UI + API, port 3000) ──runs──► audit engine (Python, separate process)
                     │                                              │
                     └───── reads ◄── reports folder: <site>-<date>/audit.json + report files
```

Rankora drives an open-source audit engine (credited in [NOTICE.md](NOTICE.md)) as an unmodified separate process, and adds everything around it: the interface, the Google checklist, the Site Explorer, 31 extra checks, branded reports, history and settings.

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
- **Reports:** Rankora-branded PDF, Excel, Markdown and JSON, with an in-browser PDF preview.

## Monitoring (automatic daily audits)

The four sites (emailverify.io, clustox.com, mycoldinbox.com, inboxwarm.ai) are monitored from the first start. You can add more on the **Monitoring** page.

- **Daily audits:** each site is re-audited every 24 hours. You can change this to 6 hours, 12 hours, 2 days or a week, pause a site, or press **Run now**. The crawl limit is set from the site's current sitemap size, up to 2,000 pages.
- **Change checks between audits:** every 3 hours, Rankora reads each homepage's title, description, H1, canonical and robots tag, plus the sitemap's URL list (no crawl). New or removed pages and homepage edits are reported straight away, and an audit runs within 3 hours of the last one.
- **What changed:** every new audit is compared with the previous one. You see the score change, new problems, issues that got worse, fixed and improved issues, and pages that broke, changed title or description, became noindex, or are new. A "still to fix" list puts the most important item first and marks anything that is probably intended.
- **Notifications:** a bell in the header counts unread changes, and a toast appears when one arrives.
- Scheduling runs inside Rankora, so it needs Rankora to be running (`./start.sh`). Missed audits start within a minute of the next start. Your own audits are never interrupted: scheduled ones wait for a free slot. Set `RANKORA_MONITOR=0` to turn monitoring off.

## Before and during an audit

- **Your sites and automatic page count:** pick one of your sites from the **Your sites** menu, or type any URL. Rankora reads its sitemaps (no crawl), counts the pages, and sets the crawl limit and time budget to match automatically, up to 2,000 pages.
- **Live progress:** the engine's real stages, URLs crawled, pages judged and PageSpeed runs. Warnings are grouped by cause, each with its fix, so six rate-limited requests are one notice, not six.
- **No keyless warnings:** AI judgments stay off until a key is added, and PageSpeed is off by default without one.
- **Your sites:** audits of emailverify.io, clustox.com, mycoldinbox.com and inboxwarm.ai ship with Rankora and appear on first start. The New Audit placeholder rotates through them. The list is in `lib/brand.ts`.

## Interface

Light, dark and system themes. The sidebar can be resized by dragging and collapsed with a click or **Ctrl+B**. Motion is smooth and switches off automatically when your system asks for reduced motion. The layout is responsive down to phone size.

## Quick start (Ubuntu 20.04+)

You need the audit engine with its Python environment (see [docs/INSTALLATION.md](docs/INSTALLATION.md)) and Node.js 18.18 or newer. Then:

```bash
git clone https://github.com/MBN4/rankora ~/rankora
cd ~/rankora
echo "RANKORA_ENGINE_DIR=$HOME/path/to/engine" > .env.local
./start.sh
```

Open **http://localhost:3000**. `start.sh` installs dependencies and rebuilds only when something changed (for example after `git pull`).

| What | Where |
| --- | --- |
| App | http://localhost:3000 |
| API | http://localhost:3000/api (for example `/api/system/health`) |
| Development mode | `./start.sh --dev` |

More detail: [Everything Rankora checks](docs/CHECKS.md) · [Installation](docs/INSTALLATION.md) · [User guide](docs/USER_GUIDE.md) · [Architecture](docs/ARCHITECTURE.md) · [API](docs/API.md)

## Configuration

`.env.local` (see `.env.example`). Older `JEVSEO_*` names for the same settings still work.

| Variable | Default | Purpose |
| --- | --- | --- |
| `RANKORA_ENGINE_DIR` | `../jev-seo` | Audit engine folder |
| `RANKORA_ENGINE_PYTHON` | `<engine>/.venv/bin/python` | Python with the engine's requirements (a path, or a command such as `python3`) |
| `RANKORA_REPORTS_DIR` | the engine's output folder | Where audit folders live |
| `RANKORA_DATA_DIR` | `./data` | Rankora state, secrets, job logs, branded reports |
| `RANKORA_MAX_CONCURRENT` | `1` | Simultaneous audits (max 4) |
| `RANKORA_MAX_AUDIT_SECONDS` | `7200` | Hard limit per audit process |
| `RANKORA_ALLOWED_HOSTS` | localhost only | Extra hostnames allowed to reach the app |
| `RANKORA_AUDIT_CACHE_MB` | `350` | Memory budget for parsed audits (large crawls are 100+ MB) |
| `RANKORA_MONITOR` | on | `0` turns off scheduled audits and change checks |
| `NEXT_PUBLIC_BRAND_NAME` / `NEXT_PUBLIC_BRAND_TAGLINE` | `Rankora` / `SEO audit workspace` | Product name and tagline (rebuild after changing) |

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
| "Audit engine not found" | Set `RANKORA_ENGINE_DIR` in `.env.local`. |
| "Engine Python … missing packages" | `<engine>/.venv/bin/python -m pip install -r <engine>/requirements.txt` |
| Performance shows "rate limited (HTTP 429)" | Add a free `PAGESPEED_API_KEY` in Settings, press **Verify**, re-run the audit. |
| Branded PDF "could not be prepared" | The engine Python needs WeasyPrint (it is in the engine's requirements). Check Settings → Diagnostics. |
| "Only 1 audit can run at once" | Wait, cancel the running audit, or raise `RANKORA_MAX_CONCURRENT`. |
| Audit shows "Interrupted" | The engine process stopped while Rankora was down. Start a new audit. |
| 403 "Host not allowed" | Open the app via `localhost`, or add your hostname to `RANKORA_ALLOWED_HOSTS`. |

Settings → Diagnostics runs these checks and suggests the fix.
