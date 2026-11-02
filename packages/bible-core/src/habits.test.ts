import { describe, expect, it } from "vitest";

import { currentStreak, dailyMinutes, heatLevel, weekDots, type StreakRules } from "./habits";

const minutes = (days: Record<string, number>) => new Map(Object.entries(days));
const strict: StreakRules = { gracePerWeek: 0, restWeekdays: [], weekStartsOn: 1 };

describe("habit engine", () => {
  it("sums sessions into whole minutes per day", () => {
    const totals = dailyMinutes([
      { localDay: "2026-11-01", focusedSeconds: 90 },
      { localDay: "2026-11-01", focusedSeconds: 45 },
      { localDay: "2026-11-02", focusedSeconds: 30 },
    ]);
    expect([...totals]).toEqual([["2026-11-01", 2]]);
  });

  it("grades heat relative to the goal", () => {
    expect([0, 3, 5, 10, 20].map((m) => heatLevel(m, 10))).toEqual([0, 1, 2, 3, 4]);
  });

  it("counts a run and keeps an unread today pending", () => {
    const days = minutes({ "2026-10-30": 5, "2026-10-31": 5, "2026-11-01": 5 });
    expect(currentStreak(days, "2026-11-02", strict)).toBe(3);
    expect(currentStreak(minutes({ ...Object.fromEntries(days), "2026-11-02": 4 }), "2026-11-02", strict)).toBe(4);
  });

  it("forgives one missed day per week with grace", () => {
    // Mon 26 Oct … Sun 1 Nov 2026; Wed 28 missed.
    const days = minutes({
      "2026-10-26": 5,
      "2026-10-27": 5,
      "2026-10-29": 5,
      "2026-10-30": 5,
      "2026-10-31": 5,
      "2026-11-01": 5,
    });
    expect(currentStreak(days, "2026-11-01", strict)).toBe(4);
    expect(currentStreak(days, "2026-11-01", { ...strict, gracePerWeek: 1 })).toBe(6);
  });

  it("skips rest days", () => {
    // Sunday 1 Nov is a rest day.
    const days = minutes({ "2026-10-30": 5, "2026-10-31": 5, "2026-11-02": 5 });
    expect(currentStreak(days, "2026-11-02", { ...strict, restWeekdays: [0] })).toBe(3);
  });

  it("builds the 7-day dot row", () => {
    const dots = weekDots(minutes({ "2026-11-01": 5 }), "2026-11-02", { ...strict, restWeekdays: [6] });
    expect(dots.map((d) => d.state)).toEqual(["missed", "missed", "missed", "missed", "rest", "read", "pending"]);
  });
});
