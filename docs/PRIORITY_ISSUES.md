# Daily priority issues

This is the short list of checks that matter for running emailverify.io, clustox.com, inboxwarm.ai, mycoldinbox.com and tellbear.com day to day. It is taken from the [full list of everything AuditPilot checks](CHECKS.md): 108 Google checklist rules, 31 extra checks and the monitoring checks.

Each issue has:

- **ID:** the check ID AuditPilot reports. Use it as the stable key when tasks are created in your task tool later.
- **Owner:** the role that normally fixes it.
  - **Dev:** developer or hosting.
  - **SEO:** SEO specialist.
  - **Content:** writer or editor.
- **Create a task when:** the condition that should open a task.
  - **appears:** the check was passing and now fails.
  - **grows:** more pages are affected than in the previous audit.
  - **open:** a task stays open as long as the check fails.
- **Done when:** how the next daily audit confirms the fix.

**Today's status** comes from the latest audit of each site:

| Site | Audit | Score | Pages crawled |
|---|---|---|---|
| emailverify.io (EV) | 25 Nov | 84 (B) | 1,620 |
| clustox.com (CX) | 25 Nov | 92 (A) | 732 |
| inboxwarm.ai (IW) | 25 Nov | 88 (B) | 464 |
| mycoldinbox.com (MC) | 26 Nov | 97 (A) | 49 |

In the status columns, ✓ means passing and a number is how many pages are affected. tellbear.com (26 Nov audit: 98 (A), 72 pages) passes every P0 and P1 check except one: www.tellbear.com answers without redirecting to tellbear.com (`host_variant`, P1, Dev). Its only P2 item is 2 thin pages (/contact and /opt-out), which is normal for those pages. Search Console alerts (traffic drops, pages dropping out of the index, sitemap errors) are listed in the [combined list](COMBINED_LIST.md).

Summary: **14 critical checks**, **14 high**, **20 important**. About 45 other checks are kept out of the daily feed and go in a weekly review.

---

## P0: Critical. Fix the same day.

These remove pages, or the whole site, from Google. They are rare, so any occurrence should alert someone at once.

| # | Issue | ID | Owner | Create a task when | Done when | EV | CX | IW | MC |
|---|---|---|---|---|---|---|---|---|---|
| 1 | robots.txt blocks Google from the whole site | `robots_blocks_site` | Dev | appears | robots.txt allows Googlebot | ✓ | ✓ | ✓ | ✓ |
| 2 | Homepage marked noindex | `noindex` (homepage) | Dev | appears | homepage has no noindex | ✓ | ✓ | ✓ | ✓ |
| 3 | A content page became noindex (pagination, archive, legal and account pages are ignored) | `noindexAdded` (monitoring) | SEO | appears | noindex removed, or confirmed as intended | ✓ | 1 to check¹ | ✓ | ✓ |
| 4 | Homepage down or not returning 200 | homepage status (monitoring) | Dev | appears | homepage returns 200 | ✓ | ✓ | ✓ | ✓ |
| 5 | Pages that worked yesterday now return errors | `broke` (monitoring) | Dev | appears | pages return 200 again, or are 301-redirected | — | — | — | — |
| 6 | Site not on HTTPS, or HTTP does not redirect to HTTPS | `no_https` | Dev | appears | HTTPS works and HTTP redirects | ✓ | ✓ | ✓ | ✓ |
| 7 | XML sitemap missing | `sitemap_missing` | Dev | appears | sitemap reachable | ✓ | ✓ | ✓ | ✓ |
| 8 | Sitemap file broken or unreachable | `sitemap_errors` | Dev | appears | sitemap loads and is valid | ✓ | ✓ | ✓ | ✓ |
| 9 | Many pages removed from the sitemap at once | sitemap removed (monitoring) | SEO | appears (10 or more URLs) | removal confirmed as intended, or restored | — | — | — | — |
| 10 | Canonical points to a page that redirects or errors | `canonical_broken` | Dev | appears | canonical points to a live page | ✓ | ✓ | ✓ | ✓ |
| 11 | Pages without a title | `title_missing` | Content | appears | every page has a title | ✓ | ✓ | ✓ | ✓ |
| 12 | Homepage title, description, H1, canonical or robots changed | homepage change (monitoring) | SEO | appears | change confirmed as intended, or reverted | — | — | — | — |
| 13 | Score dropped by 5 or more points | score delta (monitoring) | SEO | appears | cause found and its tasks created | — | — | — | — |
| 14 | Scheduled audit failed to run | monitoring error | Dev | appears | next audit completes | ✓ | ✓ | ✓ | ✓ |

¹ **clustox.com/ai-commerce** is a real page marked noindex. Confirm whether it should appear in Google.

---

## P1: High. Fix within 2–3 days.

These hurt crawling, indexing or mobile use on the affected pages.

| # | Issue | ID | Owner | Create a task when | Done when | EV | CX | IW | MC |
|---|---|---|---|---|---|---|---|---|---|
| 15 | Pages returning HTTP errors (404, 5xx) | `http_errors` | Dev | appears / grows | 0 error pages | **1** | **1** | **1** | ✓ |
| 16 | Internal links pointing to broken pages | `broken_internal_links` | Dev + Content | appears / grows | 0 broken links | **1,463**² | **3**³ | **1**⁴ | ✓ |
| 17 | No mobile viewport tag (phones show a zoomed-out desktop page) | `viewport_missing` | Dev | open | every page has a viewport tag | **54**⁵ | ✓ | ✓ | ✓ |
| 18 | Structured data that fails to parse | `jsonld_errors` | Dev | appears | 0 parse errors | ✓ | ✓ | ✓ | ✓ |
| 19 | HTTPS pages loading insecure http:// files | `mixed_content` | Dev | appears | 0 pages | ✓ | ✓ | ✓ | ✓ |
| 20 | Missing pages return 200 instead of 404 (soft 404) | `soft_404` | Dev | open | a random URL returns 404 | **yes** | ✓ | **yes** | **yes** |
| 21 | www and non-www both serve the site | `host_variant` | Dev | open | one host redirects to the other | ✓ | ✓ | **yes**⁶ | ✓ |
| 22 | Sitemap lists URLs that redirect, fail or are noindex | `sitemap_bad_urls` | Dev | grows | sitemap lists only live 200 pages | **4** | ✓ | ✓ | ✓ |
| 23 | Content pages marked noindex (not on purpose) | `noindex` (Check verdict) | SEO | open | noindex removed or confirmed | ✓ | **1** | ✓ | ✓ |
| 24 | Content only appears after JavaScript runs | `js_dependent` | Dev | appears | content is in the HTML | ✓ | ✓ | ✓ | ✓ |
| 25 | Host or HTTPS redirect is temporary (302/307) | `host_temporary_redirect` | Dev | appears | redirect is 301/308 | ✓ | ✓ | ✓ | ✓ |
| 26 | Real users get poor Core Web Vitals on mobile | `cwv_field` | Dev | open | all three metrics "good" | needs key⁷ | needs key | needs key | needs key |
| 27 | No About or Contact page (trust signal) | `eeat_about`, `eeat_contact` | Content | appears | page exists and is linked | ✓ | ✓ | ✓ | ✓ |
| 28 | Focus keyword has no page at all | `kw_no_page` | Content + SEO | open | a page targets it | needs keywords⁸ | needs keywords | needs keywords | needs keywords |

² emailverify.io: 1,460 of these come from Cloudflare's email protection (`/cdn-cgi/l/email-protection`). Turning off **Scrape Shield → Email Address Obfuscation** in Cloudflare fixes them all at once. The other 3 are links pasted as Markdown on the Indonesian, Dutch and Turkish Monday integration pages.
³ clustox.com: 2 links end in `\"`, on /blog/ai-agent-architecture-blueprint and /blog/nodejs-vs-react; AuditPilot shows the working address for both. The third ends in `'`, on the product-strategy link. Also, /blog/services/devops-services returns 404.
⁴ inboxwarm.ai: /blog/email-warm-up-api links to the article's *title* used as the URL, which returns 404.
⁵ emailverify.io: all 54 are /docs pages. One fix in the docs template covers them.
⁶ inboxwarm.ai: www.inboxwarm.ai answers without redirecting to inboxwarm.ai.
⁷ Add the free PageSpeed key in Settings and the daily audits will include this.
⁸ Add focus keywords once per site; the daily audits reuse them.

---

## P2: Important. Fix this week or sprint.

These weaken pages in search. Track how many pages each affects, and create a task when that number goes up, rather than every day.

| # | Issue | ID | Owner | Create a task when | EV | CX | IW | MC |
|---|---|---|---|---|---|---|---|---|
| 29 | Duplicate titles across pages | `title_duplicate` | Content | grows | **23** | **26** | **19** | ✓ |
| 30 | Pages without a meta description | `meta_missing` | Content | grows | **2** | **5** | ✓ | ✓ |
| 31 | Pages without an H1 heading | `h1_missing` | Content | grows | **5** | ✓ | ✓ | ✓ |
| 32 | Thin pages (under 150 words) | `thin_content` | Content | grows | **42** | ✓ | **12** | ✓ |
| 33 | Pages with identical text | `duplicate_content` | SEO | grows | **4** | ✓ | **2** | ✓ |
| 34 | Orphan pages (in the sitemap, no internal links) | `orphan_pages` | SEO + Content | grows | **27** | ✓ | ✓ | ✓ |
| 35 | Redirect chains (more than one hop) | `redirect_chains` | Dev | grows | **38** | **3** | **1** | ✓ |
| 36 | Slow server response (over 0.8 s) | `slow_ttfb` | Dev | grows | **101** | **212** | **84** | ✓ |
| 37 | Images without alt text | `images_alt` | Content | grows | **1,448**⁹ | ✓ | ✓ | ✓ |
| 38 | hreflang without a self-reference | `hreflang_issues` | Dev | grows | **2** | ✓ | **1** | ✓ |
| 39 | Articles without an author | `eeat_author` | Content | grows | **24** | **22** | **16** | ✓ |
| 40 | Canonical points elsewhere (parameter pages are ignored) | `canonical_elsewhere` | SEO | appears | ✓¹⁰ | ✓ | ✓¹⁰ | ✓ |
| 41 | No structured data on the homepage | `no_structured_data` | Dev | appears | ✓ | ✓ | ✓ | ✓ |
| 42 | More than one H1 on a page | `h1_multiple` | Content | grows | ✓ | ✓ | ✓ | ✓ |
| 43 | Focus keyword missing from the title or H1 | `kw_title`, `kw_h1` | Content | open | needs keywords | needs keywords | needs keywords | needs keywords |
| 44 | Focus keyword overused (stuffing) | `kw_density_high` | Content | appears | needs keywords | needs keywords | needs keywords | needs keywords |
| 45 | Lighthouse mobile performance is poor | `lab_performance` | Dev | grows | needs key | needs key | needs key | needs key |
| 46 | Pages competing for the same searches | `ai_cannibalization` | SEO | appears | needs AI key | needs AI key | needs AI key | needs AI key |
| 47 | Key pages lack evidence of expertise and trust | `ai_trust` | Content | appears | needs AI key | needs AI key | needs AI key | needs AI key |
| 48 | Pages that should be rewritten or merged | `ai_rewrite` | Content | appears | needs AI key | needs AI key | needs AI key | needs AI key |

⁹ emailverify.io: on about 1,420 pages, the image without alt text is the Facebook tracking pixel. Adding `alt=""` to that one tag in the tag manager or theme fixes most of this.
¹⁰ These are `?billing=`, `?utm_` and similar parameter pages that correctly point to the clean URL. Nothing to do.

---

## Not in the daily feed

These are real but low-impact. Putting them in the daily feed would bury the issues above. Show them in a **weekly digest** and fix them when the pages are being edited anyway.

| Group | Checks (IDs) |
|---|---|
| Titles and snippets | `title_length`, `meta_duplicate`, `multiple_titles`, `title_h1_mismatch` |
| Structure | `heading_skips`, `lang_missing`, `canonical_missing`, `deep_pages`, `not_in_sitemap`, `links_to_redirects`, `generic_anchors`, `links_internal_low`, `links_weak_inlinks` |
| Media and speed | `images_dimensions`, `images_lazy`, `heavy_html` |
| Structured data and social | `schema_required`, `schema_article`, `schema_breadcrumb`, `og_missing`, `social_twitter_card`, `eeat_org_schema`, `eeat_sameas` |
| Trust details | `eeat_dates`, `eeat_contact_details`, `eeat_privacy`, `eeat_terms`, `links_no_outbound` |
| Security and housekeeping | `security_headers`, `hsts_missing`, `favicon_missing`, `robots_missing`, `broken_external_links` |
| URLs | `url_uppercase`, `url_underscores`, `url_long`, `url_params` |
| Content style (heuristic) | `keyword_stuffing`, `readability_hard`, `kw_url`, `kw_meta`, `kw_intro`, `kw_thin` |
| AI (with key) | `ai_title_fit`, `ai_meta_fit`, `ai_helpfulness`, `ai_specificity`, `ai_value_prop`, `ai_next_step`, `ai_answer_first`, `ai_citable`, `ai_entity_clarity`, `ai_local_schema` |
| DataForSEO (paid) | `dfs_striking`, `dfs_existing_page`, `dfs_new_page`, `dfs_backlink_gap`, `dfs_broken_backlinks`, `dfs_aio_not_cited` |

**Never create tasks for these:**

- `faq_rich_result_limited`: information only.
- `llms_txt_missing`: no effect on Google.
- `ai_bots_blocked`: a business decision, not an error.
- noindex on pagination, archives, legal or account pages: intended.
- parameter-URL canonicals: correct as they are.
- the 4 manual checks (cloaking, hidden text, doorway pages, manual actions): review these once a quarter in Search Console.

---

## Suggested owners

| Role | Gets |
|---|---|
| Developer / hosting | All P0 site-level items, P1 technical items (errors, viewport, soft 404, host, sitemap, JS, structured data), redirect chains, speed, hreflang |
| SEO specialist | Homepage and sitemap changes, score drops, noindex decisions, duplicate content, orphans, cannibalisation, triage of everything else |
| Content | Titles, descriptions, H1s, thin pages, alt text, authors, About and Contact pages, keyword placement |

## What to do first (from today's audits)

1. **emailverify.io:** turn off Cloudflare Email Address Obfuscation. This clears 1,460 of the 1,463 broken links.
2. **emailverify.io:** add the viewport tag to the /docs template (54 pages).
3. **clustox.com:** fix the 3 broken links (two with a stray `\"`, one with a `'`), and decide whether /ai-commerce should be indexed.
4. **inboxwarm.ai:** fix the broken link on /blog/email-warm-up-api, and redirect www.inboxwarm.ai to inboxwarm.ai.
5. **All sites except clustox.com:** make unknown URLs return a real 404 (soft 404).
6. **All sites:** add the free PageSpeed key so Core Web Vitals are tracked daily.
