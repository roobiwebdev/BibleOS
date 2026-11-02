import { dayKeyOf, type DayKey } from "@starter/bible-core/calendar";
import { useSyncExternalStore } from "react";

/**
 * SOURCE OF TRUTH KEYWORDS: useNow, useToday, clock, current time, midnight rollover
 * WHAT:  The current time as a store that ticks once a minute, and today's local day key.
 * WHY:   Components must not read the clock while rendering (results would differ between
 *        renders). One shared tick also rolls Today, streaks and the heatmap over at midnight.
 * WHERE: useHabits, Today greeting, anything that depends on the date.
 */
let now = Date.now();
const listeners = new Set<() => void>();

setInterval(() => {
  now = Date.now();
  for (const listener of listeners) listener();
}, 60_000);

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useNow(): number {
  return useSyncExternalStore(subscribe, () => now);
}

export function useToday(): DayKey {
  return dayKeyOf(new Date(useNow()));
}
