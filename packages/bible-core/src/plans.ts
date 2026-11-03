import { BOOKS, bookByCode, bookByOrd, type BookInfo, type Locale } from "./books";
import { dayKeyToJdn, type DayKey } from "./calendar";
import { chapterRange, formatRange, isWholeChapter, type VerseRange } from "./range";
import { makeVerseId, splitVerseId } from "./verse-id";

/**
 * SOURCE OF TRUTH KEYWORDS: PlanDay, PlanDefinition, BuiltInPlan, PlanKey, reading plan shape, plan days
 * WHAT:  A reading plan as data: a list of days, each day a list of passages (verse ranges,
 *        usually whole chapters). Built-in plans add a stable key and en/am title and blurb.
 * WHY:   Plans are pure data generated in code, so the database stores only which plan was
 *        started (plan_key) and which days are done. Custom plans store the same shape as JSON.
 * WHERE: local-api plan commands, desktop Plans page and Today's reading.
 */
export type PlanDay = VerseRange[];

export interface PlanDefinition {
  days: PlanDay[];
}

export interface LocalizedText {
  en: string;
  am: string;
}

export interface BuiltInPlan extends PlanDefinition {
  key: PlanKey;
  title: LocalizedText;
  description: LocalizedText;
}

/** Longest plan a reader can make: two years. */
export const MAX_PLAN_DAYS = 730;

const chaptersOf = (book: BookInfo): VerseRange[] =>
  Array.from({ length: book.chapters }, (_c, i) => chapterRange(makeVerseId(book.ord, i + 1)));

const booksByCode = (codes: readonly string[]): BookInfo[] =>
  codes.flatMap((code) => {
    const book = bookByCode(code);
    return book ? [book] : [];
  });

/** Every chapter of the given books, in the order given. */
export function chaptersOfBooks(books: readonly BookInfo[]): VerseRange[] {
  return books.flatMap(chaptersOf);
}

/**
 * SOURCE OF TRUTH KEYWORDS: spreadOverDays, balance plan, split chapters into days, plan generator
 * WHAT:  Splits a list of passages into `days` consecutive, evenly sized days. Each passage
 *        counts as one unit of effort (a chapter), so day sizes differ by at most one.
 * WHY:   Every generated plan (built-in or custom) uses the same split, so "3 chapters a day"
 *        means the same everywhere. With fewer passages than days, the extra days are dropped.
 * WHERE: built-in plans below, customPlan, local-api plans.start.
 */
export function spreadOverDays(passages: readonly VerseRange[], days: number): PlanDay[] {
  const count = Math.max(1, Math.min(Math.floor(days), passages.length));
  const out: PlanDay[] = [];
  for (let day = 0; day < count; day++) {
    const from = Math.round((passages.length * day) / count);
    const to = Math.round((passages.length * (day + 1)) / count);
    out.push(passages.slice(from, to));
  }
  return out.filter((d) => d.length > 0);
}

/** Reads several tracks side by side: day N of the result is day N of every track. */
function zipTracks(...tracks: PlanDay[][]): PlanDay[] {
  const length = Math.max(...tracks.map((t) => t.length));
  return Array.from({ length }, (_d, i) => tracks.flatMap((t) => t[i] ?? []));
}

const OT = BOOKS.filter((b) => b.testament === "OT");
const NT = BOOKS.filter((b) => b.testament === "NT");
const psalms = booksByCode(["PSA"]);
const gospels = booksByCode(["MAT", "MRK", "LUK", "JHN"]);

const verses = (code: string, chapter: number, from: number, to: number): VerseRange => {
  const ord = bookByCode(code)?.ord ?? 0;
  return { start: makeVerseId(ord, chapter, from), end: makeVerseId(ord, chapter, to) };
};

const chapterOfBook = (code: string, n: number): VerseRange => chapterRange(makeVerseId(bookByCode(code)?.ord ?? 0, n));

/**
 * SOURCE OF TRUTH KEYWORDS: BUILT_IN_PLANS, PLAN_KEYS, builtInPlan, Gospels in 30 days, Bible in a year, Psalms and Proverbs
 * WHAT:  The seven plans that ship with the app.
 * WHY:   Defined once here so the commands, Plans page and Today agree on every day's reading.
 *        Keys are stored in the database, so they never change.
 * WHERE: local-api plans.start/list, desktop Plans page.
 */
export const PLAN_KEYS = [
  "gospels-30",
  "through-bible-year",
  "nt-90",
  "psalms-proverbs",
  "bible-year",
  "sermon-mount",
  "john-21",
] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];

export const BUILT_IN_PLANS: readonly BuiltInPlan[] = [
  {
    key: "gospels-30",
    title: { en: "Gospels in 30 Days", am: "ወንጌላት በ30 ቀናት" },
    description: {
      en: "Walk with Jesus through Matthew, Mark, Luke and John in a month.",
      am: "ማቴዎስን፣ ማርቆስን፣ ሉቃስንና ዮሐንስን በአንድ ወር ውስጥ ከኢየሱስ ጋር ይጓዙ።",
    },
    days: spreadOverDays(chaptersOfBooks(gospels), 30),
  },
  {
    key: "through-bible-year",
    title: { en: "Through the Bible in a Year", am: "መጽሐፍ ቅዱስን በአንድ ዓመት" },
    description: {
      en: "Each day an Old Testament, a New Testament and a Psalm reading. The Old Testament once, the New Testament and Psalms twice.",
      am: "በየቀኑ ከብሉይ ኪዳን፣ ከአዲስ ኪዳንና ከመዝሙራት ንባብ። ብሉይ ኪዳንን አንድ ጊዜ፣ አዲስ ኪዳንንና መዝሙራትን ሁለት ጊዜ ያነባሉ።",
    },
    days: zipTracks(
      spreadOverDays(chaptersOfBooks(OT.filter((b) => b.code !== "PSA")), 365),
      spreadOverDays([...chaptersOfBooks(NT), ...chaptersOfBooks(NT)], 365),
      spreadOverDays([...chaptersOfBooks(psalms), ...chaptersOfBooks(psalms)], 365),
    ),
  },
  {
    key: "nt-90",
    title: { en: "New Testament in 90 Days", am: "አዲስ ኪዳን በ90 ቀናት" },
    description: {
      en: "Read the whole New Testament, Matthew to Revelation, in three months.",
      am: "አዲስ ኪዳንን ከማቴዎስ እስከ ራእይ በሦስት ወራት ያንብቡ።",
    },
    days: spreadOverDays(chaptersOfBooks(NT), 90),
  },
  {
    key: "psalms-proverbs",
    title: { en: "Psalms & Proverbs", am: "መዝሙራትና ምሳሌ" },
    description: {
      en: "Five psalms and one chapter of Proverbs a day for a month of prayer and wisdom.",
      am: "ለአንድ ወር የጸሎትና የጥበብ ጊዜ በየቀኑ አምስት መዝሙሮችና አንድ የምሳሌ ምዕራፍ።",
    },
    days: Array.from({ length: 31 }, (_d, i) => [
      ...[0, 30, 60, 90, 120]
        .map((offset) => i + 1 + offset)
        .filter((n) => n <= 150)
        .map((n) => chapterOfBook("PSA", n)),
      chapterOfBook("PRO", i + 1),
    ]),
  },
  {
    key: "bible-year",
    title: { en: "Bible in a Year", am: "መጽሐፍ ቅዱስ በአንድ ዓመት" },
    description: {
      en: "Genesis to Revelation in order, about three chapters a day.",
      am: "ከዘፍጥረት እስከ ራእይ በቅደም ተከተል፣ በቀን ሦስት ያህል ምዕራፎች።",
    },
    days: spreadOverDays(chaptersOfBooks(BOOKS), 365),
  },
  {
    key: "sermon-mount",
    title: { en: "Sermon on the Mount", am: "የተራራው ስብከት" },
    description: {
      en: "A slow week in Matthew 5–7, the heart of Jesus' teaching.",
      am: "በማቴዎስ 5–7 ላይ፣ በኢየሱስ ትምህርት እምብርት ላይ፣ ቀስ ብለው የሚያሳልፉት ሳምንት።",
    },
    days: [
      [verses("MAT", 5, 1, 12)],
      [verses("MAT", 5, 13, 26)],
      [verses("MAT", 5, 27, 48)],
      [verses("MAT", 6, 1, 18)],
      [verses("MAT", 6, 19, 34)],
      [verses("MAT", 7, 1, 14)],
      [verses("MAT", 7, 15, 29)],
    ],
  },
  {
    key: "john-21",
    title: { en: "Gospel of John", am: "የዮሐንስ ወንጌል" },
    description: {
      en: "One chapter a day through the Gospel of John.",
      am: "በየቀኑ አንድ ምዕራፍ፣ የዮሐንስን ወንጌል በሙሉ።",
    },
    days: chaptersOfBooks(booksByCode(["JHN"])).map((c) => [c]),
  },
];

const BY_KEY = new Map(BUILT_IN_PLANS.map((p) => [p.key, p]));

export function builtInPlan(key: string): BuiltInPlan | undefined {
  return isPlanKey(key) ? BY_KEY.get(key) : undefined;
}

export function isPlanKey(value: string): value is PlanKey {
  return PLAN_KEYS.some((k) => k === value);
}

/**
 * SOURCE OF TRUTH KEYWORDS: customPlan, make your own plan, pick books, custom plan generator
 * WHAT:  A plan over the chosen books (canonical order) spread over `days` days.
 * WHY:   The simplest custom plan a reader asks for: "these books in N days".
 * WHERE: local-api plans.start with a custom definition.
 */
export function customPlan(bookCodes: readonly string[], days: number): PlanDefinition {
  const books = booksByCode([...new Set(bookCodes.map((c) => c.toUpperCase()))]).toSorted((a, b) => a.ord - b.ord);
  return { days: spreadOverDays(chaptersOfBooks(books), Math.min(days, MAX_PLAN_DAYS)) };
}

/** Chapters (passages) per day on average, rounded to one decimal. */
export function planPace(plan: PlanDefinition): number {
  const passages = plan.days.reduce((sum, d) => sum + d.length, 0);
  return plan.days.length === 0 ? 0 : Math.round((passages / plan.days.length) * 10) / 10;
}

/**
 * SOURCE OF TRUTH KEYWORDS: dayForDate, planProgress, nextUnreadDay, daysBehind, catch-up, plan schedule
 * WHAT:  Schedule math for a started plan. Days are 1-based; day 1 is the start date and each
 *        calendar day after it moves the schedule on by one.
 * WHY:   Pure functions (no clock) so Today, the Plans page and tests agree on "today's day"
 *        and how far behind the reader is.
 * WHERE: desktop Plans page and Today; local-api plans.list.
 */
export function dayForDate(startedOn: DayKey, today: DayKey): number {
  return Math.max(1, dayKeyToJdn(today) - dayKeyToJdn(startedOn) + 1);
}

/** Share of days done, 0–1. */
export function planProgress(totalDays: number, completed: ReadonlySet<number>): number {
  if (totalDays <= 0) return 0;
  let done = 0;
  for (const day of completed) if (day >= 1 && day <= totalDays) done++;
  return done / totalDays;
}

/** The first day not yet done, or undefined when the plan is complete. */
export function nextUnreadDay(totalDays: number, completed: ReadonlySet<number>): number | undefined {
  for (let day = 1; day <= totalDays; day++) if (!completed.has(day)) return day;
  return undefined;
}

/** Days scheduled before today that are not done yet (today itself is never "behind"). */
export function daysBehind(
  startedOn: DayKey,
  today: DayKey,
  totalDays: number,
  completed: ReadonlySet<number>,
): number {
  const last = Math.min(dayForDate(startedOn, today) - 1, totalDays);
  let behind = 0;
  for (let day = 1; day <= last; day++) if (!completed.has(day)) behind++;
  return behind;
}

/**
 * SOURCE OF TRUTH KEYWORDS: passageGroups, formatPassages, plan day label, chapter run label
 * WHAT:  passageGroups splits a day's passages into groups: a run of consecutive whole chapters
 *        of one book is one group, any other passage is its own group. formatPassages labels
 *        them ("Genesis 1–3, Psalm 1") and joins with commas.
 * WHY:   "Genesis 1, Genesis 2, Genesis 3" is noise on a plan card, and one "Read" link per
 *        run is enough because the reader moves on chapter by chapter.
 * WHERE: desktop Plans page and Today's reading.
 */
export function passageGroups(passages: readonly VerseRange[]): VerseRange[][] {
  const groups: VerseRange[][] = [];
  for (const passage of passages) {
    const group = groups.at(-1);
    const prev = group?.at(-1);
    const continues =
      group !== undefined &&
      prev !== undefined &&
      isWholeChapter(prev) &&
      isWholeChapter(passage) &&
      splitVerseId(prev.start).ord === splitVerseId(passage.start).ord &&
      splitVerseId(prev.start).chapter + 1 === splitVerseId(passage.start).chapter;
    if (continues) group.push(passage);
    else groups.push([passage]);
  }
  return groups;
}

/** Label for one group from passageGroups. */
export function formatPassageGroup(group: readonly VerseRange[], locale: Locale): string {
  const first = group[0];
  const last = group.at(-1);
  if (!first || !last) return "";
  if (group.length === 1) return formatRange(first, locale);
  const a = splitVerseId(first.start);
  const book = bookByOrd(a.ord);
  return book ? `${book[locale].short} ${a.chapter}–${splitVerseId(last.start).chapter}` : "";
}

export function formatPassages(passages: readonly VerseRange[], locale: Locale): string {
  return passageGroups(passages)
    .map((g) => formatPassageGroup(g, locale))
    .join(", ");
}
