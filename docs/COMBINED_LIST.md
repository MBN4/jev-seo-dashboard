# Combined list: what's in the app and what needs adding

This merges [everything Rankora checks](CHECKS.md) with the [daily priority list](PRIORITY_ISSUES.md). It was built by comparing both against the app's code. It has three parts:

- **[Part A](#part-a-checks-already-in-the-app):** the 108 checks the app already runs. Each has the app's severity, the priority it gets in the daily list, and an owner role.
- **[Part B](#part-b-detected-by-monitoring-but-not-yet-tracked-as-issues):** changes monitoring already detects, but which have no ID, threshold or priority yet.
- **[Part C](#part-c-needs-to-be-added-to-the-app):** what has to be built so the app works the way the priority list describes.

## Summary

| | Count |
|---|---|
| Checks in the app | 108 |
| ↳ P0 Critical: fix the same day | 7 |
| ↳ P1 High: fix within 2–3 days | 14 |
| ↳ P2 Important: fix this week | 21 |
| ↳ Weekly digest | 59 |
| ↳ Information only: never a task | 3 |
| ↳ Manual review (quarterly) | 4 |
| Checks whose priority is higher than the app's severity | 10 |
| Monitoring signals still to turn into tracked issues (Part B) | 9 |
| Features still to build (Part C) | 9 |
| New checks worth adding (Part C) | 6 |

The **Status** column in Part A says whether a check runs today:

- **In app:** runs in every audit.
- **needs key / needs focus keywords:** built, but only runs once the key or keywords are added.
- **manual reminder only:** listed, but no crawler can check it.

## Part A: Checks already in the app

### P0 Critical: fix the same day (7)

| ID | Check | Area | App severity | Owner | Status | Note |
|---|---|---|---|---|---|---|
| `robots_blocks_site` | robots.txt does not block Google from the site | Google can find and crawl your pages | critical | Dev | In app |  |
| `sitemap_missing` | An XML sitemap is published and findable | Google can find and crawl your pages | medium | Dev | In app | raised from app severity "medium" |
| `sitemap_errors` | Sitemap files load and are valid XML | Google can find and crawl your pages | medium | Dev | In app | raised from app severity "medium" |
| `noindex` | Pages you want in Google are not marked noindex | Your pages can be indexed, once | high | Dev | In app | split: homepage = P0, content page = P1, pagination/legal = ignore |
| `canonical_broken` | Canonical targets are live, not redirects or errors | Your pages can be indexed, once | high | Dev | In app |  |
| `title_missing` | Every page has a title | Titles and snippets describe each page | high | Content | In app |  |
| `no_https` | The site is served over HTTPS | Page experience: mobile, speed and security | high | Dev | In app |  |

### P1 High: fix within 2–3 days (14)

| ID | Check | Area | App severity | Owner | Status | Note |
|---|---|---|---|---|---|---|
| `sitemap_bad_urls` | The sitemap lists only live, indexable URLs | Google can find and crawl your pages | medium | Dev | In app | raised from app severity "medium" |
| `http_errors` | Pages return HTTP 200, not errors | Google can find and crawl your pages | high | Dev | In app |  |
| `soft_404` | Missing pages return a real 404 | Google can find and crawl your pages | medium | Dev | In app | raised from app severity "medium" |
| `broken_internal_links` | Internal links point to working pages | Google can find and crawl your pages | high | Dev + Content | In app |  |
| `js_dependent` | Main content is in the HTML, not only added by JavaScript | Google can find and crawl your pages | medium | Dev | In app | raised from app severity "medium" |
| `host_variant` | Only one host version serves the site (www or non-www) | Your pages can be indexed, once | medium | Dev | In app | raised from app severity "medium" |
| `host_temporary_redirect` | Host and HTTPS redirects are permanent (301/308) | Your pages can be indexed, once | low | Dev | In app | raised from app severity "low" |
| `kw_no_page` | Every focus keyword has a page about it | Pages target the searches you want | high | Content + SEO | In app, needs focus keywords |  |
| `eeat_about` | An About page says who is behind the site | Helpful, reliable, people-first content (E-E-A-T) | medium | Content | In app | raised from app severity "medium" |
| `eeat_contact` | A Contact page exists | Helpful, reliable, people-first content (E-E-A-T) | medium | Content | In app | raised from app severity "medium" |
| `jsonld_errors` | Structured data parses without errors | Structured data is valid and complete | high | Dev | In app |  |
| `viewport_missing` | Pages are set up for mobile (viewport tag) | Page experience: mobile, speed and security | high | Dev | In app |  |
| `cwv_field` | Real users get good Core Web Vitals on mobile | Page experience: mobile, speed and security | varies | Dev | In app, needs free PageSpeed key |  |
| `mixed_content` | HTTPS pages load no insecure resources | Page experience: mobile, speed and security | high | Dev | In app |  |

### P2 Important: fix this week (21)

| ID | Check | Area | App severity | Owner | Status | Note |
|---|---|---|---|---|---|---|
| `redirect_chains` | Redirects take one hop, not chains | Google can find and crawl your pages | medium | Dev | In app |  |
| `orphan_pages` | Every page is linked from somewhere on the site | Google can find and crawl your pages | medium | SEO + Content | In app |  |
| `canonical_elsewhere` | Canonicals point to the page itself unless it is a deliberate duplicate | Your pages can be indexed, once | medium | SEO | In app |  |
| `duplicate_content` | Pages have distinct main content | Your pages can be indexed, once | medium | SEO | In app |  |
| `title_duplicate` | Every title is unique | Titles and snippets describe each page | medium | Content | In app |  |
| `meta_missing` | Every page has a meta description | Titles and snippets describe each page | medium | Content | In app |  |
| `kw_title` | The focus keyword appears in the target page's title | Pages target the searches you want | medium | Content | In app, needs focus keywords |  |
| `kw_h1` | The focus keyword appears in the main heading | Pages target the searches you want | medium | Content | In app, needs focus keywords |  |
| `ai_trust` | Key pages show evidence of expertise and trust | Helpful, reliable, people-first content (E-E-A-T) | varies | Content | In app, needs AI key |  |
| `ai_rewrite` | No pages need rewriting or merging | Helpful, reliable, people-first content (E-E-A-T) | varies | Content | In app, needs AI key |  |
| `ai_cannibalization` | Pages do not compete for the same searches | Helpful, reliable, people-first content (E-E-A-T) | varies | SEO | In app, needs AI key |  |
| `thin_content` | Pages have substantial main content | Helpful, reliable, people-first content (E-E-A-T) | medium | Content | In app |  |
| `h1_missing` | Every page has a main (H1) heading | Helpful, reliable, people-first content (E-E-A-T) | medium | Content | In app |  |
| `h1_multiple` | Each page has one main heading | Helpful, reliable, people-first content (E-E-A-T) | low | Content | In app | raised from app severity "low" |
| `eeat_author` | Articles say who wrote them | Helpful, reliable, people-first content (E-E-A-T) | medium | Content | In app |  |
| `images_alt` | Images have alt text | Images are understandable and fast | medium | Content | In app |  |
| `no_structured_data` | The homepage has structured data | Structured data is valid and complete | medium | Dev | In app |  |
| `lab_performance` | Lighthouse mobile performance is reasonable | Page experience: mobile, speed and security | varies | Dev | In app, needs free PageSpeed key |  |
| `slow_ttfb` | The server responds quickly (under 0.8 s) | Page experience: mobile, speed and security | medium | Dev | In app |  |
| `hreflang_issues` | hreflang annotations are complete and reciprocal | International and multilingual pages | medium | Dev | In app |  |
| `kw_density_high` | Focus keywords are used naturally | Spam policies are respected | medium | Content | In app, needs focus keywords |  |

### Weekly digest: fix when editing those pages (59)

| ID | Check | Area | App severity | Owner | Status | Note |
|---|---|---|---|---|---|---|
| `robots_missing` | The site publishes a robots.txt file | Google can find and crawl your pages | low | Dev | In app |  |
| `not_in_sitemap` | Every indexable page is in the sitemap | Google can find and crawl your pages | low | Dev | In app |  |
| `links_to_redirects` | Internal links point straight at the final URL | Google can find and crawl your pages | low | Dev | In app |  |
| `deep_pages` | Important pages are within three clicks of the homepage | Google can find and crawl your pages | low | Dev | In app |  |
| `canonical_missing` | Each page declares its canonical URL | Your pages can be indexed, once | low | Dev | In app |  |
| `url_uppercase` | URLs are lowercase | Your pages can be indexed, once | low | Dev | In app |  |
| `url_underscores` | Words in URLs are separated by hyphens | Your pages can be indexed, once | low | Dev | In app |  |
| `url_long` | URLs are short and readable | Your pages can be indexed, once | low | Dev | In app |  |
| `url_params` | Indexable URLs avoid query parameters | Your pages can be indexed, once | low | Dev | In app |  |
| `title_length` | Titles are a useful length | Titles and snippets describe each page | low | Content | In app |  |
| `multiple_titles` | Each page has exactly one title element | Titles and snippets describe each page | low | Content | In app |  |
| `ai_title_fit` | Titles accurately describe the page | Titles and snippets describe each page | varies | Content | In app, needs AI key |  |
| `title_h1_mismatch` | The title and the main heading describe the same topic | Titles and snippets describe each page | low | Content | In app |  |
| `meta_duplicate` | Meta descriptions are unique | Titles and snippets describe each page | low | Content | In app |  |
| `ai_meta_fit` | Meta descriptions summarise the page well | Titles and snippets describe each page | varies | Content | In app, needs AI key |  |
| `kw_url` | The focus keyword appears in the URL | Pages target the searches you want | low | Content | In app, needs focus keywords |  |
| `kw_meta` | The focus keyword appears in the meta description | Pages target the searches you want | low | Content | In app, needs focus keywords |  |
| `kw_intro` | The topic is stated in the opening text | Pages target the searches you want | low | Content | In app, needs focus keywords |  |
| `kw_thin` | Keyword target pages cover the topic fully | Pages target the searches you want | low | Content | In app, needs focus keywords |  |
| `ai_helpfulness` | Important pages fully satisfy the visitor | Helpful, reliable, people-first content (E-E-A-T) | varies | Content | In app, needs AI key |  |
| `ai_specificity` | Content shows first-hand, specific detail | Helpful, reliable, people-first content (E-E-A-T) | varies | Content | In app, needs AI key |  |
| `ai_value_prop` | The homepage makes the offer clear | Helpful, reliable, people-first content (E-E-A-T) | varies | Content | In app, needs AI key |  |
| `ai_next_step` | Commercial pages have a clear next step | Helpful, reliable, people-first content (E-E-A-T) | varies | Content | In app, needs AI key |  |
| `heading_skips` | Headings follow a logical order | Helpful, reliable, people-first content (E-E-A-T) | low | Content | In app |  |
| `readability_hard` | Text is easy to read | Helpful, reliable, people-first content (E-E-A-T) | low | Content | In app |  |
| `eeat_contact_details` | Real contact details are visible | Helpful, reliable, people-first content (E-E-A-T) | low | Content | In app |  |
| `eeat_privacy` | A privacy policy is published | Helpful, reliable, people-first content (E-E-A-T) | low | Content | In app |  |
| `eeat_terms` | Terms of service are published | Helpful, reliable, people-first content (E-E-A-T) | info | Content | In app |  |
| `eeat_dates` | Articles show when they were published or updated | Helpful, reliable, people-first content (E-E-A-T) | low | Content | In app |  |
| `links_no_outbound` | Articles cite their sources | Helpful, reliable, people-first content (E-E-A-T) | info | Content | In app |  |
| `lang_missing` | Pages declare their language | Helpful, reliable, people-first content (E-E-A-T) | low | Content | In app |  |
| `generic_anchors` | Link text describes the destination | Links are crawlable and descriptive | low | SEO | In app |  |
| `links_internal_low` | Pages link to related pages | Links are crawlable and descriptive | low | SEO | In app |  |
| `links_weak_inlinks` | Important pages receive several internal links | Links are crawlable and descriptive | low | SEO | In app |  |
| `broken_external_links` | Outbound links work | Links are crawlable and descriptive | low | SEO | In app |  |
| `images_dimensions` | Images declare width and height | Images are understandable and fast | low | Content | In app |  |
| `images_lazy` | Below-the-fold images are lazy-loaded | Images are understandable and fast | low | Content | In app |  |
| `schema_required` | Markup includes the properties Google requires | Structured data is valid and complete | low | Dev | In app |  |
| `eeat_org_schema` | Organization markup identifies the business | Structured data is valid and complete | low | Dev | In app |  |
| `eeat_sameas` | Organization markup links your official profiles | Structured data is valid and complete | low | Dev | In app |  |
| `schema_breadcrumb` | Deeper pages have breadcrumb markup | Structured data is valid and complete | low | Dev | In app |  |
| `schema_article` | Articles have Article markup | Structured data is valid and complete | low | Dev | In app |  |
| `ai_local_schema` | A local business uses LocalBusiness markup | Structured data is valid and complete | varies | Dev | In app, needs AI key |  |
| `og_missing` | Pages have Open Graph title and image | Structured data is valid and complete | low | Dev | In app |  |
| `social_twitter_card` | Pages have an X (Twitter) card | Structured data is valid and complete | info | Dev | In app |  |
| `heavy_html` | HTML documents are not oversized | Page experience: mobile, speed and security | low | Dev | In app |  |
| `hsts_missing` | HTTPS is enforced with HSTS | Page experience: mobile, speed and security | low | Dev | In app |  |
| `security_headers` | Common security headers are set | Page experience: mobile, speed and security | low | Dev | In app |  |
| `favicon_missing` | A favicon is declared | Page experience: mobile, speed and security | low | Dev | In app |  |
| `keyword_stuffing` | Text is not stuffed with repeated keywords | Spam policies are respected | low | SEO | In app |  |
| `ai_answer_first` | Pages lead with the answer | Ready for AI features in Search | varies | SEO | In app, needs AI key |  |
| `ai_citable` | Pages contain self-contained, quotable facts | Ready for AI features in Search | varies | SEO | In app, needs AI key |  |
| `ai_entity_clarity` | The homepage states who, what and where | Ready for AI features in Search | varies | SEO | In app, needs AI key |  |
| `dfs_aio_not_cited` | AI Overviews cite your site where you rank | Ready for AI features in Search | varies | SEO | In app, needs paid DataForSEO |  |
| `dfs_striking` | Keywords close to page one are pushed over | Search visibility and authority | varies | SEO | In app, needs paid DataForSEO |  |
| `dfs_existing_page` | Existing pages cover the keywords they could win | Search visibility and authority | varies | SEO | In app, needs paid DataForSEO |  |
| `dfs_new_page` | Important searches have a page | Search visibility and authority | varies | SEO | In app, needs paid DataForSEO |  |
| `dfs_backlink_gap` | Referring domains are competitive | Search visibility and authority | varies | SEO | In app, needs paid DataForSEO |  |
| `dfs_broken_backlinks` | Backlinks point to live pages | Search visibility and authority | varies | SEO | In app, needs paid DataForSEO |  |

### Information only: never create a task (3)

| ID | Check | Area | App severity | Owner | Status | Note |
|---|---|---|---|---|---|---|
| `faq_rich_result_limited` | FAQ markup is used only where Google shows it | Structured data is valid and complete | info | Dev | In app |  |
| `ai_bots_blocked` | AI crawlers are not blocked unintentionally | Ready for AI features in Search | info | SEO | In app |  |
| `llms_txt_missing` | An llms.txt file is published (optional) | Ready for AI features in Search | info | SEO | In app |  |

### Manual review (quarterly, in Search Console) (4)

| ID | Check | Area | App severity | Owner | Status | Note |
|---|---|---|---|---|---|---|
| `manual_cloaking` | Google and visitors see the same content (no cloaking) | Spam policies are respected | — | SEO | In app (manual reminder only) |  |
| `manual_hidden` | No hidden text or links | Spam policies are respected | — | SEO | In app (manual reminder only) |  |
| `manual_doorways` | No doorway or scaled low-value pages | Spam policies are respected | — | SEO | In app (manual reminder only) |  |
| `manual_actions` | No manual actions in Search Console | Spam policies are respected | — | SEO | In app (manual reminder only) |  |

## Part B: Detected by monitoring, but not yet tracked as issues

Monitoring already reports each of these on the Monitoring page. None has a check ID, a priority or a threshold yet. Each needs those three added so it can create a task.

| Proposed ID | Signal | Detected today? | Proposed priority | Owner | Threshold to add |
|---|---|---|---|---|---|
| `mon_homepage_down` | Homepage not returning 200 | Yes, in the 3-hourly check | P0 | Dev | any non-200 |
| `mon_pages_broke` | Pages that returned 200 now error | Yes, in the audit comparison | P0 | Dev | 1 or more pages |
| `mon_noindex_added` | A content page became noindex | Yes, in the audit comparison | P0 | SEO | 1 or more, ignoring pagination, archive and legal pages |
| `mon_homepage_changed` | Homepage title, description, H1, canonical or robots changed | Yes, in the 3-hourly check | P0 | SEO | any change (confirm it was intended) |
| `mon_sitemap_removed` | URLs removed from the sitemap | Yes, in the 3-hourly check | P0 | SEO | 10 or more URLs at once (today: any) |
| `mon_score_drop` | Score fell since the previous audit | Yes, in the audit comparison | P0 | SEO | 5 or more points (today: any change) |
| `mon_audit_failed` | Scheduled audit could not start or failed | Yes, as an error event | P0 | Dev | any failure |
| `mon_issue_new` | A check that passed now fails | Yes ("New problems") | the check's own priority | the check's owner | any |
| `mon_issue_worse` | A check affects more pages than before | Yes ("Got worse") | the check's own priority | the check's owner | any increase |

## Part C: Needs to be added to the app

### Features to build

| # | What | Today | Needed |
|---|---|---|---|
| 1 | Priority level per check | The app shows only its own severity (critical, high, medium, low) | One priority file with P0, P1, P2, Weekly and Ignore for every check in Part A, shown on every screen |
| 2 | Owner role per check | None | Dev, SEO or Content from Part A, shown on each issue and sent with each task |
| 3 | Task rules | Monitoring finds new and worse issues, but creates nothing | "appears", "grows" and "open" rules that decide when a task is opened |
| 4 | "Done when" and auto-close | Fixed issues appear in the comparison, but nothing closes | The next audit marks the issue fixed, and closes the task when the check passes |
| 5 | Monitoring thresholds | Any score or sitemap change is reported | Score drop of 5 or more and sitemap removal of 10 or more are critical. Smaller changes are information only. |
| 6 | IDs for monitoring signals | Events only | The `mon_*` IDs from Part B |
| 7 | Align severities | 10 checks rank higher in the list than in the app | Either change the app's severity or keep both; the verdict text should match the priority |
| 8 | Weekly digest | None | One weekly summary of the Weekly-tier checks per site |
| 9 | Connection to your task tool | None | Send each new issue as a task (ID, site, priority, owner, affected URLs, fix steps), and close it when fixed |

### New checks worth adding

These are not in the app today. They matter for daily monitoring, and none of them needs a crawl.

| Proposed ID | Check | Why | Priority | Owner |
|---|---|---|---|---|
| `mon_robots_changed` | robots.txt content changed | A single edited line can block the whole site. Today it is only checked during the daily audit. | P0 | Dev |
| `mon_ssl_expiring` | SSL certificate expires within 14 days | An expired certificate takes the whole site offline for visitors and Google | P0 | Dev |
| `mon_uptime` | Homepage reachability more often than every 3 hours (for example every 15 min) | Find downtime within minutes, not at the next check | P0 | Dev |
| `mon_redirect_changed` | Important URLs (homepage, top pages) start redirecting | Catches accidental redirects after deploys | P1 | Dev |
| `gsc_coverage` | Google Search Console: pages Google reports as not indexed | Google's own view of indexing. Needs a Search Console connection. | P1 | SEO |
| `gsc_manual_actions` | Google Search Console: manual actions or security issues | Turns the manual check `manual_actions` into an automatic one. Needs Search Console. | P0 | SEO |

### Checks whose priority is raised above the app's severity

P0 and P1 normally hold the app's critical and high checks, P2 its medium checks, and the weekly digest its low checks. These checks were placed higher on purpose:

| ID | App severity | Daily list | Reason |
|---|---|---|---|
| `sitemap_missing` | medium | P0 | Without a sitemap, Google finds new pages slowly |
| `sitemap_errors` | medium | P0 | A broken sitemap is ignored by Google |
| `sitemap_bad_urls` | medium | P1 | Sends Google to redirects and errors |
| `soft_404` | medium | P1 | Dead pages get indexed as empty pages |
| `js_dependent` | medium | P1 | Content Google may not see |
| `host_variant` | medium | P1 | Two copies of the whole site |
| `host_temporary_redirect` | low | P1 | A one-line server fix that affects the whole site |
| `eeat_about` | medium | P1 | Basic trust page |
| `eeat_contact` | medium | P1 | Basic trust page |
| `h1_multiple` | low | P2 | Grouped with the other heading checks |
