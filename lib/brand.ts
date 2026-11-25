/**
 * Product branding, in one place.
 *
 * Change the name here, or without touching code by setting NEXT_PUBLIC_BRAND_NAME (and
 * optionally NEXT_PUBLIC_BRAND_TAGLINE) in .env.local, then rebuild (npm run build).
 */
const name = (process.env.NEXT_PUBLIC_BRAND_NAME ?? "").trim() || "Rankora";
const tagline = (process.env.NEXT_PUBLIC_BRAND_TAGLINE ?? "").trim() || "SEO audit workspace";

export const BRAND = {
  name,
  tagline,
  /** Letter(s) shown in the logo mark */
  initials: name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase(),
  /** What the audit engine's AI judgments are called in the UI */
  aiLabel: "AI judgments",
} as const;

/**
 * Your sites: used as the rotating placeholder on New Audit. Audits of them ship with the app
 * as seed data (seed/*.tar.xz) and are added to the reports folder on first start.
 */
export const SAMPLE_SITES = ["https://www.emailverify.io/", "https://www.clustox.com/", "https://mycoldinbox.com/", "https://inboxwarm.ai/"] as const;

/**
 * Engine output (progress log lines, error messages) names its components after the upstream
 * project. Present them in neutral terms in the UI; the raw files on disk are unchanged.
 */
export function neutralEngineText(text: string): string {
  return text
    .replace(/\bjev-seo\b/gi, "audit engine")
    .replace(/\bjevseo\b/gi, "audit engine")
    .replace(/\bJev judgments\b/g, "AI judgments")
    .replace(/\bJev's\b/g, "the AI's")
    .replace(/\bJev\b/g, "AI");
}
