/**
 * SOURCE OF TRUTH KEYWORDS: logger, log, structured logging, logError, scope
 * WHAT:  Minimal structured logger. JSON lines in production, readable lines in development.
 * WHY:   One place to swap in a log drain (Axiom, Better Stack, Sentry) without touching callers.
 * WHERE: every server package. Never log secrets, tokens or full request bodies.
 */
type Level = "debug" | "info" | "warn" | "error";
type Fields = Record<string, string | number | boolean | null | undefined>;

const isProd = process.env.NODE_ENV === "production";

function write(level: Level, scope: string, message: string, fields?: Fields, err?: unknown) {
  if (level === "debug" && isProd) return;
  const errorText = err instanceof Error ? err.message : err === undefined ? undefined : String(err);
  if (isProd) {
    const line = JSON.stringify({ level, scope, message, ...fields, error: errorText, time: new Date().toISOString() });
    (level === "error" ? console.error : console.log)(line);
    return;
  }
  const extra = fields ? ` ${JSON.stringify(fields)}` : "";
  const out = `[${scope}] ${message}${extra}${errorText ? ` :: ${errorText}` : ""}`;
  (level === "error" ? console.error : level === "warn" ? console.warn : console.log)(out);
}

export function createLogger(scope: string) {
  return {
    debug: (message: string, fields?: Fields) => write("debug", scope, message, fields),
    info: (message: string, fields?: Fields) => write("info", scope, message, fields),
    warn: (message: string, fields?: Fields, err?: unknown) => write("warn", scope, message, fields, err),
    error: (message: string, fields?: Fields, err?: unknown) => write("error", scope, message, fields, err),
  };
}

export type Logger = ReturnType<typeof createLogger>;
