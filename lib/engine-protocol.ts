/**
 * The audit engine's wire format, in one place.
 *
 * Rankora drives an external open-source audit engine (credited in NOTICE.md). Its command
 * name, log line format, CLI flags and raw data keys are the only places the dashboard
 * depends on the engine's own naming. Everything else uses Rankora's model; replacing the
 * engine later means changing this file and lib/server/engine-adapter.ts only.
 */

/** Python module run as `python -m <ENGINE_MODULE>` */
export const ENGINE_MODULE = "jevseo";
/** File whose presence identifies an engine checkout */
export const ENGINE_MARKER = [ENGINE_MODULE, "cli.py"] as const;
/** Default name of the engine's output folder */
export const ENGINE_REPORTS_FOLDER = "jev-seo-reports";
/** Environment variable the engine itself reads for an extra key file (passed through unchanged) */
export const ENGINE_ENV_FILE_VAR = "JEVSEO_ENV_FILE";

/** Progress line: `[<module> mm:ss] message` */
export const ENGINE_LOG_LINE = new RegExp(`^\\[${ENGINE_MODULE} (\\d{2,}:\\d{2})\\] (.*)$`);
export const ENGINE_LOG_PREFIX = new RegExp(`^\\[${ENGINE_MODULE} [\\d:]+\\]\\s*`);
/** AI-judgment counter line, e.g. "Jev: 10/20 pages judged" */
export const ENGINE_AI_COUNTER = /^Jev: (\d+)\/(\d+) pages judged/;

/** CLI flags for the AI-judgment stage */
export const ENGINE_AI_FLAGS = { pages: "--jev-pages", budget: "--jev-budget", off: "--no-jev" } as const;

/** Raw data keys/prefixes the adapter translates to Rankora's model */
export const RAW = {
  aiKey: "jev",
  aiCompleteness: "jev",
  aiNotJudged: "jev_pages_not_judged",
  aiOrigin: "jev",
  aiIdPrefix: "jev_",
  actionIdPrefix: "JEV-",
  aiOffOption: "no_jev",
} as const;

/** Rankora's prefixes */
export const ACTION_ID_PREFIX = "RK-";
export const AI_ID_PREFIX = "ai_";
