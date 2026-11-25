# API

All routes are served by the dashboard at `http://localhost:3000/api`. Responses are JSON with `Cache-Control: no-store`, except SSE and file downloads.

**Errors** use one shape:

```json
{ "error": { "status": 422, "message": "…", "details": [] } }
```

| Status | Meaning |
| --- | --- |
| 400 | Invalid input (Zod issues in `details`) |
| 403 | Host not allowed or cross-site write |
| 404 | Not found |
| 409 | Conflict (already running, still generating) |
| 413 / 415 | Body too large / not JSON |
| 422 | Rejected URL or unreadable `audit.json` |
| 429 | Concurrency limit |
| 500 | Unexpected error (details only in the server log) |

**Security.** Requests must use an allowed `Host` (localhost by default). `POST`/`PUT`/`PATCH`/`DELETE` are refused when `Origin` is another site or `Sec-Fetch-Site: cross-site`.

## Audits

### `POST /api/audits`

```json
{ "url": "https://example.com", "keywords": ["seo audit tool"], "options": { "maxPages": 30, "jev": true, "psi": true, "psiPages": 3, "full": false, "render": "auto", "formats": ["pdf","xlsx","md"] }, "confirmPaid": false }
```

→ `202 {"id":"example.com-2026-11-18-1058","status":"running","url":"https://example.com/","domain":"example.com","warnings":["PAGESPEED_API_KEY is not set: …"]}`

Option keys and bounds (each maps to a CLI flag):

| Key | Range | Flag |
| --- | --- | --- |
| `maxPages` | 1–2000 | `--max-pages` |
| `maxDepth` | 1–10 | `--max-depth` |
| `timeBudget` | 30–5400 | `--time-budget` |
| `render` | auto, always, never | `--render` |
| `jev` / `jevPages` / `jevBudget` | | `--no-jev` / `--jev-pages` / `--jev-budget` |
| `psi` / `psiPages` | | `--no-psi` / `--psi-pages` |
| `full` / `dfsBudget` / `locationCode` / `language` | `full` needs `confirmPaid: true` and DataForSEO keys | `--full` and related |
| `formats` | | `--formats` |

Missing keys use the saved defaults.

### `GET /api/audits`

Query parameters: `q`, `status` (repeatable), `from`, `to` (YYYY-MM-DD), `sort=date|score|domain|findings`, `dir=asc|desc`, `page`, `pageSize` (max 100).

```json
{ "items": [ { "id": "iana.org-2026-11-18-0812", "domain": "iana.org", "status": "completed", "origin": "dashboard",
  "score": 60, "grade": "C", "partial": ["Jev judgments unavailable, …"], "pagesCrawled": 4, "findingsTotal": 12,
  "severity": {"critical":0,"high":1,"medium":4,"low":6,"info":1}, "rulesEvaluated": 52, "reports": ["pdf","xlsx","md","json","digest"], "hasResults": true, … } ],
  "total": 3, "page": 1, "pageSize": 20 }
```

### Single audit

| Route | Description |
| --- | --- |
| `GET /api/audits/{id}` | Summary (as above) |
| `DELETE /api/audits/{id}` | Remove from history only. Response: `{"hidden":true,"filesDeleted":false}`. |
| `GET /api/audits/{id}/progress` | Snapshot: `{ status, error, note, startedAt, finishedAt, progress: { stages[7]: {state, detail, counter}, completedStages, currentStage, pagesCrawled, warnings, errors }, events: [...last 300], eventCount }` |
| `GET /api/audits/{id}/events` | SSE: `event: snapshot` (same body as `/progress`) on change, `: ping` every 15 s, `event: end` on a terminal status, `retry: 3000` |
| `POST /api/audits/{id}/cancel` | Stops only this audit's process group |
| `GET /api/audits/{id}/results` | Overview: scores, counts, by-severity, by-category, status buckets, top actions, Jev/PSI availability |
| `GET /api/audits/{id}/findings` | Query: `severity`, `category`, `origin` (repeatable), `q`, `sort=severity\|count\|title\|category`, `dir`, `page`, `pageSize`. Returns items, total, facets and `passedRules`. |
| `GET /api/audits/{id}/findings/{findingId}` | Full finding (all URLs, detail, linked action) |
| `GET /api/audits/{id}/pages` | Query: `q`, `status=2xx\|3xx\|4xx\|5xx\|error`, `indexable=yes\|no`, `issues=with\|without`, `sort`, `dir`, `page`, `pageSize` |
| `GET /api/audits/{id}/pages/detail?url=` | One page: meta, headings, content, links (with status), structured data, findings, AI answers |
| `GET /api/audits/{id}/ai` | `{ available, skipped, site[], dimensions[], pages[{url, answers, findings}], notJudged, findings }`. Empty when Jev did not run. |
| `GET /api/audits/{id}/performance` | `{ skipped, keyed, runs[{strategy, outcome: ok\|rate_limited\|failed, scores?, lab?, field_url?, field_origin?}], ttfb[], perfFindings[] }` |
| `GET /api/audits/{id}/recommendations` | Engine actions merged with the user's status and notes |
| `PATCH /api/audits/{id}/recommendations/{key}` | Body `{ "status": "pending\|in_progress\|completed", "notes": "…" }` |
| `GET /api/audits/{id}/extra` | Extra checks layer: `{ findings[{id, group, severity, title, fix, source, heuristic, urls, count, evidence}], passed[], skipped[], keywords[], keywordReport[{keyword, targetUrl, checks{title,h1,url,meta,intro}, densityPct, wordCount}], readability[], notCheckable[], checksTotal }`. Computed from the saved audit.json; does not change the engine score. |
| `GET/PUT /api/audits/{id}/keywords` | Focus keywords for the extra checks. PUT body `{ "keywords": ["…"] }` (max 10, each ≤ 80 chars); an empty list clears them. Works for imported audits too. |
| `GET /api/audits/{id}/reports` | `[{ type, label, filename, size, modifiedAt }]` |
| `GET /api/audits/{id}/reports/{pdf\|xlsx\|md\|json\|digest}[?inline=1]` | Streams the original file. `inline` is allowed for pdf and md. |

### Import and history

| Route | Description |
| --- | --- |
| `POST /api/audits/import` | Body `{ "restoreAll": true }` or `{ "restore": ["id"] }`. Rescans the reports folder (read only) and returns `{ discovered, visible, restored, hidden }`. |
| `GET /api/audits/import` | `{ discovered, hidden: [{id, hiddenAt}] }` |
| `POST /api/site-size` | Body `{ "url": "…" }`. Counts pages from robots.txt and XML sitemaps without crawling: `{ finalUrl, sitemapUrlCount, sitemapFiles[{url, type, urls, children, error}], homepageLinks, estimate, basis: sitemap\|homepage-links, truncated, notes }`. Every request and redirect passes the private-network guard. Limits: 100 sitemap files, 200,000 URLs, 60 s. Rate limited to 10 per minute. |
| `GET /api/history?domain=` | `{ domains, points: [{id, date, score, grade}] }`. Completed audits only. |

## Settings and system

| Route | Description |
| --- | --- |
| `GET /api/settings` | `{ secrets: [{ key, configured, source: dashboard\|environment\|engine-env-file\|user-keys-file\|null, hint: "••••abcd"\|null, usedFor }], defaults }` |
| `PUT /api/settings` | Body `{ "secrets": { "PAGESPEED_API_KEY": "…" \| null }, "defaults": { "maxPages": 40 } }`. `null` removes a key from the dashboard store. Values are validated, and invalid keys return `400` with per-key messages. |
| `POST /api/settings/verify` | Body `{ "service": "pagespeed" \| "dataforseo" }`. Makes one live request with the configured key and returns `{ ok, status: valid\|missing\|invalid\|api_disabled\|rate_limited\|unreachable\|error, message }`. PageSpeed uses one call of the key's quota; the DataForSEO account endpoint is free. The key is never echoed. |
| `GET /api/system/health` | `{ status, engineFound, reportsDirExists, running: [{id, domain, startedAt}] }` |
| `GET /api/system/diagnostics[?refresh=1]` | `{ versions: {engine, python, node}, rendering: {playwright, chromium}, checks: [{key, label, state: ok\|warning\|error, detail, action}] }`. Cached for 30 s. |

### Example

```bash
curl -s -X POST localhost:3000/api/audits -H 'content-type: application/json' \
  -d '{"url":"https://example.com","options":{"maxPages":10,"psi":false}}'
curl -N localhost:3000/api/audits/example.com-2026-11-18-1100/events
```
