import { z } from "zod";

/**
 * Audit options. Every field maps 1:1 to a real `jevseo run` flag (jevseo/cli.py audit_opts).
 * Bounds keep requests reasonable; engine defaults are used as the dashboard defaults.
 */
export const auditOptionsSchema = z.object({
  maxPages: z.number().int().min(1).max(500), // --max-pages (engine default 60)
  maxDepth: z.number().int().min(1).max(10), // --max-depth (5)
  timeBudget: z.number().int().min(30).max(1800), // --time-budget seconds (600)
  render: z.enum(["auto", "always", "never"]), // --render (auto)
  jev: z.boolean(), // inverse of --no-jev
  jevPages: z.number().int().min(1).max(200), // --jev-pages (60)
  jevBudget: z.number().min(0.01).max(5), // --jev-budget USD (0.25)
  psi: z.boolean(), // inverse of --no-psi
  psiPages: z.number().int().min(1).max(10), // --psi-pages (3)
  full: z.boolean(), // --full (DataForSEO, paid)
  dfsBudget: z.number().min(0.05).max(10), // --dfs-budget USD (1.0)
  locationCode: z.number().int().min(1).max(99999999), // --location-code (2840)
  language: z.string().regex(/^[a-z]{2}(-[a-z]{2})?$/i), // --language (en)
  formats: z.array(z.enum(["pdf", "xlsx", "md"])).min(1), // --formats (pdf,xlsx,md)
});

export type AuditOptions = z.infer<typeof auditOptionsSchema>;

export const DEFAULT_AUDIT_OPTIONS: AuditOptions = {
  maxPages: 60,
  maxDepth: 5,
  timeBudget: 600,
  render: "auto",
  jev: true,
  jevPages: 60,
  jevBudget: 0.25,
  psi: true,
  psiPages: 3,
  full: false,
  dfsBudget: 1.0,
  locationCode: 2840,
  language: "en",
  formats: ["pdf", "xlsx", "md"],
};

export const createAuditSchema = z.object({
  url: z.string().min(1).max(2048),
  options: auditOptionsSchema.partial().default({}),
  /** Must be true when options.full is true: DataForSEO is billed per call. */
  confirmPaid: z.boolean().optional(),
});

export const recommendationUpdateSchema = z.object({
  status: z.enum(["pending", "in_progress", "completed"]).optional(),
  notes: z.string().max(5000).optional(),
});

export const SECRET_KEYS = ["TYPESAFE_API_KEY", "PAGESPEED_API_KEY", "DATAFORSEO_USERNAME", "DATAFORSEO_PASSWORD"] as const;
export type SecretKey = (typeof SECRET_KEYS)[number];

export const settingsUpdateSchema = z.object({
  /** value string = set, null = remove from dashboard store, omitted = unchanged */
  secrets: z
    .record(z.enum(SECRET_KEYS), z.string().max(512).nullable())
    .optional(),
  defaults: auditOptionsSchema.partial().optional(),
});
