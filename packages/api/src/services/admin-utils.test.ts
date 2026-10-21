import { describe, expect, it } from "vitest";

import {
  buildDailySeries,
  buildSparkline,
  countUserCountries,
  daysAgo,
  formatAuthProvider,
  percentOf,
  type GeoLookup,
} from "./admin-utils";

const now = new Date("2026-10-21T12:00:00Z");
const lookup: GeoLookup = (ip) =>
  ip.startsWith("8.")
    ? { country: "US", name: "United States" }
    : ip.startsWith("5.")
      ? { country: "DE", name: "Germany" }
      : null;

describe("percentOf", () => {
  it("rounds and guards zero totals", () => {
    expect(percentOf(1, 3)).toBe(33);
    expect(percentOf(5, 0)).toBe(0);
  });
});

describe("countUserCountries", () => {
  it("places each user by their first session IP and buckets unknowns", () => {
    const sessions = [
      { userId: "a", createdAt: now, ipAddress: "8.8.8.8" },
      { userId: "a", createdAt: now, ipAddress: "5.5.5.5" }, // later session ignored
      { userId: "b", createdAt: now, ipAddress: "8.8.4.4" },
      { userId: "c", createdAt: now, ipAddress: "127.0.0.1" },
      { userId: "d", createdAt: now, ipAddress: null },
      { userId: "e", createdAt: now, ipAddress: "5.1.1.1" },
    ];
    expect(countUserCountries(sessions, lookup)).toEqual([
      { code: "US", name: "United States", count: 2 },
      { code: "XX", name: "Unknown", count: 2 },
      { code: "DE", name: "Germany", count: 1 },
    ]);
  });
});

describe("buildSparkline", () => {
  it("returns 7 windows oldest first with unique active users", () => {
    const recent = daysAgo(now, 0.5);
    const old = daysAgo(now, 6.5);
    const result = buildSparkline(
      now,
      [recent, recent, old],
      [
        { userId: "a", createdAt: recent },
        { userId: "a", createdAt: recent },
        { userId: "b", createdAt: recent },
      ],
    );
    expect(result).toHaveLength(7);
    expect(result[0]).toEqual({ signups: 1, active: 0 });
    expect(result[6]).toEqual({ signups: 2, active: 2 });
  });
});

describe("buildDailySeries", () => {
  it("builds 30 days with a running total and weekly buckets", () => {
    const today = new Date("2026-10-21T08:00:00Z");
    const { dailyData, weeklySignups, weeklyActive } = buildDailySeries({
      now,
      totalUsers: 12,
      usersLast30d: 2,
      signupDates: [today, daysAgo(now, 29)],
      sessions: [{ userId: "a", createdAt: today }],
    });
    expect(dailyData).toHaveLength(30);
    expect(dailyData[0]?.totalUsers).toBe(11);
    expect(dailyData[29]).toMatchObject({
      date: "2026-10-21",
      label: "Oct 21",
      signups: 1,
      activeUsers: 1,
      totalUsers: 12,
    });
    expect(weeklySignups).toEqual([1, 0, 0, 0, 1]);
    expect(weeklyActive).toEqual([0, 0, 0, 0]);
  });
});

describe("formatAuthProvider", () => {
  it("maps credential and capitalises others", () => {
    expect(formatAuthProvider("credential")).toBe("Email/Password");
    expect(formatAuthProvider("github")).toBe("Github");
  });
});
