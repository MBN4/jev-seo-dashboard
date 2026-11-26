/**
 * Google guidelines checklist: every check AuditPilot runs, organised by the Google Search Central
 * guidance it comes from, written as plain-language rules.
 *
 * Sources: Google Search Essentials (technical requirements, spam policies, key best practices),
 * the SEO Starter Guide, "Creating helpful, reliable, people-first content", the page experience
 * and Core Web Vitals docs, and the structured data guidelines.
 */

export type CheckSource = "rule" | "extra" | "ai" | "pagespeed" | "dataforseo" | "manual";

export interface ChecklistItem {
  /** Check id as reported by the audit (engine rule, extra check, AI, PageSpeed or DataForSEO) */
  id: string;
  /** The rule, phrased as what a healthy site does */
  rule: string;
  /** Why Google cares, in one sentence */
  why: string;
  source: CheckSource;
  doc: string;
}

export interface ChecklistSection {
  key: string;
  title: string;
  summary: string;
  doc: string;
  items: ChecklistItem[];
}

const D = {
  essentials: "https://developers.google.com/search/docs/essentials",
  technical: "https://developers.google.com/search/docs/essentials/technical",
  spam: "https://developers.google.com/search/docs/essentials/spam-policies",
  starter: "https://developers.google.com/search/docs/fundamentals/seo-starter-guide",
  robots: "https://developers.google.com/search/docs/crawling-indexing/robots/intro",
  sitemaps: "https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview",
  http: "https://developers.google.com/search/docs/crawling-indexing/http-network-errors",
  redirects: "https://developers.google.com/search/docs/crawling-indexing/301-redirects",
  js: "https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics",
  links: "https://developers.google.com/search/docs/crawling-indexing/links-crawlable",
  noindex: "https://developers.google.com/search/docs/crawling-indexing/block-indexing",
  canonical: "https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls",
  softfour: "https://developers.google.com/search/docs/crawling-indexing/http-network-errors#soft-404-errors",
  url: "https://developers.google.com/search/docs/crawling-indexing/url-structure",
  title: "https://developers.google.com/search/docs/appearance/title-link",
  snippet: "https://developers.google.com/search/docs/appearance/snippet",
  helpful: "https://developers.google.com/search/docs/fundamentals/creating-helpful-content",
  dates: "https://developers.google.com/search/docs/appearance/publication-dates",
  images: "https://developers.google.com/search/docs/appearance/google-images",
  lazy: "https://developers.google.com/search/docs/crawling-indexing/javascript/lazy-loading",
  sd: "https://developers.google.com/search/docs/appearance/structured-data/sd-policies",
  sdIntro: "https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data",
  org: "https://developers.google.com/search/docs/appearance/structured-data/organization",
  breadcrumb: "https://developers.google.com/search/docs/appearance/structured-data/breadcrumb",
  article: "https://developers.google.com/search/docs/appearance/structured-data/article",
  local: "https://developers.google.com/search/docs/appearance/structured-data/local-business",
  faq: "https://developers.google.com/search/docs/appearance/structured-data/faqpage",
  pageexp: "https://developers.google.com/search/docs/appearance/page-experience",
  cwv: "https://developers.google.com/search/docs/appearance/core-web-vitals",
  https: "https://developers.google.com/search/docs/appearance/page-experience#https",
  mobile: "https://developers.google.com/search/docs/crawling-indexing/mobile/mobile-sites-mobile-first-indexing",
  intl: "https://developers.google.com/search/docs/specialty/international/localized-versions",
  ai: "https://developers.google.com/search/docs/appearance/ai-features",
  favicon: "https://developers.google.com/search/docs/appearance/favicon-in-search",
  og: "https://ogp.me/",
  sc: "https://support.google.com/webmasters/answer/9128668",
};

const i = (id: string, rule: string, why: string, source: CheckSource, doc: string): ChecklistItem => ({ id, rule, why, source, doc });

export const CHECKLIST: ChecklistSection[] = [
  {
    key: "crawl",
    title: "Google can find and crawl your pages",
    summary: "Search Essentials technical requirement: Googlebot must be able to reach your pages and discover them through links and sitemaps.",
    doc: D.technical,
    items: [
      i("robots_blocks_site", "robots.txt does not block Google from the site", "A site-wide Disallow removes every page from Google's crawl.", "rule", D.robots),
      i("robots_missing", "The site publishes a robots.txt file", "A robots.txt tells crawlers what to skip and where the sitemap is.", "rule", D.robots),
      i("sitemap_missing", "An XML sitemap is published and findable", "Sitemaps help Google discover every page you want indexed.", "rule", D.sitemaps),
      i("sitemap_errors", "Sitemap files load and are valid XML", "A broken sitemap is ignored, so pages may never be discovered.", "rule", D.sitemaps),
      i("sitemap_bad_urls", "The sitemap lists only live, indexable URLs", "Listing redirects, errors or noindex pages wastes crawl and sends mixed signals.", "rule", D.sitemaps),
      i("not_in_sitemap", "Every indexable page is in the sitemap", "Pages missing from the sitemap are found later or not at all.", "rule", D.sitemaps),
      i("http_errors", "Pages return HTTP 200, not errors", "Pages that error cannot be indexed and waste crawl budget.", "rule", D.http),
      i("soft_404", "Missing pages return a real 404", "A 'not found' page that returns 200 (soft 404) confuses indexing.", "rule", D.softfour),
      i("broken_internal_links", "Internal links point to working pages", "Broken links stop crawlers and visitors and waste link value.", "rule", D.links),
      i("redirect_chains", "Redirects take one hop, not chains", "Each extra hop slows crawling and can drop signals.", "rule", D.redirects),
      i("links_to_redirects", "Internal links point straight at the final URL", "Linking through redirects wastes crawl and slows pages.", "rule", D.redirects),
      i("js_dependent", "Main content is in the HTML, not only added by JavaScript", "Google renders JavaScript later and not always fully; HTML content is indexed reliably.", "rule", D.js),
      i("deep_pages", "Important pages are within three clicks of the homepage", "Deeply buried pages are crawled less often and look less important.", "rule", D.links),
      i("orphan_pages", "Every page is linked from somewhere on the site", "Pages with no internal links (orphans) are hard for Google to find and rank.", "rule", D.links),
    ],
  },
  {
    key: "index",
    title: "Your pages can be indexed, once",
    summary: "Google indexes one canonical version of each page. Indexing controls and duplicates decide which URL appears.",
    doc: D.canonical,
    items: [
      i("noindex", "Pages you want in Google are not marked noindex", "A noindex tag or header removes the page from search results.", "rule", D.noindex),
      i("canonical_missing", "Each page declares its canonical URL", "A canonical tells Google which URL to index when copies exist.", "rule", D.canonical),
      i("canonical_elsewhere", "Canonicals point to the page itself unless it is a deliberate duplicate", "A canonical to another URL asks Google to index that URL instead.", "rule", D.canonical),
      i("canonical_broken", "Canonical targets are live, not redirects or errors", "A broken canonical sends Google to a page that cannot be indexed.", "rule", D.canonical),
      i("host_variant", "Only one host version serves the site (www or non-www)", "Two live hosts split signals and create duplicates.", "rule", D.canonical),
      i("host_temporary_redirect", "Host and HTTPS redirects are permanent (301/308)", "Temporary redirects do not consolidate signals as reliably.", "rule", D.redirects),
      i("duplicate_content", "Pages have distinct main content", "Identical pages compete with each other; Google picks one and may ignore the rest.", "rule", D.canonical),
      i("url_uppercase", "URLs are lowercase", "URLs are case-sensitive; mixed case creates duplicate addresses.", "extra", D.url),
      i("url_underscores", "Words in URLs are separated by hyphens", "Google recommends hyphens so words are read separately.", "extra", D.url),
      i("url_long", "URLs are short and readable", "Simple, descriptive URLs are easier to understand and share.", "extra", D.url),
      i("url_params", "Indexable URLs avoid query parameters", "Parameters create many URL variants of the same content.", "extra", D.url),
    ],
  },
  {
    key: "titles",
    title: "Titles and snippets describe each page",
    summary: "Google builds the result's title link and snippet from your title tag, headings and meta description.",
    doc: D.title,
    items: [
      i("title_missing", "Every page has a title", "Without a title Google invents one, often poorly.", "rule", D.title),
      i("title_duplicate", "Every title is unique", "Duplicate titles make pages look interchangeable in results.", "rule", D.title),
      i("title_length", "Titles are a useful length", "Very short titles say too little; very long ones are cut off.", "rule", D.title),
      i("multiple_titles", "Each page has exactly one title element", "Several titles leave Google to guess.", "rule", D.title),
      i("ai_title_fit", "Titles accurately describe the page", "Google rewrites title links that do not match the page.", "ai", D.title),
      i("title_h1_mismatch", "The title and the main heading describe the same topic", "Consistent signals help Google choose a good title link.", "extra", D.title),
      i("meta_missing", "Every page has a meta description", "A good description is often used as the search snippet.", "rule", D.snippet),
      i("meta_duplicate", "Meta descriptions are unique", "Repeated descriptions make results look identical.", "rule", D.snippet),
      i("ai_meta_fit", "Meta descriptions summarise the page well", "A specific, accurate description earns clicks.", "ai", D.snippet),
    ],
  },
  {
    key: "keywords",
    title: "Pages target the searches you want",
    summary: "The SEO Starter Guide: use the words people search for, in the places that describe your page. (Needs focus keywords.)",
    doc: D.starter,
    items: [
      i("kw_no_page", "Every focus keyword has a page about it", "If no page covers a search, there is nothing to rank.", "extra", D.helpful),
      i("kw_title", "The focus keyword appears in the target page's title", "Titles are a strong signal of what the page is about.", "extra", D.title),
      i("kw_h1", "The focus keyword appears in the main heading", "Headings tell readers and Google the page topic.", "extra", D.starter),
      i("kw_url", "The focus keyword appears in the URL", "Descriptive URLs help users understand the page.", "extra", D.url),
      i("kw_meta", "The focus keyword appears in the meta description", "Matching words are highlighted in the snippet.", "extra", D.snippet),
      i("kw_intro", "The topic is stated in the opening text", "Readers (and Google) should know quickly they are in the right place.", "extra", D.helpful),
      i("kw_thin", "Keyword target pages cover the topic fully", "Thin pages rarely satisfy the search.", "extra", D.helpful),
    ],
  },
  {
    key: "content",
    title: "Helpful, reliable, people-first content (E-E-A-T)",
    summary: "Google rewards content made for people, showing experience, expertise, authoritativeness and trust.",
    doc: D.helpful,
    items: [
      i("ai_helpfulness", "Important pages fully satisfy the visitor", "Helpfulness is the core of Google's ranking systems.", "ai", D.helpful),
      i("ai_specificity", "Content shows first-hand, specific detail", "Generic text any competitor could publish shows little experience.", "ai", D.helpful),
      i("ai_trust", "Key pages show evidence of expertise and trust", "Trust is the most important part of E-E-A-T.", "ai", D.helpful),
      i("ai_value_prop", "The homepage makes the offer clear", "Visitors and Google should understand what you do at a glance.", "ai", D.helpful),
      i("ai_rewrite", "No pages need rewriting or merging", "Weak or overlapping pages dilute the site's quality.", "ai", D.helpful),
      i("ai_cannibalization", "Pages do not compete for the same searches", "Competing pages split signals; one page per need ranks better.", "ai", D.canonical),
      i("ai_next_step", "Commercial pages have a clear next step", "Helpful pages tell visitors what to do next.", "ai", D.helpful),
      i("thin_content", "Pages have substantial main content", "Very thin pages rarely help anyone.", "rule", D.helpful),
      i("h1_missing", "Every page has a main (H1) heading", "Headings structure the page for readers and Google.", "rule", D.starter),
      i("h1_multiple", "Each page has one main heading", "One clear H1 states the page's topic.", "rule", D.starter),
      i("heading_skips", "Headings follow a logical order", "Skipped levels make the outline harder to follow.", "rule", D.starter),
      i("readability_hard", "Text is easy to read", "Clear writing keeps visitors on the page.", "extra", D.helpful),
      i("eeat_about", "An About page says who is behind the site", "Google's guidance asks: is it clear who created the content?", "extra", D.helpful),
      i("eeat_contact", "A Contact page exists", "Easy contact is a basic trust signal.", "extra", D.helpful),
      i("eeat_contact_details", "Real contact details are visible", "An email, phone or address shows a real organisation.", "extra", D.helpful),
      i("eeat_privacy", "A privacy policy is published", "Visitors expect to know how their data is used.", "extra", D.helpful),
      i("eeat_terms", "Terms of service are published", "Clear terms add trust for transactional sites.", "extra", D.helpful),
      i("eeat_author", "Articles say who wrote them", "Bylines and author pages show expertise (the 'who' in E-E-A-T).", "extra", D.helpful),
      i("eeat_dates", "Articles show when they were published or updated", "Dates help readers judge freshness and help Google show a date.", "extra", D.dates),
      i("links_no_outbound", "Articles cite their sources", "Linking to evidence supports trustworthiness.", "extra", D.helpful),
      i("lang_missing", "Pages declare their language", "The lang attribute helps Google serve the right audience.", "rule", D.intl),
    ],
  },
  {
    key: "links",
    title: "Links are crawlable and descriptive",
    summary: "Google follows links to find pages and uses anchor text to understand them.",
    doc: D.links,
    items: [
      i("generic_anchors", "Link text describes the destination", "'Click here' tells Google nothing about the linked page.", "rule", D.links),
      i("links_internal_low", "Pages link to related pages", "Internal links spread discovery and context.", "extra", D.links),
      i("links_weak_inlinks", "Important pages receive several internal links", "Pages linked from one place look unimportant.", "extra", D.links),
      i("broken_external_links", "Outbound links work", "Broken outbound links hurt the reader's experience.", "rule", D.links),
    ],
  },
  {
    key: "images",
    title: "Images are understandable and fast",
    summary: "Google Images best practices: describe images with alt text and keep them light.",
    doc: D.images,
    items: [
      i("images_alt", "Images have alt text", "Alt text is how Google (and screen readers) understand images.", "rule", D.images),
      i("images_dimensions", "Images declare width and height", "Missing dimensions cause layout shift (a Core Web Vital).", "rule", D.cwv),
      i("images_lazy", "Below-the-fold images are lazy-loaded", "Lazy loading speeds up the first screen.", "extra", D.lazy),
    ],
  },
  {
    key: "structured",
    title: "Structured data is valid and complete",
    summary: "Structured data helps Google understand the page and can earn rich results, if it follows the guidelines.",
    doc: D.sdIntro,
    items: [
      i("no_structured_data", "The homepage has structured data", "Markup describes your organisation and site to Google.", "rule", D.sdIntro),
      i("jsonld_errors", "Structured data parses without errors", "Broken JSON-LD is ignored entirely.", "rule", D.sd),
      i("schema_required", "Markup includes the properties Google requires", "Missing required properties disqualify rich results.", "rule", D.sd),
      i("eeat_org_schema", "Organization markup identifies the business", "It feeds Google's understanding of who you are (logo, name, contact).", "extra", D.org),
      i("eeat_sameas", "Organization markup links your official profiles", "sameAs connects your site to your social and business profiles.", "extra", D.org),
      i("schema_breadcrumb", "Deeper pages have breadcrumb markup", "Breadcrumbs show your site structure in results.", "extra", D.breadcrumb),
      i("schema_article", "Articles have Article markup", "It gives Google the headline, author, image and dates.", "extra", D.article),
      i("ai_local_schema", "A local business uses LocalBusiness markup", "It supports local results with address and hours.", "ai", D.local),
      i("faq_rich_result_limited", "FAQ markup is used only where Google shows it", "FAQ rich results now appear only for government and health sites.", "rule", D.faq),
      i("og_missing", "Pages have Open Graph title and image", "Controls how links look when shared.", "rule", D.og),
      i("social_twitter_card", "Pages have an X (Twitter) card", "Shared links show a rich preview.", "extra", D.og),
    ],
  },
  {
    key: "experience",
    title: "Page experience: mobile, speed and security",
    summary: "Google's page experience guidance: mobile-friendly, fast (Core Web Vitals) and secure (HTTPS).",
    doc: D.pageexp,
    items: [
      i("viewport_missing", "Pages are set up for mobile (viewport tag)", "Google indexes the mobile version of your site.", "rule", D.mobile),
      i("cwv_field", "Real users get good Core Web Vitals on mobile", "LCP, INP and CLS measure loading, responsiveness and stability.", "pagespeed", D.cwv),
      i("lab_performance", "Lighthouse mobile performance is reasonable", "A lab test shows what slows the page down.", "pagespeed", D.cwv),
      i("slow_ttfb", "The server responds quickly (under 0.8 s)", "Slow servers delay everything else on the page.", "rule", D.cwv),
      i("heavy_html", "HTML documents are not oversized", "Very large pages load slowly on mobile.", "rule", D.cwv),
      i("no_https", "The site is served over HTTPS", "HTTPS is part of page experience and protects visitors.", "rule", D.https),
      i("mixed_content", "HTTPS pages load no insecure resources", "Mixed content breaks the secure padlock.", "rule", D.https),
      i("hsts_missing", "HTTPS is enforced with HSTS", "HSTS stops downgrades to insecure HTTP.", "rule", D.https),
      i("security_headers", "Common security headers are set", "They protect visitors from common attacks.", "rule", D.https),
      i("favicon_missing", "A favicon is declared", "Google shows it next to your result.", "rule", D.favicon),
    ],
  },
  {
    key: "international",
    title: "International and multilingual pages",
    summary: "Tell Google about translated or regional versions so the right one is shown.",
    doc: D.intl,
    items: [i("hreflang_issues", "hreflang annotations are complete and reciprocal", "Broken hreflang shows the wrong language to searchers.", "rule", D.intl)],
  },
  {
    key: "spam",
    title: "Spam policies are respected",
    summary: "Search Essentials spam policies. Breaking them can demote or remove a site.",
    doc: D.spam,
    items: [
      i("keyword_stuffing", "Text is not stuffed with repeated keywords", "Keyword stuffing is a named spam policy violation.", "extra", D.spam),
      i("kw_density_high", "Focus keywords are used naturally", "Unnatural repetition reads as stuffing.", "extra", D.spam),
      i("manual_cloaking", "Google and visitors see the same content (no cloaking)", "Showing different content to Google is a spam violation.", "manual", D.spam),
      i("manual_hidden", "No hidden text or links", "Text hidden for search engines is a spam violation.", "manual", D.spam),
      i("manual_doorways", "No doorway or scaled low-value pages", "Mass-produced pages made to rank are a spam violation.", "manual", D.spam),
      i("manual_actions", "No manual actions in Search Console", "A manual action removes or demotes pages until fixed.", "manual", D.sc),
    ],
  },
  {
    key: "ai",
    title: "Ready for AI features in Search",
    summary: "Google states AI Overviews need nothing beyond normal Search eligibility; clear, citable content helps everywhere.",
    doc: D.ai,
    items: [
      i("ai_bots_blocked", "AI crawlers are not blocked unintentionally", "Blocking them keeps your content out of AI answers.", "rule", D.ai),
      i("llms_txt_missing", "An llms.txt file is published (optional)", "An emerging convention; Google does not require it.", "rule", D.ai),
      i("ai_answer_first", "Pages lead with the answer", "Clear openings are easy to quote.", "ai", D.ai),
      i("ai_citable", "Pages contain self-contained, quotable facts", "Specific facts are what answers cite.", "ai", D.ai),
      i("ai_entity_clarity", "The homepage states who, what and where", "Clear identity helps systems describe you correctly.", "ai", D.ai),
      i("dfs_aio_not_cited", "AI Overviews cite your site where you rank", "Shows whether you appear in AI answers for your searches.", "dataforseo", D.ai),
    ],
  },
  {
    key: "visibility",
    title: "Search visibility and authority",
    summary: "How the site actually performs: rankings, keyword coverage and links from other sites. (Needs DataForSEO.)",
    doc: D.essentials,
    items: [
      i("dfs_striking", "Keywords close to page one are pushed over", "Small improvements there bring the fastest traffic gains.", "dataforseo", D.helpful),
      i("dfs_existing_page", "Existing pages cover the keywords they could win", "Expanding a page is cheaper than starting a new one.", "dataforseo", D.helpful),
      i("dfs_new_page", "Important searches have a page", "No page, no ranking.", "dataforseo", D.helpful),
      i("dfs_backlink_gap", "Referring domains are competitive", "Links from other sites are a key authority signal.", "dataforseo", D.links),
      i("dfs_broken_backlinks", "Backlinks point to live pages", "Links to broken pages are wasted.", "dataforseo", D.redirects),
    ],
  },
];

export const MANUAL_REASON = "Needs a human review or Google Search Console; it cannot be detected from a crawl.";

export type ItemStatus = "pass" | "fail" | "note" | "not_checked" | "manual";
