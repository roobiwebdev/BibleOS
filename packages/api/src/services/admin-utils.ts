/**
 * SOURCE OF TRUTH KEYWORDS: admin metrics, countUserCountries, buildSparkline, buildDailySeries, percentOf, formatAuthProvider, CountryCount, GeoLookup, analytics maths
 * WHAT:  Pure helpers that turn raw admin query rows into Batman's overview / analytics shapes:
 *        country buckets, 7-day sparkline, 30-day daily series and weekly buckets, rates.
 * WHY:   Kept free of database, geoip and server-only imports so the maths (ported 1:1 from
 *        Batman's lib/actions/admin.ts) is unit tested. The IP-to-country lookup is injected.
 * WHERE: packages/api/src/routers/admin.ts, admin-utils.test.ts.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export type CountryCount = { code: string; name: string; count: number };
/** Resolves an IP to a country; null for private, localhost or unknown addresses. */
export type GeoLookup = (ip: string) => { country: string; name: string } | null;

type SessionRow = { userId: string; createdAt: Date; ipAddress: string | null };

export const UNKNOWN_COUNTRY = { code: "XX", name: "Unknown" } as const;

/** The moment `days` days before `now`. */
export function daysAgo(now: Date, days: number): Date {
  return new Date(now.getTime() - days * DAY_MS);
}

/** Whole-number percentage of part/total (0 when total is 0), as Batman displayed it. */
export function percentOf(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

/**
 * Counts unique users per country. Each user is placed by the first session IP seen in
 * `sessions` (pass them oldest first, like Batman). Users without a resolvable IP count as Unknown.
 */
export function countUserCountries(sessions: readonly SessionRow[], lookup: GeoLookup): CountryCount[] {
  const firstIpByUser = new Map<string, string | null>();
  for (const s of sessions) {
    if (!firstIpByUser.has(s.userId)) firstIpByUser.set(s.userId, s.ipAddress);
  }

  const counts = new Map<string, CountryCount>();
  for (const ip of firstIpByUser.values()) {
    const hit = ip ? lookup(ip) : null;
    const key = hit ? hit.country : UNKNOWN_COUNTRY.code;
    const existing = counts.get(key);
    if (existing) existing.count++;
    else counts.set(key, hit ? { code: hit.country, name: hit.name, count: 1 } : { ...UNKNOWN_COUNTRY, count: 1 });
  }
  return [...counts.values()].toSorted((a, b) => b.count - a.count);
}

/** Last 7 rolling 24h windows (oldest first): sign-ups and unique active users per window. */
export function buildSparkline(
  now: Date,
  signupDates: readonly Date[],
  sessions: readonly Pick<SessionRow, "userId" | "createdAt">[],
): { signups: number; active: number }[] {
  const out: { signups: number; active: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const start = daysAgo(now, i + 1);
    const end = daysAgo(now, i);
    const signups = signupDates.filter((d) => d >= start && d < end).length;
    const active = new Set(sessions.filter((s) => s.createdAt >= start && s.createdAt < end).map((s) => s.userId));
    out.push({ signups, active: active.size });
  }
  return out;
}

export type DailyPoint = { date: string; label: string; signups: number; activeUsers: number; totalUsers: number };

/**
 * Batman's analytics series: 30 UTC calendar days ending today with sign-ups, unique active
 * users and a running total, plus 4 weekly sign-up buckets (and a leftover bucket when the last
 * 2 days had sign-ups) and 4 weekly unique-active buckets for the sparklines.
 */
export function buildDailySeries(input: {
  now: Date;
  totalUsers: number;
  usersLast30d: number;
  signupDates: readonly Date[];
  sessions: readonly Pick<SessionRow, "userId" | "createdAt">[];
}): { dailyData: DailyPoint[]; weeklySignups: number[]; weeklyActive: number[] } {
  const days = new Map<string, { signups: number; activeUsers: Set<string> }>();
  for (let i = 29; i >= 0; i--) {
    days.set(daysAgo(input.now, i).toISOString().slice(0, 10), { signups: 0, activeUsers: new Set() });
  }
  for (const d of input.signupDates) {
    const day = days.get(d.toISOString().slice(0, 10));
    if (day) day.signups++;
  }
  for (const s of input.sessions) {
    days.get(s.createdAt.toISOString().slice(0, 10))?.activeUsers.add(s.userId);
  }

  let cumulative = input.totalUsers - input.usersLast30d;
  const dailyData = [...days.entries()].map(([date, d]) => {
    cumulative += d.signups;
    return {
      date,
      label: new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }),
      signups: d.signups,
      activeUsers: d.activeUsers.size,
      totalUsers: cumulative,
    };
  });

  const entries = [...days.values()];
  const weeklySignups: number[] = [];
  const weeklyActive: number[] = [];
  for (let w = 0; w < 4; w++) {
    const week = entries.slice(w * 7, w * 7 + 7);
    weeklySignups.push(week.reduce((sum, d) => sum + d.signups, 0));
    const unique = new Set<string>();
    for (const d of week) for (const u of d.activeUsers) unique.add(u);
    weeklyActive.push(unique.size);
  }
  const remainder = entries.slice(28).reduce((sum, d) => sum + d.signups, 0);
  if (remainder > 0) weeklySignups.push(remainder);

  return { dailyData, weeklySignups, weeklyActive };
}

/** Display name for a Better Auth account provider id ("credential" -> "Email/Password"). */
export function formatAuthProvider(providerId: string): string {
  if (providerId === "credential") return "Email/Password";
  return providerId.charAt(0).toUpperCase() + providerId.slice(1);
}
