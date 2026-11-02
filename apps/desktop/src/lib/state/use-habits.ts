import { currentStreak, dailyMinutes, weekDots } from "@starter/bible-core/habits";
import { useMemo } from "react";

import { useToday } from "./clock";
import { usePreferences } from "./preferences";
import { useStudy } from "./study-store";

/**
 * SOURCE OF TRUTH KEYWORDS: useHabits, habit summary, minutes per day, streak, week dots, today minutes
 * WHAT:  The reader's habit picture for today: minutes per day, current rhythm (streak with
 *        grace and rest days), the 7-day dots and today's progress toward the goal.
 * WHY:   Sidebar, Today and Progress must show the same numbers, so they share one derivation
 *        over bible-core's pure habit math.
 * WHERE: app shell sidebar, Today page, Progress page.
 */
export function useHabits() {
  const { sessions } = useStudy();
  const { prefs } = usePreferences();
  const today = useToday();
  return useMemo(() => {
    const minutes = dailyMinutes(sessions);
    const todayMinutes = minutes.get(today) ?? 0;
    const dots = weekDots(minutes, today, prefs.rules);
    return {
      today,
      minutes,
      todayMinutes,
      streak: currentStreak(minutes, today, prefs.rules),
      dots,
      daysThisWeek: dots.filter((d) => d.state === "read").length,
      goalMet: todayMinutes >= prefs.goalMinutes,
    };
  }, [sessions, prefs.rules, prefs.goalMinutes, today]);
}
