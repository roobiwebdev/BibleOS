import { addDays, dayKeyToJdn, weekday, type DayKey } from "./calendar";

/**
 * SOURCE OF TRUTH KEYWORDS: dailyMinutes, heatLevel, currentStreak, weekDots, StreakRules, grace days, rest days, habit engine
 * WHAT:  Pure habit math over reading sessions: minutes per local day, heatmap intensity,
 *        the current streak with automatic grace days and rest days, and the 7-day dot row.
 * WHY:   Streaks should reward consistency without punishing one missed day, so grace and
 *        rest days are part of the rule, not an afterthought. Keeping the math pure (no
 *        clock, no database) makes it testable and shared by every surface that shows progress.
 * WHERE: desktop Today page (dots, streak), Progress page (heatmap, totals), later reminders.
 */
export interface SessionLike {
  localDay: DayKey;
  focusedSeconds: number;
}

export interface StreakRules {
  /** Missed days forgiven per week (0–3). */
  gracePerWeek: number;
  /** Weekdays that never break a streak, 0 = Sunday. */
  restWeekdays: readonly number[];
  /** First day of the week for grace accounting, 0 = Sunday, 1 = Monday. */
  weekStartsOn: number;
}

export const DEFAULT_STREAK_RULES: StreakRules = { gracePerWeek: 1, restWeekdays: [], weekStartsOn: 1 };

/** Whole minutes read per local day. Days without reading are absent. */
export function dailyMinutes(sessions: readonly SessionLike[]): Map<DayKey, number> {
  const seconds = new Map<DayKey, number>();
  for (const s of sessions) seconds.set(s.localDay, (seconds.get(s.localDay) ?? 0) + s.focusedSeconds);
  const minutes = new Map<DayKey, number>();
  for (const [day, total] of seconds) {
    const m = Math.floor(total / 60);
    if (m > 0) minutes.set(day, m);
  }
  return minutes;
}

/** Heatmap level 0–4, relative to the daily goal: none, some, half, goal met, double goal. */
export function heatLevel(minutes: number, goalMinutes: number): 0 | 1 | 2 | 3 | 4 {
  if (minutes <= 0) return 0;
  const goal = Math.max(goalMinutes, 1);
  if (minutes >= goal * 2) return 4;
  if (minutes >= goal) return 3;
  if (minutes >= goal / 2) return 2;
  return 1;
}

function weekIndex(day: DayKey, weekStartsOn: number): number {
  const offset = (weekday(day) - weekStartsOn + 7) % 7;
  return Math.floor((dayKeyToJdn(day) - offset) / 7);
}

/**
 * Days read in the current run. Today counts only once read; an unread today is still
 * pending and never breaks the run. Rest days are skipped; other misses use a grace day
 * from that week's allowance until it runs out.
 */
export function currentStreak(
  minutes: ReadonlyMap<DayKey, number>,
  today: DayKey,
  rules: StreakRules = DEFAULT_STREAK_RULES,
): number {
  if (minutes.size === 0) return 0;
  const earliest = Math.min(...[...minutes.keys()].map(dayKeyToJdn));
  const graceUsed = new Map<number, number>();
  let count = (minutes.get(today) ?? 0) > 0 ? 1 : 0;

  for (let day = addDays(today, -1); dayKeyToJdn(day) >= earliest; day = addDays(day, -1)) {
    if ((minutes.get(day) ?? 0) > 0) {
      count++;
      continue;
    }
    if (rules.restWeekdays.includes(weekday(day))) continue;
    const week = weekIndex(day, rules.weekStartsOn);
    const used = graceUsed.get(week) ?? 0;
    if (used >= rules.gracePerWeek) break;
    graceUsed.set(week, used + 1);
  }
  return count;
}

export type DotState = "read" | "pending" | "rest" | "missed";

/** The last 7 days, oldest first, for the dot row. */
export function weekDots(
  minutes: ReadonlyMap<DayKey, number>,
  today: DayKey,
  rules: StreakRules = DEFAULT_STREAK_RULES,
): Array<{ day: DayKey; state: DotState }> {
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(today, i - 6);
    const read = (minutes.get(day) ?? 0) > 0;
    const state: DotState = read
      ? "read"
      : day === today
        ? "pending"
        : rules.restWeekdays.includes(weekday(day))
          ? "rest"
          : "missed";
    return { day, state };
  });
}
