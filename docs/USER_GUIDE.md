# User guide

## Creating an audit

1. Open **New Audit**.
2. Enter the homepage URL. A bare domain works. Local, private and cloud-metadata addresses are refused.
3. Adjust the options:
   - **Maximum pages, depth and time budget** cap the crawl. The engine default is 60 pages.
   - **JavaScript rendering**: *Auto* renders only pages that need it. It requires Playwright and Chromium, and the form shows whether they are available.
   - **AI content evaluation (Jev)** needs `TYPESAFE_API_KEY` and costs about one cent per site, with a hard spend cap.
   - **PageSpeed Insights** works without a key, but Google often rate limits unkeyed requests (HTTP 429).
   - **Advanced analysis (DataForSEO)** is paid per call, needs credentials, and always asks for confirmation.
4. The **Audit summary** panel lists what will run and what is missing. Press **Start audit**.

## Monitoring progress

The progress page shows the engine's seven stages: crawl, rules, DataForSEO, Jev, PageSpeed, scoring and report generation.

- **Stage states**:
  - *done*: the stage finished.
  - *in progress*: the stage is running now.
  - *skipped*: turned off, or a key is missing.
  - *stopped*: the audit failed or was cancelled during this stage.
- **The bar** counts finished stages out of 7. It is not an estimate.
- **Counters** show live numbers logged by the engine: URLs crawled (out of *up to* the page cap), pages judged and PageSpeed runs.
- **Warnings and errors** include rate limits, missing keys and engine errors. The full engine log is at the bottom.

You can close the tab. The audit keeps running, and the header shows *Auditing <domain>*. **Cancel audit** stops only that audit.

## Understanding scores

The score (0–100) and grade (A ≥ 90, B ≥ 75, C ≥ 60, D ≥ 40, F) are the engine's own.

- **Completeness** shows how many of the nine weighted categories could be scored.
- **Partial audit** appears when Jev or PageSpeed was unavailable, so some categories could not be assessed.
- **Caps** (for example "Capped at 60: not reliably served over HTTPS") are engine rules that limit the score.
- **Category scores** list each category's weight and the engine's note, such as "Rules only".

## Understanding findings

**Technical SEO** lists every finding with its severity, rule ID, category, affected URLs, evidence and fix.

- Filter by severity, category or source (rules, Jev, DataForSEO), search, and sort.
- Click a finding to open the detail drawer, which lists all URLs, links to Google's guidance and shows impact and effort.
- **No issue detected** lists the rules that passed.

**Pages** lists every crawled URL with its status, indexability, H1, word count, depth and links. Click a row to see its metadata, heading outline, content, links (with their HTTP status), structured data, findings and Jev answers.

**AI Content** appears only when Jev ran. It shows Jev's typed answers per page, such as intent, helpfulness, specificity, trust and title/meta fit, with a confidence band:

- *Confident*: the answer is reliable.
- *Needs review*: Jev was undecided; check it yourself.

Jev returns probabilities, not prose, so each answer is explained by the engine's criterion text that it matched.

**Performance** separates mobile and desktop. Each run shows either Lighthouse lab metrics plus real-user Core Web Vitals, or the reason it has no data (rate limited, failed or skipped). Missing values are shown as unavailable, never as 0.

## Using recommendations

Recommendations are the engine's ranked actions:

- **Priority:** P1, P2 or P3.
- **Impact:** 0–100.
- **Effort:** 1–4.
- **Quick win:** high impact, low effort.

Set a status (*Pending*, *In progress* or *Completed*) and add notes. Both are saved in the dashboard (`data/state.json`), never in the audit data. Filter by status, priority or quick wins.

## Managing history

**Audit History** lists every audit: those launched here and any folder found in `jev-seo-reports/`, including ones made with the CLI. It supports searching by domain, filtering by status and date, sorting and paging.

- **Remove from history** hides the entry but **does not delete files**. Use *Restore all* to bring entries back.
- **Rescan reports folder** picks up folders added outside the dashboard.

## Downloading reports

Use an audit's **Reports** tab or the **Reports** page. The files are the engine's originals:

- PDF, with an in-browser preview;
- Excel action tracker;
- Markdown report;
- raw `audit.json`;
- the evidence digest.

## Configuring APIs

In **Settings → API keys**, paste a key and press **Save**.

- Keys are write-only. The page shows only *Configured*, the source and a masked hint.
- **Remove** deletes a key from the dashboard store. Keys from your environment or the engine's `.env` stay in effect.

| Key | Needed for |
| --- | --- |
| `TYPESAFE_API_KEY` | Jev judgments; without it the audit is partial |
| `PAGESPEED_API_KEY` | Higher PageSpeed quota. It is free from Google Cloud: enable the *PageSpeed Insights API*, then create an API key. |
| `DATAFORSEO_USERNAME` / `DATAFORSEO_PASSWORD` | Full mode only (paid) |

**Settings → Audit defaults** pre-fills the New Audit form. **Settings → Diagnostics** checks the engine, Python, its packages, Playwright and Chromium, the directories and the keys, with a suggested fix for each problem.
