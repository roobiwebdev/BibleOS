import { dayKeyOf, formatDay } from "@starter/bible-core/calendar";

import { usePreferences } from "./state/preferences";

/**
 * SOURCE OF TRUTH KEYWORDS: useFormatDate, formatTimestamp, localized date, note dates
 * WHAT:  Formats a timestamp as a day in the reader's language and calendar.
 * WHY:   Note and journal dates must follow the same Amharic/Ethiopian settings as Today.
 * WHERE: Study lists and note detail.
 */
export function useFormatDate(): (timestamp: number) => string {
  const { prefs } = usePreferences();
  return (timestamp) => formatDay(dayKeyOf(new Date(timestamp)), prefs.calendar, prefs.locale);
}
