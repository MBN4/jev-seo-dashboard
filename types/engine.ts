/**
 * AuditPilot's audit model. It mirrors the audit engine's audit.json (schema_version 1.0) after
 * lib/server/engine-adapter.ts has translated engine-specific names (AI block, check-id and
 * action-id prefixes) into AuditPilot's. Fields the engine may omit are optional.
 */

export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type Priority = "P1" | "P2" | "P3";

export interface EngineFinding {
  id: string;
  origin: "rule" | "ai" | "dataforseo" | "extra" | string;
  category: string;
  severity: Severity;
  title: string;
  fix: string;
  source?: string;
  effort: number;
  heuristic?: boolean;
  urls: string[];
  count: number;
  evidence: string;
  detail?: Record<string, unknown>;
  needs_review?: number;
}

export interface EngineAction extends Omit<EngineFinding, "detail"> {
  action_id: string;
  priority: Priority;
  impact: number;
  quick_win: boolean;
  importance: number | null;
  needs_review: number;
  status?: string;
}

export interface EngineScores {
  overall: number;
  grade: string;
  partial?: string[];
  categories: Record<string, number | null>;
  category_names: Record<string, string>;
  weights: Record<string, number>;
  notes?: Record<string, string>;
  caps?: string[];
  completeness: {
    categories_scored: number;
    categories_total: number;
    ai: boolean;
    ai_pages_not_judged?: number;
    pagespeed: boolean;
    dataforseo: boolean;
  };
}

export interface EnginePage {
  url: string;
  final_url?: string;
  kind?: string;
  status?: number | null;
  error?: string;
  depth?: number;
  inlinks?: number;
  in_sitemap?: boolean;
  fetched_at?: string;
  fetch_ms?: number;
  ttfb_ms?: number;
  bytes?: number;
  content_type?: string;
  redirect_chain?: Array<unknown>;
  x_robots?: string | null;
  rendered?: boolean;
  js_dependent?: boolean;
  title?: string | null;
  title_count?: number;
  meta_description?: string | null;
  meta_robots?: string | null;
  canonical?: string | null;
  lang?: string | null;
  viewport?: string | null;
  og?: Record<string, string | null>;
  twitter_card?: string | null;
  hreflang?: Array<unknown>;
  h1?: string[];
  h2?: string[];
  h3?: string[];
  /** "h2: Heading text" strings, in document order */
  outline?: string[];
  heading_skips?: number;
  word_count?: number;
  raw_word_count?: number;
  text_excerpt?: string;
  schema_types?: string[];
  images?: {
    total: number;
    missing_alt: number;
    empty_alt?: number;
    lazy?: number;
    no_dimensions?: number;
    missing_alt_samples?: string[];
  };
  links_internal?: Array<{ url: string; anchor: string }>;
  links_external?: Array<{ url: string; anchor: string }>;
  schema_errors?: string[];
  /** JSON-LD node summaries: types and the property names present (values are not stored) */
  schema_nodes?: Array<{ types: string[]; keys: string[] }>;
  script_count?: number;
  mixed_content?: string[];
  calls_to_action?: string[];
  nav_labels?: string[];
  nofollow_links?: number;
  [k: string]: unknown;
}

export interface AiAnswer {
  type: "choice" | "score" | "noul" | string;
  value: string | number;
  band?: string;
  confidence?: number;
  probabilities?: Record<string, number>;
  raw?: number;
  levels?: number;
  side_probability?: number;
  source?: string;
}

export interface AiQuestion {
  type: string;
  instructions: string;
  criteria: Record<string, string | boolean> | string[];
}

export interface EngineAi {
  available: boolean;
  skipped?: string;
  site: Record<string, AiAnswer> | null;
  pages: Record<string, Record<string, AiAnswer> | null>;
  pairs: Array<{ a: string; b: string; title_overlap?: number; judgment: AiAnswer | null }>;
  ledger: Record<string, unknown>;
  questions: { site?: Record<string, AiQuestion>; page_example?: Record<string, AiQuestion> };
  not_judged?: string[];
  keywords?: Record<string, Record<string, AiAnswer>>;
}

export interface FieldMetric {
  p75: number;
  unit: string;
  rating: "good" | "needs improvement" | "poor" | string;
  good_max?: number;
  poor_min?: number;
}

export interface PsiRun {
  url: string;
  strategy: "mobile" | "desktop";
  error?: string;
  fetched_at?: string;
  lighthouse_version?: string;
  scores?: Record<string, number>;
  lab?: Record<string, { value: number | null; display?: string | null }>;
  field_url?: { overall?: string | null; metrics: Record<string, FieldMetric> } | null;
  field_origin?: { overall?: string | null; metrics: Record<string, FieldMetric> } | null;
  opportunities?: Array<{ id: string; title: string; savings_ms: number }>;
}

export interface EnginePerformance {
  source: string;
  keyed: boolean;
  runs: PsiRun[];
}

export interface EngineSite {
  input_url: string;
  start_url?: string;
  final_url: string;
  origin?: string;
  domain: string;
  https?: boolean;
  robots: {
    url?: string;
    status?: number | null;
    present?: boolean;
    sitemaps?: string[];
    crawl_delay?: number | null;
    disallow_all?: boolean;
    search_bots: Record<string, boolean>;
    ai_bots: Record<string, boolean>;
    ai_bots_named?: string[];
  };
  sitemaps?: { files?: Array<Record<string, unknown>>; urls?: string[]; total_urls?: number };
  probes?: Record<string, unknown>;
  link_status?: Record<string, number | null>;
  external_status?: Record<string, number | null>;
  external_total?: number;
  blocked_by_robots?: string[];
  render?: { mode?: string; browser_available?: boolean | null; homepage_rendered?: boolean };
  requests?: number;
  limits?: { max_pages?: number; max_depth?: number; time_budget_s?: number; hit_page_cap?: boolean; hit_time_budget?: boolean };
}

export interface EngineAudit {
  schema_version: string;
  tool: { name: string; version: string };
  run: {
    started_at: string;
    finished_at: string;
    rescored_at?: string;
    timings_s?: Record<string, number>;
    options?: Record<string, unknown>;
  };
  site: EngineSite;
  pages: EnginePage[];
  findings: EngineFinding[];
  passed_rules: string[];
  ai: EngineAi;
  performance: EnginePerformance | null;
  dataforseo: Record<string, unknown> | null;
  scores: EngineScores;
  actions: EngineAction[];
}
