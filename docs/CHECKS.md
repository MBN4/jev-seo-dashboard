# Everything Rankora checks

This list is generated from Rankora's source code, so it matches exactly what an audit checks. Every audit runs through four layers:

1. **[Google guidelines checklist](#1-google-guidelines-checklist):** 108 rules in 13 areas, each mapped to Google Search Central guidance. It combines all the layers below into one list.
2. **[Extra checks](#2-extra-checks):** 31 more checks Rankora runs on the crawl data, including focus-keyword placement in the Rank Math style.
3. **[Site Explorer](#3-site-explorer-tabs-and-filters):** 15 tabs with 58 filters for every crawled URL, in the style of a desktop crawler.
4. **[Monitoring](#4-monitoring-change-checks):** daily re-audits plus change checks between audits.

The list ends with [what no crawler can check](#5-what-no-crawler-can-check).

**Where the checklist results come from:**

| Source | Rules | Runs when |
|---|---|---|
| Crawl check (engine) | 52 | Always |
| Extra check (Rankora) | 31 | Always (keyword checks need focus keywords) |
| AI judgment (needs TYPESAFE key) | 13 | A TYPESAFE_API_KEY is set |
| PageSpeed (needs free Google key) | 2 | A PageSpeed key is set (free) |
| DataForSEO (paid, optional) | 6 | Full mode is chosen (paid) |
| Manual review | 4 | Never automatic: listed so nothing is forgotten |

Each rule shows one status after an audit: **Passed**, **Needs work**, **Note** (information only), **Not checked** (the data source was off, with the reason), or **Manual check**.

## 1. Google guidelines checklist

### 1.1 Google can find and crawl your pages (14)

Search Essentials technical requirement: Googlebot must be able to reach your pages and discover them through links and sitemaps. [Google's guidance](https://developers.google.com/search/docs/essentials/technical)

| # | Rule | Why Google cares | Checked by | ID |
|---|---|---|---|---|
| 1 | [robots.txt does not block Google from the site](https://developers.google.com/search/docs/crawling-indexing/robots/intro) | A site-wide Disallow removes every page from Google's crawl. | Crawl check (engine) | `robots_blocks_site` |
| 2 | [The site publishes a robots.txt file](https://developers.google.com/search/docs/crawling-indexing/robots/intro) | A robots.txt tells crawlers what to skip and where the sitemap is. | Crawl check (engine) | `robots_missing` |
| 3 | [An XML sitemap is published and findable](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview) | Sitemaps help Google discover every page you want indexed. | Crawl check (engine) | `sitemap_missing` |
| 4 | [Sitemap files load and are valid XML](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview) | A broken sitemap is ignored, so pages may never be discovered. | Crawl check (engine) | `sitemap_errors` |
| 5 | [The sitemap lists only live, indexable URLs](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview) | Listing redirects, errors or noindex pages wastes crawl and sends mixed signals. | Crawl check (engine) | `sitemap_bad_urls` |
| 6 | [Every indexable page is in the sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview) | Pages missing from the sitemap are found later or not at all. | Crawl check (engine) | `not_in_sitemap` |
| 7 | [Pages return HTTP 200, not errors](https://developers.google.com/search/docs/crawling-indexing/http-network-errors) | Pages that error cannot be indexed and waste crawl budget. | Crawl check (engine) | `http_errors` |
| 8 | [Missing pages return a real 404](https://developers.google.com/search/docs/crawling-indexing/http-network-errors#soft-404-errors) | A 'not found' page that returns 200 (soft 404) confuses indexing. | Crawl check (engine) | `soft_404` |
| 9 | [Internal links point to working pages](https://developers.google.com/search/docs/crawling-indexing/links-crawlable) | Broken links stop crawlers and visitors and waste link value. | Crawl check (engine) | `broken_internal_links` |
| 10 | [Redirects take one hop, not chains](https://developers.google.com/search/docs/crawling-indexing/301-redirects) | Each extra hop slows crawling and can drop signals. | Crawl check (engine) | `redirect_chains` |
| 11 | [Internal links point straight at the final URL](https://developers.google.com/search/docs/crawling-indexing/301-redirects) | Linking through redirects wastes crawl and slows pages. | Crawl check (engine) | `links_to_redirects` |
| 12 | [Main content is in the HTML, not only added by JavaScript](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics) | Google renders JavaScript later and not always fully; HTML content is indexed reliably. | Crawl check (engine) | `js_dependent` |
| 13 | [Important pages are within three clicks of the homepage](https://developers.google.com/search/docs/crawling-indexing/links-crawlable) | Deeply buried pages are crawled less often and look less important. | Crawl check (engine) | `deep_pages` |
| 14 | [Every page is linked from somewhere on the site](https://developers.google.com/search/docs/crawling-indexing/links-crawlable) | Pages with no internal links (orphans) are hard for Google to find and rank. | Crawl check (engine) | `orphan_pages` |

### 1.2 Your pages can be indexed, once (11)

Google indexes one canonical version of each page. Indexing controls and duplicates decide which URL appears. [Google's guidance](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)

| # | Rule | Why Google cares | Checked by | ID |
|---|---|---|---|---|
| 15 | [Pages you want in Google are not marked noindex](https://developers.google.com/search/docs/crawling-indexing/block-indexing) | A noindex tag or header removes the page from search results. | Crawl check (engine) | `noindex` |
| 16 | [Each page declares its canonical URL](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) | A canonical tells Google which URL to index when copies exist. | Crawl check (engine) | `canonical_missing` |
| 17 | [Canonicals point to the page itself unless it is a deliberate duplicate](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) | A canonical to another URL asks Google to index that URL instead. | Crawl check (engine) | `canonical_elsewhere` |
| 18 | [Canonical targets are live, not redirects or errors](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) | A broken canonical sends Google to a page that cannot be indexed. | Crawl check (engine) | `canonical_broken` |
| 19 | [Only one host version serves the site (www or non-www)](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) | Two live hosts split signals and create duplicates. | Crawl check (engine) | `host_variant` |
| 20 | [Host and HTTPS redirects are permanent (301/308)](https://developers.google.com/search/docs/crawling-indexing/301-redirects) | Temporary redirects do not consolidate signals as reliably. | Crawl check (engine) | `host_temporary_redirect` |
| 21 | [Pages have distinct main content](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) | Identical pages compete with each other; Google picks one and may ignore the rest. | Crawl check (engine) | `duplicate_content` |
| 22 | [URLs are lowercase](https://developers.google.com/search/docs/crawling-indexing/url-structure) | URLs are case-sensitive; mixed case creates duplicate addresses. | Extra check (Rankora) | `url_uppercase` |
| 23 | [Words in URLs are separated by hyphens](https://developers.google.com/search/docs/crawling-indexing/url-structure) | Google recommends hyphens so words are read separately. | Extra check (Rankora) | `url_underscores` |
| 24 | [URLs are short and readable](https://developers.google.com/search/docs/crawling-indexing/url-structure) | Simple, descriptive URLs are easier to understand and share. | Extra check (Rankora) | `url_long` |
| 25 | [Indexable URLs avoid query parameters](https://developers.google.com/search/docs/crawling-indexing/url-structure) | Parameters create many URL variants of the same content. | Extra check (Rankora) | `url_params` |

### 1.3 Titles and snippets describe each page (9)

Google builds the result's title link and snippet from your title tag, headings and meta description. [Google's guidance](https://developers.google.com/search/docs/appearance/title-link)

| # | Rule | Why Google cares | Checked by | ID |
|---|---|---|---|---|
| 26 | [Every page has a title](https://developers.google.com/search/docs/appearance/title-link) | Without a title Google invents one, often poorly. | Crawl check (engine) | `title_missing` |
| 27 | [Every title is unique](https://developers.google.com/search/docs/appearance/title-link) | Duplicate titles make pages look interchangeable in results. | Crawl check (engine) | `title_duplicate` |
| 28 | [Titles are a useful length](https://developers.google.com/search/docs/appearance/title-link) | Very short titles say too little; very long ones are cut off. | Crawl check (engine) | `title_length` |
| 29 | [Each page has exactly one title element](https://developers.google.com/search/docs/appearance/title-link) | Several titles leave Google to guess. | Crawl check (engine) | `multiple_titles` |
| 30 | [Titles accurately describe the page](https://developers.google.com/search/docs/appearance/title-link) | Google rewrites title links that do not match the page. | AI judgment (needs TYPESAFE key) | `ai_title_fit` |
| 31 | [The title and the main heading describe the same topic](https://developers.google.com/search/docs/appearance/title-link) | Consistent signals help Google choose a good title link. | Extra check (Rankora) | `title_h1_mismatch` |
| 32 | [Every page has a meta description](https://developers.google.com/search/docs/appearance/snippet) | A good description is often used as the search snippet. | Crawl check (engine) | `meta_missing` |
| 33 | [Meta descriptions are unique](https://developers.google.com/search/docs/appearance/snippet) | Repeated descriptions make results look identical. | Crawl check (engine) | `meta_duplicate` |
| 34 | [Meta descriptions summarise the page well](https://developers.google.com/search/docs/appearance/snippet) | A specific, accurate description earns clicks. | AI judgment (needs TYPESAFE key) | `ai_meta_fit` |

### 1.4 Pages target the searches you want (7)

The SEO Starter Guide: use the words people search for, in the places that describe your page. (Needs focus keywords.) [Google's guidance](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)

| # | Rule | Why Google cares | Checked by | ID |
|---|---|---|---|---|
| 35 | [Every focus keyword has a page about it](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) | If no page covers a search, there is nothing to rank. | Extra check (Rankora) | `kw_no_page` |
| 36 | [The focus keyword appears in the target page's title](https://developers.google.com/search/docs/appearance/title-link) | Titles are a strong signal of what the page is about. | Extra check (Rankora) | `kw_title` |
| 37 | [The focus keyword appears in the main heading](https://developers.google.com/search/docs/fundamentals/seo-starter-guide) | Headings tell readers and Google the page topic. | Extra check (Rankora) | `kw_h1` |
| 38 | [The focus keyword appears in the URL](https://developers.google.com/search/docs/crawling-indexing/url-structure) | Descriptive URLs help users understand the page. | Extra check (Rankora) | `kw_url` |
| 39 | [The focus keyword appears in the meta description](https://developers.google.com/search/docs/appearance/snippet) | Matching words are highlighted in the snippet. | Extra check (Rankora) | `kw_meta` |
| 40 | [The topic is stated in the opening text](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) | Readers (and Google) should know quickly they are in the right place. | Extra check (Rankora) | `kw_intro` |
| 41 | [Keyword target pages cover the topic fully](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) | Thin pages rarely satisfy the search. | Extra check (Rankora) | `kw_thin` |

### 1.5 Helpful, reliable, people-first content (E-E-A-T) (21)

Google rewards content made for people, showing experience, expertise, authoritativeness and trust. [Google's guidance](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)

| # | Rule | Why Google cares | Checked by | ID |
|---|---|---|---|---|
| 42 | [Important pages fully satisfy the visitor](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) | Helpfulness is the core of Google's ranking systems. | AI judgment (needs TYPESAFE key) | `ai_helpfulness` |
| 43 | [Content shows first-hand, specific detail](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) | Generic text any competitor could publish shows little experience. | AI judgment (needs TYPESAFE key) | `ai_specificity` |
| 44 | [Key pages show evidence of expertise and trust](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) | Trust is the most important part of E-E-A-T. | AI judgment (needs TYPESAFE key) | `ai_trust` |
| 45 | [The homepage makes the offer clear](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) | Visitors and Google should understand what you do at a glance. | AI judgment (needs TYPESAFE key) | `ai_value_prop` |
| 46 | [No pages need rewriting or merging](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) | Weak or overlapping pages dilute the site's quality. | AI judgment (needs TYPESAFE key) | `ai_rewrite` |
| 47 | [Pages do not compete for the same searches](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) | Competing pages split signals; one page per need ranks better. | AI judgment (needs TYPESAFE key) | `ai_cannibalization` |
| 48 | [Commercial pages have a clear next step](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) | Helpful pages tell visitors what to do next. | AI judgment (needs TYPESAFE key) | `ai_next_step` |
| 49 | [Pages have substantial main content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) | Very thin pages rarely help anyone. | Crawl check (engine) | `thin_content` |
| 50 | [Every page has a main (H1) heading](https://developers.google.com/search/docs/fundamentals/seo-starter-guide) | Headings structure the page for readers and Google. | Crawl check (engine) | `h1_missing` |
| 51 | [Each page has one main heading](https://developers.google.com/search/docs/fundamentals/seo-starter-guide) | One clear H1 states the page's topic. | Crawl check (engine) | `h1_multiple` |
| 52 | [Headings follow a logical order](https://developers.google.com/search/docs/fundamentals/seo-starter-guide) | Skipped levels make the outline harder to follow. | Crawl check (engine) | `heading_skips` |
| 53 | [Text is easy to read](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) | Clear writing keeps visitors on the page. | Extra check (Rankora) | `readability_hard` |
| 54 | [An About page says who is behind the site](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) | Google's guidance asks: is it clear who created the content? | Extra check (Rankora) | `eeat_about` |
| 55 | [A Contact page exists](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) | Easy contact is a basic trust signal. | Extra check (Rankora) | `eeat_contact` |
| 56 | [Real contact details are visible](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) | An email, phone or address shows a real organisation. | Extra check (Rankora) | `eeat_contact_details` |
| 57 | [A privacy policy is published](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) | Visitors expect to know how their data is used. | Extra check (Rankora) | `eeat_privacy` |
| 58 | [Terms of service are published](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) | Clear terms add trust for transactional sites. | Extra check (Rankora) | `eeat_terms` |
| 59 | [Articles say who wrote them](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) | Bylines and author pages show expertise (the 'who' in E-E-A-T). | Extra check (Rankora) | `eeat_author` |
| 60 | [Articles show when they were published or updated](https://developers.google.com/search/docs/appearance/publication-dates) | Dates help readers judge freshness and help Google show a date. | Extra check (Rankora) | `eeat_dates` |
| 61 | [Articles cite their sources](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) | Linking to evidence supports trustworthiness. | Extra check (Rankora) | `links_no_outbound` |
| 62 | [Pages declare their language](https://developers.google.com/search/docs/specialty/international/localized-versions) | The lang attribute helps Google serve the right audience. | Crawl check (engine) | `lang_missing` |

### 1.6 Links are crawlable and descriptive (4)

Google follows links to find pages and uses anchor text to understand them. [Google's guidance](https://developers.google.com/search/docs/crawling-indexing/links-crawlable)

| # | Rule | Why Google cares | Checked by | ID |
|---|---|---|---|---|
| 63 | [Link text describes the destination](https://developers.google.com/search/docs/crawling-indexing/links-crawlable) | 'Click here' tells Google nothing about the linked page. | Crawl check (engine) | `generic_anchors` |
| 64 | [Pages link to related pages](https://developers.google.com/search/docs/crawling-indexing/links-crawlable) | Internal links spread discovery and context. | Extra check (Rankora) | `links_internal_low` |
| 65 | [Important pages receive several internal links](https://developers.google.com/search/docs/crawling-indexing/links-crawlable) | Pages linked from one place look unimportant. | Extra check (Rankora) | `links_weak_inlinks` |
| 66 | [Outbound links work](https://developers.google.com/search/docs/crawling-indexing/links-crawlable) | Broken outbound links hurt the reader's experience. | Crawl check (engine) | `broken_external_links` |

### 1.7 Images are understandable and fast (3)

Google Images best practices: describe images with alt text and keep them light. [Google's guidance](https://developers.google.com/search/docs/appearance/google-images)

| # | Rule | Why Google cares | Checked by | ID |
|---|---|---|---|---|
| 67 | [Images have alt text](https://developers.google.com/search/docs/appearance/google-images) | Alt text is how Google (and screen readers) understand images. | Crawl check (engine) | `images_alt` |
| 68 | [Images declare width and height](https://developers.google.com/search/docs/appearance/core-web-vitals) | Missing dimensions cause layout shift (a Core Web Vital). | Crawl check (engine) | `images_dimensions` |
| 69 | [Below-the-fold images are lazy-loaded](https://developers.google.com/search/docs/crawling-indexing/javascript/lazy-loading) | Lazy loading speeds up the first screen. | Extra check (Rankora) | `images_lazy` |

### 1.8 Structured data is valid and complete (11)

Structured data helps Google understand the page and can earn rich results, if it follows the guidelines. [Google's guidance](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data)

| # | Rule | Why Google cares | Checked by | ID |
|---|---|---|---|---|
| 70 | [The homepage has structured data](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data) | Markup describes your organisation and site to Google. | Crawl check (engine) | `no_structured_data` |
| 71 | [Structured data parses without errors](https://developers.google.com/search/docs/appearance/structured-data/sd-policies) | Broken JSON-LD is ignored entirely. | Crawl check (engine) | `jsonld_errors` |
| 72 | [Markup includes the properties Google requires](https://developers.google.com/search/docs/appearance/structured-data/sd-policies) | Missing required properties disqualify rich results. | Crawl check (engine) | `schema_required` |
| 73 | [Organization markup identifies the business](https://developers.google.com/search/docs/appearance/structured-data/organization) | It feeds Google's understanding of who you are (logo, name, contact). | Extra check (Rankora) | `eeat_org_schema` |
| 74 | [Organization markup links your official profiles](https://developers.google.com/search/docs/appearance/structured-data/organization) | sameAs connects your site to your social and business profiles. | Extra check (Rankora) | `eeat_sameas` |
| 75 | [Deeper pages have breadcrumb markup](https://developers.google.com/search/docs/appearance/structured-data/breadcrumb) | Breadcrumbs show your site structure in results. | Extra check (Rankora) | `schema_breadcrumb` |
| 76 | [Articles have Article markup](https://developers.google.com/search/docs/appearance/structured-data/article) | It gives Google the headline, author, image and dates. | Extra check (Rankora) | `schema_article` |
| 77 | [A local business uses LocalBusiness markup](https://developers.google.com/search/docs/appearance/structured-data/local-business) | It supports local results with address and hours. | AI judgment (needs TYPESAFE key) | `ai_local_schema` |
| 78 | [FAQ markup is used only where Google shows it](https://developers.google.com/search/docs/appearance/structured-data/faqpage) | FAQ rich results now appear only for government and health sites. | Crawl check (engine) | `faq_rich_result_limited` |
| 79 | [Pages have Open Graph title and image](https://ogp.me/) | Controls how links look when shared. | Crawl check (engine) | `og_missing` |
| 80 | [Pages have an X (Twitter) card](https://ogp.me/) | Shared links show a rich preview. | Extra check (Rankora) | `social_twitter_card` |

### 1.9 Page experience: mobile, speed and security (10)

Google's page experience guidance: mobile-friendly, fast (Core Web Vitals) and secure (HTTPS). [Google's guidance](https://developers.google.com/search/docs/appearance/page-experience)

| # | Rule | Why Google cares | Checked by | ID |
|---|---|---|---|---|
| 81 | [Pages are set up for mobile (viewport tag)](https://developers.google.com/search/docs/crawling-indexing/mobile/mobile-sites-mobile-first-indexing) | Google indexes the mobile version of your site. | Crawl check (engine) | `viewport_missing` |
| 82 | [Real users get good Core Web Vitals on mobile](https://developers.google.com/search/docs/appearance/core-web-vitals) | LCP, INP and CLS measure loading, responsiveness and stability. | PageSpeed (needs free Google key) | `cwv_field` |
| 83 | [Lighthouse mobile performance is reasonable](https://developers.google.com/search/docs/appearance/core-web-vitals) | A lab test shows what slows the page down. | PageSpeed (needs free Google key) | `lab_performance` |
| 84 | [The server responds quickly (under 0.8 s)](https://developers.google.com/search/docs/appearance/core-web-vitals) | Slow servers delay everything else on the page. | Crawl check (engine) | `slow_ttfb` |
| 85 | [HTML documents are not oversized](https://developers.google.com/search/docs/appearance/core-web-vitals) | Very large pages load slowly on mobile. | Crawl check (engine) | `heavy_html` |
| 86 | [The site is served over HTTPS](https://developers.google.com/search/docs/appearance/page-experience#https) | HTTPS is part of page experience and protects visitors. | Crawl check (engine) | `no_https` |
| 87 | [HTTPS pages load no insecure resources](https://developers.google.com/search/docs/appearance/page-experience#https) | Mixed content breaks the secure padlock. | Crawl check (engine) | `mixed_content` |
| 88 | [HTTPS is enforced with HSTS](https://developers.google.com/search/docs/appearance/page-experience#https) | HSTS stops downgrades to insecure HTTP. | Crawl check (engine) | `hsts_missing` |
| 89 | [Common security headers are set](https://developers.google.com/search/docs/appearance/page-experience#https) | They protect visitors from common attacks. | Crawl check (engine) | `security_headers` |
| 90 | [A favicon is declared](https://developers.google.com/search/docs/appearance/favicon-in-search) | Google shows it next to your result. | Crawl check (engine) | `favicon_missing` |

### 1.10 International and multilingual pages (1)

Tell Google about translated or regional versions so the right one is shown. [Google's guidance](https://developers.google.com/search/docs/specialty/international/localized-versions)

| # | Rule | Why Google cares | Checked by | ID |
|---|---|---|---|---|
| 91 | [hreflang annotations are complete and reciprocal](https://developers.google.com/search/docs/specialty/international/localized-versions) | Broken hreflang shows the wrong language to searchers. | Crawl check (engine) | `hreflang_issues` |

### 1.11 Spam policies are respected (6)

Search Essentials spam policies. Breaking them can demote or remove a site. [Google's guidance](https://developers.google.com/search/docs/essentials/spam-policies)

| # | Rule | Why Google cares | Checked by | ID |
|---|---|---|---|---|
| 92 | [Text is not stuffed with repeated keywords](https://developers.google.com/search/docs/essentials/spam-policies) | Keyword stuffing is a named spam policy violation. | Extra check (Rankora) | `keyword_stuffing` |
| 93 | [Focus keywords are used naturally](https://developers.google.com/search/docs/essentials/spam-policies) | Unnatural repetition reads as stuffing. | Extra check (Rankora) | `kw_density_high` |
| 94 | [Google and visitors see the same content (no cloaking)](https://developers.google.com/search/docs/essentials/spam-policies) | Showing different content to Google is a spam violation. | Manual review | `manual_cloaking` |
| 95 | [No hidden text or links](https://developers.google.com/search/docs/essentials/spam-policies) | Text hidden for search engines is a spam violation. | Manual review | `manual_hidden` |
| 96 | [No doorway or scaled low-value pages](https://developers.google.com/search/docs/essentials/spam-policies) | Mass-produced pages made to rank are a spam violation. | Manual review | `manual_doorways` |
| 97 | [No manual actions in Search Console](https://support.google.com/webmasters/answer/9128668) | A manual action removes or demotes pages until fixed. | Manual review | `manual_actions` |

### 1.12 Ready for AI features in Search (6)

Google states AI Overviews need nothing beyond normal Search eligibility; clear, citable content helps everywhere. [Google's guidance](https://developers.google.com/search/docs/appearance/ai-features)

| # | Rule | Why Google cares | Checked by | ID |
|---|---|---|---|---|
| 98 | [AI crawlers are not blocked unintentionally](https://developers.google.com/search/docs/appearance/ai-features) | Blocking them keeps your content out of AI answers. | Crawl check (engine) | `ai_bots_blocked` |
| 99 | [An llms.txt file is published (optional)](https://developers.google.com/search/docs/appearance/ai-features) | An emerging convention; Google does not require it. | Crawl check (engine) | `llms_txt_missing` |
| 100 | [Pages lead with the answer](https://developers.google.com/search/docs/appearance/ai-features) | Clear openings are easy to quote. | AI judgment (needs TYPESAFE key) | `ai_answer_first` |
| 101 | [Pages contain self-contained, quotable facts](https://developers.google.com/search/docs/appearance/ai-features) | Specific facts are what answers cite. | AI judgment (needs TYPESAFE key) | `ai_citable` |
| 102 | [The homepage states who, what and where](https://developers.google.com/search/docs/appearance/ai-features) | Clear identity helps systems describe you correctly. | AI judgment (needs TYPESAFE key) | `ai_entity_clarity` |
| 103 | [AI Overviews cite your site where you rank](https://developers.google.com/search/docs/appearance/ai-features) | Shows whether you appear in AI answers for your searches. | DataForSEO (paid, optional) | `dfs_aio_not_cited` |

### 1.13 Search visibility and authority (5)

How the site actually performs: rankings, keyword coverage and links from other sites. (Needs DataForSEO.) [Google's guidance](https://developers.google.com/search/docs/essentials)

| # | Rule | Why Google cares | Checked by | ID |
|---|---|---|---|---|
| 104 | [Keywords close to page one are pushed over](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) | Small improvements there bring the fastest traffic gains. | DataForSEO (paid, optional) | `dfs_striking` |
| 105 | [Existing pages cover the keywords they could win](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) | Expanding a page is cheaper than starting a new one. | DataForSEO (paid, optional) | `dfs_existing_page` |
| 106 | [Important searches have a page](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) | No page, no ranking. | DataForSEO (paid, optional) | `dfs_new_page` |
| 107 | [Referring domains are competitive](https://developers.google.com/search/docs/crawling-indexing/links-crawlable) | Links from other sites are a key authority signal. | DataForSEO (paid, optional) | `dfs_backlink_gap` |
| 108 | [Backlinks point to live pages](https://developers.google.com/search/docs/crawling-indexing/301-redirects) | Links to broken pages are wasted. | DataForSEO (paid, optional) | `dfs_broken_backlinks` |

## 2. Extra checks

Rankora runs these on the saved crawl data. They show on the **Extra Checks** tab, and also inside the Google checklist above. Checks marked *heuristic* are a rule of thumb, so confirm each case before acting. The keyword checks run once you add focus keywords to the audit.

### Focus keywords (Rank Math style) (9)

| # | Check | Severity | How to fix | Notes |
|---|---|---|---|---|
| 1 | No page mentions this focus keyword | High | Create a page for the keyword (or add it to the closest existing page) with the keyword in its title, H1 and URL. | needs focus keywords, heuristic, [Google doc](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) |
| 2 | Focus keyword missing from the page title | Medium | Name the topic in the title in the words searchers use, near the start. | needs focus keywords, [Google doc](https://developers.google.com/search/docs/appearance/title-link) |
| 3 | Focus keyword missing from the H1 | Medium | Make the main heading say what the page is about using the keyword or a close variant. | needs focus keywords, heuristic, [Google doc](https://developers.google.com/search/docs/fundamentals/seo-starter-guide) |
| 4 | Focus keyword missing from the URL | Low | Use a short, descriptive slug that contains the keyword (only for new pages; do not change live URLs without a redirect). | needs focus keywords, heuristic, [Google doc](https://developers.google.com/search/docs/crawling-indexing/url-structure) |
| 5 | Focus keyword missing from the meta description | Low | Write a specific summary that mentions the keyword; Google may show it as the snippet. | needs focus keywords, heuristic, [Google doc](https://developers.google.com/search/docs/appearance/snippet) |
| 6 | Focus keyword not in the opening text | Low | Mention the topic in the first paragraph so readers know they are in the right place. | needs focus keywords, heuristic, SEO-plugin convention, not a Google rule |
| 7 | Focus keyword repeated too often (possible stuffing) | Medium | Write naturally; replace repetitions with synonyms and useful detail. Keyword stuffing is against Google's spam policies. | needs focus keywords, heuristic, [Google doc](https://developers.google.com/search/docs/essentials/spam-policies#keyword-stuffing) |
| 8 | Keyword target page has little content | Low | Cover the topic fully: questions, specifics, examples. Length itself is not a ranking factor; completeness is. | needs focus keywords, heuristic, [Google doc](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) |
| 9 | Title and H1 describe different topics | Low | Align the title and the main heading so both name the page's topic. | heuristic, [Google doc](https://developers.google.com/search/docs/appearance/title-link) |

### Content (2)

| # | Check | Severity | How to fix | Notes |
|---|---|---|---|---|
| 10 | One word dominates the text (possible keyword stuffing) | Low | Rewrite repetitive passages naturally. Repeating keywords unnaturally is a spam signal. | heuristic, [Google doc](https://developers.google.com/search/docs/essentials/spam-policies#keyword-stuffing) |
| 11 | Text that is hard to read | Low | Shorten sentences and paragraphs and prefer common words. (Readability is not a ranking factor; it affects whether visitors stay.) | heuristic, SEO-plugin convention, not a Google rule |

### URL structure (4)

| # | Check | Severity | How to fix | Notes |
|---|---|---|---|---|
| 12 | URLs with uppercase letters | Low | Use lowercase URLs and redirect old variants; URLs are case-sensitive and can create duplicates. | [Google doc](https://developers.google.com/search/docs/crawling-indexing/url-structure) |
| 13 | URLs use underscores instead of hyphens | Low | Google recommends hyphens to separate words in URLs. | [Google doc](https://developers.google.com/search/docs/crawling-indexing/url-structure) |
| 14 | Very long URLs | Low | Keep URLs short and readable; remove dates, IDs and filler words from new slugs. | heuristic, [Google doc](https://developers.google.com/search/docs/crawling-indexing/url-structure) |
| 15 | Indexable URLs with query parameters | Low | Prefer clean paths; canonicalise parameter variants to the clean URL. | [Google doc](https://developers.google.com/search/docs/crawling-indexing/url-structure) |

### E-E-A-T and trust (9)

| # | Check | Severity | How to fix | Notes |
|---|---|---|---|---|
| 16 | No About page found | Medium | Publish an About page (who you are, history, team, credentials) and link it from the navigation or footer. | heuristic, [Google doc](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) |
| 17 | No Contact page found | Medium | Publish a Contact page with real contact details and link it site-wide. | heuristic, [Google doc](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) |
| 18 | No email, phone or address visible | Low | Show at least one direct contact method (email, phone or address) on the homepage or Contact page. | heuristic, [Google doc](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) |
| 19 | No privacy policy found | Low | Publish a privacy policy and link it from the footer. | heuristic, SEO-plugin convention, not a Google rule |
| 20 | No terms page found | Info | Publish terms of service if you sell or offer accounts. | heuristic, SEO-plugin convention, not a Google rule |
| 21 | Articles without a visible or structured author | Medium | Add a byline linking to an author page, and an author property in Article structured data. | [Google doc](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) |
| 22 | Articles without a publish or update date | Low | Show the date visibly and add datePublished / dateModified to Article structured data. | [Google doc](https://developers.google.com/search/docs/appearance/publication-dates) |
| 23 | No Organization structured data | Low | Add Organization (or LocalBusiness) JSON-LD on the homepage with name, logo, url and contact point. | [Google doc](https://developers.google.com/search/docs/appearance/structured-data/organization) |
| 24 | Organization markup without sameAs profiles | Low | Add sameAs links to your official social and business profiles so Google can connect your entity. | [Google doc](https://developers.google.com/search/docs/appearance/structured-data/organization) |

### Structured data (2)

| # | Check | Severity | How to fix | Notes |
|---|---|---|---|---|
| 25 | Deeper pages without BreadcrumbList markup | Low | Add BreadcrumbList JSON-LD (and visible breadcrumbs) on pages below the top level. | [Google doc](https://developers.google.com/search/docs/appearance/structured-data/breadcrumb) |
| 26 | Articles without Article markup | Low | Add Article or BlogPosting JSON-LD with headline, author, image and dates. | [Google doc](https://developers.google.com/search/docs/appearance/structured-data/article) |

### Internal links (3)

| # | Check | Severity | How to fix | Notes |
|---|---|---|---|---|
| 27 | Pages with very few internal links | Low | Link to related pages with descriptive anchors so visitors and crawlers can continue. | heuristic, [Google doc](https://developers.google.com/search/docs/crawling-indexing/links-crawlable) |
| 28 | Pages linked from only one other page | Low | Add contextual links to important pages from related content. | heuristic, [Google doc](https://developers.google.com/search/docs/crawling-indexing/links-crawlable) |
| 29 | Articles that cite no external sources | Info | Link to authoritative sources that support your claims; it helps readers trust the content. | heuristic, [Google doc](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) |

### Images (1)

| # | Check | Severity | How to fix | Notes |
|---|---|---|---|---|
| 30 | Image-heavy pages without lazy loading | Low | Add loading="lazy" to images below the first screen (never to the main above-the-fold image). | [Google doc](https://developers.google.com/search/docs/crawling-indexing/javascript/lazy-loading) |

### Social sharing (1)

| # | Check | Severity | How to fix | Notes |
|---|---|---|---|---|
| 31 | No X (Twitter) card markup | Info | Add twitter:card (summary_large_image) so shared links show a preview. | heuristic, [Google doc](https://developer.x.com/en/docs/x-for-websites/cards/overview/abouts-cards) |

## 3. Site Explorer tabs and filters

Every crawled URL, in a spreadsheet-style view. Each filter counts the URLs that match it, and you can export it as CSV. The kinds are: **Issue** (fix it), **Warning** (check it), **Opportunity** (could be better) and **Info** (just a view).

### Internal (4)

| Filter | Kind | What it finds |
|---|---|---|
| HTML pages | Info | Pages returning HTML with status 200. |
| Indexable | Info | HTML pages Google may index. |
| Non-indexable | Warning | Not indexable: noindex, canonicalised elsewhere, redirect or error. |
| Indexable, not in sitemap | Opportunity | Indexable pages missing from the XML sitemap. |

### Response codes (7)

| Filter | Kind | What it finds |
|---|---|---|
| Success (2xx) | Info | Pages that load. |
| Redirection (3xx) | Warning | URLs that redirect; link to the final URL instead. |
| Redirect chains | Issue | More than one hop before the final page. |
| Client error (4xx) | Issue | Broken pages (e.g. 404). Fix or redirect them and update links. |
| Server error (5xx) | Issue | The server failed. Google retries, then drops the page. |
| Blocked by robots.txt | Warning | Google is not allowed to crawl these URLs. |
| No response | Issue | Timed out or unreachable. |

### Page titles (6)

| Filter | Kind | What it finds |
|---|---|---|
| Missing | Issue | No title: Google will invent one. |
| Duplicate | Issue | The same title on several pages. |
| Over 60 characters | Opportunity | Likely truncated in results. |
| Below 30 characters | Opportunity | Too short to describe the page well. |
| Same as H1 | Info | Title identical to the H1 (fine, but a chance to add context). |
| Multiple | Issue | More than one title element. |

### Meta description (4)

| Filter | Kind | What it finds |
|---|---|---|
| Missing | Issue | No description: Google picks text from the page. |
| Duplicate | Warning | The same description on several pages. |
| Over 155 characters | Opportunity | Likely truncated in results. |
| Below 70 characters | Opportunity | Room to summarise the page better. |

### H1 (4)

| Filter | Kind | What it finds |
|---|---|---|
| Missing | Issue | No main heading. |
| Duplicate | Warning | The same H1 on several pages. |
| Over 70 characters | Opportunity | Long headings are hard to scan. |
| Multiple | Warning | More than one H1. |

### H2 (4)

| Filter | Kind | What it finds |
|---|---|---|
| Missing | Opportunity | No subheadings to structure the content. |
| Duplicate | Info | The same first H2 on several pages. |
| Over 70 characters | Opportunity | Long subheadings are hard to scan. |
| Non-sequential | Warning | Heading levels are skipped (e.g. H2 to H4). |

### Images (3)

| Filter | Kind | What it finds |
|---|---|---|
| Missing alt text | Issue | Google and screen readers cannot understand these images. |
| Missing size attributes | Opportunity | Width/height prevent layout shift (CLS). |
| Many images, none lazy-loaded | Opportunity | Lazy-load images below the first screen. |

### Canonicals (4)

| Filter | Kind | What it finds |
|---|---|---|
| Missing | Warning | No canonical declared. |
| Self-referencing | Info | Canonical points to the page itself (good). |
| Canonicalised | Warning | Canonical points to another URL, so this page is not indexed. |
| Canonical target broken or redirected | Issue | The canonical points to a URL that is not a live 200 page. |

### Directives (3)

| Filter | Kind | What it finds |
|---|---|---|
| Noindex | Warning | Excluded from Google's index. |
| Nofollow | Warning | Google is asked not to follow links on the page. |
| No directives | Info | No robots meta tag or header (defaults to index, follow). |

### Links (6)

| Filter | Kind | What it finds |
|---|---|---|
| Links to broken pages | Issue | This page links to URLs that return errors. |
| No internal inlinks | Issue | Nothing links here; Google finds it only through the sitemap. |
| Only one inlink | Warning | Weakly linked pages look unimportant. |
| No internal outlinks | Warning | Dead end for visitors and crawlers. |
| Over 100 internal outlinks | Info | Very link-heavy pages dilute each link. |
| Deeper than 3 clicks | Warning | Hard to reach from the homepage. |

### Structured data (3)

| Filter | Kind | What it finds |
|---|---|---|
| Contains structured data | Info | Pages with JSON-LD. |
| Missing | Opportunity | No structured data: a chance for rich results. |
| Parse errors | Issue | Broken JSON-LD is ignored by Google. |

### Content (2)

| Filter | Kind | What it finds |
|---|---|---|
| Low content (under 200 words) | Opportunity | Thin pages rarely satisfy a search. |
| Exact duplicates | Issue | Identical main text on several URLs. |

### Security (3)

| Filter | Kind | What it finds |
|---|---|---|
| HTTP URLs | Issue | Pages served without HTTPS. |
| Mixed content | Issue | HTTPS pages loading insecure resources. |
| Missing HSTS | Warning | No Strict-Transport-Security header. |

### Hreflang (2)

| Filter | Kind | What it finds |
|---|---|---|
| Contains hreflang | Info | Pages with language alternates. |
| Missing (site uses hreflang) | Warning | Other pages declare alternates but this one does not. |

### Social (3)

| Filter | Kind | What it finds |
|---|---|---|
| Missing OG title | Opportunity | Shared links fall back to page text. |
| Missing OG image | Opportunity | Shared links show no image. |
| Missing X card | Info | No twitter:card tag. |

## 4. Monitoring change checks

For each monitored site (emailverify.io, clustox.com, mycoldinbox.com, inboxwarm.ai and tellbear.com, plus any you add):

**Every 3 hours, without a crawl,** Rankora compares:

| Checked | Reported as |
|---|---|
| Homepage HTTP status | changed status |
| Homepage title | before and after |
| Homepage meta description | before and after |
| Homepage H1 | before and after |
| Homepage canonical | before and after |
| Homepage meta robots (noindex) | before and after |
| Sitemap URL list | new pages added, pages removed |

**After every audit (daily by default),** it compares with the previous audit:

| Compared | Reported as |
|---|---|
| Overall score and grade | up or down by N |
| Issues | new problems, got worse (more pages), improved, fixed |
| Page status | pages now broken (200 → 4xx/5xx), pages working again |
| Page titles | each changed title, before and after |
| Meta descriptions | each changed description, before and after |
| Indexing | pages that became noindex, or stopped being noindex |
| Page text | pages whose main text changed |
| Coverage | new pages found, pages not reached this time |
| What to do next | the most important open actions, with probably-intended issues marked |

## 5. What no crawler can check

These matter for Google, but no automated audit can measure them. Rankora lists them so they are not forgotten.

| Topic | Why it can't be checked automatically |
|---|---|
| Image formats and file sizes (WebP/AVIF) | The engine records image counts, not image files; PageSpeed opportunities cover this when a key is set. |
| Keyword in image alt text | Alt text values are not saved, only whether alt is missing. |
| Compression and cache headers | Only security headers are saved from responses. |
| Content freshness (how old dates are) | Structured data dates are saved as present/absent, not their values. |
| Intrusive pop-ups, ads above the fold, hidden text, cloaking | Needs a rendered visual check and comparison with what Googlebot sees. |
| Real rankings, clicks, impressions, indexing status | Needs Google Search Console (or DataForSEO for rankings). |
| Backlink quality and brand mentions | Needs DataForSEO full mode. |
| Google Business Profile, reviews, NAP consistency | External listings are not crawled. |

The checklist also has its own **Manual check** rules: Needs a human review or Google Search Console; it cannot be detected from a crawl.

