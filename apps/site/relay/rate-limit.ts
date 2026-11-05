/**
 * SOURCE OF TRUTH KEYWORDS: createRateLimiter, RateLimiter, per-IP limit, fixed window, best-effort limit
 * WHAT:  In-memory fixed-window counters: `take(key)` is false once a key has used its quota
 *        for the current window.
 * WHY:   Best effort only: each serverless instance keeps its own counters, so a reader who
 *        lands on several instances gets a little more. That is enough to stop one client from
 *        burning the shared daily publisher quota; there is no server store to keep, by design.
 * WHERE: relay handler (per IP, and per publisher to stay under their per-minute and per-hour caps).
 */
export function createRateLimiter(options: { limit: number; windowMs: number; maxKeys?: number }) {
  const windows = new Map<string, { start: number; count: number }>();
  const maxKeys = options.maxKeys ?? 10_000;
  return {
    take(key: string, now: number): boolean {
      const window = windows.get(key);
      if (!window || now - window.start >= options.windowMs) {
        // Forget stale keys before the map grows without bound.
        if (windows.size >= maxKeys) {
          for (const [k, w] of windows) if (now - w.start >= options.windowMs) windows.delete(k);
          if (windows.size >= maxKeys) windows.clear();
        }
        windows.set(key, { start: now, count: 1 });
        return true;
      }
      if (window.count >= options.limit) return false;
      window.count++;
      return true;
    },
  };
}

export type RateLimiter = ReturnType<typeof createRateLimiter>;
