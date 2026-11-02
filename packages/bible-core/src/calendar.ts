import type { Locale } from "./books";

/**
 * SOURCE OF TRUTH KEYWORDS: DayKey, CalendarSystem, toEthiopian, fromEthiopian, dayKeyToJdn, weekday, Ethiopian calendar, formatDay
 * WHAT:  Calendar arithmetic on local calendar days ("YYYY-MM-DD" day keys) through Julian Day
 *        Numbers, plus Gregorian ⇄ Ethiopian (Amete Mihret) conversion and day formatting.
 * WHY:   Habit tracking works in whole local days, so plain day keys avoid time-zone drift.
 *        One converter serves the heatmap, Today page, note dates and export, whichever
 *        calendar the reader picks.
 * WHERE: habits.ts, desktop Today and Progress pages, note timestamps.
 */
export type DayKey = string;
export type CalendarSystem = "gregorian" | "ethiopian";

export interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

const ETHIOPIAN_EPOCH_JDN = 1_724_221; // 1 Meskerem 1 (Amete Mihret)

export function gregorianToJdn({ year, month, day }: CalendarDate): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32_045
  );
}

export function jdnToGregorian(jdn: number): CalendarDate {
  const a = jdn + 32_044;
  const b = Math.floor((4 * a + 3) / 146_097);
  const c = a - Math.floor((146_097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  return {
    day: e - Math.floor((153 * m + 2) / 5) + 1,
    month: m + 3 - 12 * Math.floor(m / 10),
    year: 100 * b + d - 4800 + Math.floor(m / 10),
  };
}

export function ethiopianToJdn({ year, month, day }: CalendarDate): number {
  return ETHIOPIAN_EPOCH_JDN - 1 + 365 * (year - 1) + Math.floor(year / 4) + 30 * (month - 1) + day;
}

export function jdnToEthiopian(jdn: number): CalendarDate {
  const year = Math.floor((4 * (jdn - ETHIOPIAN_EPOCH_JDN) + 1463) / 1461);
  const month = Math.floor((jdn - ethiopianToJdn({ year, month: 1, day: 1 })) / 30) + 1;
  const day = jdn + 1 - ethiopianToJdn({ year, month, day: 1 });
  return { year, month, day };
}

export function toEthiopian(date: CalendarDate): CalendarDate {
  return jdnToEthiopian(gregorianToJdn(date));
}

export function fromEthiopian(date: CalendarDate): CalendarDate {
  return jdnToGregorian(ethiopianToJdn(date));
}

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

export function dayKeyToJdn(key: DayKey): number {
  const [year = 0, month = 0, day = 0] = key.split("-").map(Number);
  return gregorianToJdn({ year, month, day });
}

export function jdnToDayKey(jdn: number): DayKey {
  const { year, month, day } = jdnToGregorian(jdn);
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

/** Local calendar day of a JS Date (uses the device's time zone). */
export function dayKeyOf(date: Date): DayKey {
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(key: DayKey, days: number): DayKey {
  return jdnToDayKey(dayKeyToJdn(key) + days);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(key: DayKey): number {
  return (dayKeyToJdn(key) + 1) % 7;
}

const ETHIOPIAN_MONTHS = {
  am: ["መስከረም", "ጥቅምት", "ኅዳር", "ታኅሣሥ", "ጥር", "የካቲት", "መጋቢት", "ሚያዝያ", "ግንቦት", "ሰኔ", "ሐምሌ", "ነሐሴ", "ጳጉሜን"],
  en: [
    "Meskerem",
    "Tikimt",
    "Hidar",
    "Tahsas",
    "Tir",
    "Yekatit",
    "Megabit",
    "Miyazya",
    "Ginbot",
    "Sene",
    "Hamle",
    "Nehase",
    "Pagume",
  ],
} as const;

/** Month names of the chosen calendar, for heatmap labels and pickers. */
export function monthName(system: CalendarSystem, month: number, locale: Locale): string {
  if (system === "ethiopian") return ETHIOPIAN_MONTHS[locale][month - 1] ?? "";
  const date = new Date(Date.UTC(2001, month - 1, 1));
  return date.toLocaleString(locale === "am" ? "am-ET" : "en", { month: "long", timeZone: "UTC" });
}

/** The day in the chosen calendar, as calendar parts. */
export function inCalendar(key: DayKey, system: CalendarSystem): CalendarDate {
  const jdn = dayKeyToJdn(key);
  return system === "ethiopian" ? jdnToEthiopian(jdn) : jdnToGregorian(jdn);
}

/** "12 Meskerem 2016" / "መስከረም 12, 2016" / "September 12, 2023". */
export function formatDay(key: DayKey, system: CalendarSystem, locale: Locale): string {
  const { year, month, day } = inCalendar(key, system);
  const name = monthName(system, month, locale);
  return locale === "am"
    ? `${name} ${day}, ${year}`
    : system === "ethiopian"
      ? `${day} ${name} ${year}`
      : `${name} ${day}, ${year}`;
}
