/**
 * SOURCE OF TRUTH KEYWORDS: serverEnv, ENV, environment variables, varlock
 * WHAT:  Typed server env. Values are validated against apps/web/.env.schema by Varlock
 *        (Next.js loader in dev/build, `varlock run` for scripts).
 * WHY:   Only server/services.ts should read env; packages receive values from there.
 * WHERE: server/services.ts.
 */
import "server-only";

import { ENV } from "../env";

export function serverEnv() {
  return ENV;
}
