# User guide

## After an audit: start with the Google checklist

Each audit opens with **Google guidelines**, which shows how the site measures up against Google's own Search guidance:

- an overall score (rules met out of rules checked);
- a tile per area, such as crawling, indexing, titles, content and E-E-A-T, structured data, page experience, spam policies and AI features;
- the five fixes to make first.

**Open Google checklist** lists every rule in plain language. Each one is marked:

- **Passed**;
- **Needs work** (with what was found, how to fix it, the affected URLs and Google's own page);
- **Not checked** (with the reason, for example "needs a PageSpeed key");
- **Manual check** (for things no crawler can detect, such as cloaking or manual actions).

## Site Explorer: find what is missing

**Site Explorer** shows every crawled URL, in the style of a desktop crawler:

- **Issues** ranks everything missing across all tabs. Click one to see the URLs.
- **Tabs** (Page titles, Meta description, H1, Canonicals, Links and more) have filters such as *Missing*, *Duplicate*, *Over 60 characters* or *Non-indexable*.
- **Rows** open the full page analysis when clicked.
- **CSV** exports the current tab and filter.


## Creating an audit

1. Open **New Audit**.
2. Enter the homepage URL. A bare domain works. Local, private and cloud-metadata addresses are refused.
3. Adjust the options:
   - **Maximum pages, depth and time budget** cap the crawl. The engine default is 60 pages.
   - **JavaScript rendering**: *Auto* renders only pages that need it. It requires Playwright and Chromium, and the form shows whether they are available.
   - **AI content evaluation** needs `TYPESAFE_API_KEY` and costs about one cent per site, with a hard spend cap.
   - **PageSpeed Insights** works without a key, but Google often rate limits unkeyed requests (HTTP 429).
   - **Advanced analysis (DataForSEO)** is paid per call, needs credentials, and always asks for confirmation.
4. The **Audit summary** panel lists what will run and what is missing. Press **Start audit**.

## Monitoring progress

The progress page shows the engine's seven stages: crawl, rules, DataForSEO, AI judgments, PageSpeed, scoring and report generation.

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
- **Partial audit** appears when AI judgments or PageSpeed were unavailable, so some categories could not be assessed.
- **Caps** (for example "Capped at 60: not reliably served over HTTPS") are engine rules that limit the score.
- **Category scores** list each category's weight and the engine's note, such as "Rules only".

## Understanding findings

**Technical SEO** lists every finding with its severity, rule ID, category, affected URLs, evidence and fix.

- Filter by severity, category or source (rules, AI judgments, DataForSEO), search, and sort.
- Click a finding to open the detail drawer, which lists all URLs, links to Google's guidance and shows impact and effort.
- **No issue detected** lists the rules that passed.

**Pages** lists every crawled URL with its status, indexability, H1, word count, depth and links. Click a row to see its metadata, heading outline, content, links (with their HTTP status), structured data, findings and AI answers.

**AI Content** appears only when AI judgments ran. It shows the AI model's typed answers per page, such as intent, helpfulness, specificity, trust and title/meta fit, with a confidence band:

- *Confident*: the answer is reliable.
- *Needs review*: the model was undecided; check it yourself.

The model returns probabilities, not prose, so each answer is explained by the engine's criterion text that it matched.

**Performance** separates mobile and desktop. Each run shows either Lighthouse lab metrics plus real-user Core Web Vitals, or the reason it has no data (rate limited, failed or skipped). Missing values are shown as unavailable, never as 0.

## Using recommendations

Recommendations are the engine's ranked actions:

- **Priority:** P1, P2 or P3.
- **Impact:** 0–100.
- **Effort:** 1–4.
- **Quick win:** high impact, low effort.

Set a status (*Pending*, *In progress* or *Completed*) and add notes. Both are saved in the dashboard (`data/state.json`), never in the audit data. Filter by status, priority or quick wins.

## Managing history

**Audit History** lists every audit: those launched here and any audit already in your reports folder, including ones made with the CLI. It supports searching by domain, filtering by status and date, sorting and paging.

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
| `TYPESAFE_API_KEY` | AI judgments; without it they are off and the audit is marked partial |
| `PAGESPEED_API_KEY` | Higher PageSpeed quota. It is free from Google Cloud: enable the *PageSpeed Insights API*, then create an API key. |
| `DATAFORSEO_USERNAME` / `DATAFORSEO_PASSWORD` | Full mode only (paid) |

**Settings → Audit defaults** pre-fills the New Audit form. **Settings → Diagnostics** checks the engine, Python, its packages, Playwright and Chromium, the directories and the keys, with a suggested fix for each problem.
