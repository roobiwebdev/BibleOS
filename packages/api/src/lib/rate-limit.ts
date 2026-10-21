/**
 * SOURCE OF TRUTH KEYWORDS: consumeRateLimit, RateLimitRule, RATE_LIMITS, throttle, TOO_MANY_REQUESTS
 * WHAT:  Fixed-window rate limiter stored in the shared rate_limit table (same table Better Auth uses).
 * WHY:   Works across serverless instances without Redis. Keys are namespaced "api:" so they never
 *        collide with Better Auth's own keys.
 * WHERE: procedure builder (`rateLimit` option), public forms (waitlist, feedback), upload route.
 */
import "server-only";
import { sql } from "drizzle-orm";
import { schema, type DbExecutor } from "@starter/db";

export type RateLimitRule = { max: number; windowSec: number };

export const RATE_LIMITS = {
  default: { max: 120, windowSec: 60 },
  publicForm: { max: 5, windowSec: 600 },
  upload: { max: 30, windowSec: 600 },
  sensitive: { max: 10, windowSec: 60 },
} as const satisfies Record<string, RateLimitRule>;

/** Returns true when the request is allowed. */
export async function consumeRateLimit(db: DbExecutor, key: string, rule: RateLimitRule): Promise<boolean> {
  const now = Date.now();
  const windowStart = now - rule.windowSec * 1000;
  const t = schema.rateLimit;
  const rows = await db
    .insert(t)
    .values({ key: `api:${key}`, count: 1, lastRequest: now })
    .onConflictDoUpdate({
      target: t.key,
      set: {
        count: sql`case when ${t.lastRequest} < ${windowStart} then 1 else ${t.count} + 1 end`,
        lastRequest: sql`case when ${t.lastRequest} < ${windowStart} then ${now} else ${t.lastRequest} end`,
      },
    })
    .returning({ count: t.count });
  return (rows[0]?.count ?? 1) <= rule.max;
}
