import { describe, expect, it } from "vitest";

import { BOOKS } from "./books";
import {
  BUILT_IN_PLANS,
  builtInPlan,
  customPlan,
  dayForDate,
  daysBehind,
  formatPassages,
  nextUnreadDay,
  passageGroups,
  PLAN_KEYS,
  planPace,
  planProgress,
  spreadOverDays,
  type PlanDefinition,
} from "./plans";
import { chapterRange, isWholeChapter } from "./range";
import { splitVerseId, verseIdFromCode } from "./verse-id";

const v = (code: string, chapter: number, verse = 0) => verseIdFromCode(code, chapter, verse) ?? 0;
const chapters = (plan: PlanDefinition) => plan.days.flat();
const plan = (key: string) => {
  const found = builtInPlan(key);
  if (!found) throw new Error(`missing plan ${key}`);
  return found;
};
const chapterCount = (codes: string[]) =>
  BOOKS.filter((b) => codes.includes(b.code)).reduce((sum, b) => sum + b.chapters, 0);

describe("plan generation", () => {
  it("spreads chapters evenly, sizes differing by at most one", () => {
    const passages = Array.from({ length: 89 }, (_x, i) => chapterRange(v("MAT", 1) + i * 1000));
    const days = spreadOverDays(passages, 30);
    expect(days).toHaveLength(30);
    const sizes = days.map((d) => d.length);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    expect(days.flat()).toEqual(passages);
  });

  it("drops days it cannot fill", () => {
    expect(spreadOverDays([chapterRange(v("JUD", 1))], 10)).toHaveLength(1);
  });

  it("ships seven plans with unique keys", () => {
    expect(BUILT_IN_PLANS.map((p) => p.key)).toEqual([...PLAN_KEYS]);
    for (const p of BUILT_IN_PLANS) {
      expect(p.title.am.length).toBeGreaterThan(0);
      expect(p.days.every((d) => d.length > 0)).toBe(true);
    }
  });

  it("builds each plan to its advertised length and coverage", () => {
    expect(plan("gospels-30").days).toHaveLength(30);
    expect(chapters(plan("gospels-30"))).toHaveLength(chapterCount(["MAT", "MRK", "LUK", "JHN"]));
    expect(plan("nt-90").days).toHaveLength(90);
    expect(chapters(plan("nt-90"))).toHaveLength(260);
    expect(plan("bible-year").days).toHaveLength(365);
    expect(chapters(plan("bible-year"))).toHaveLength(1189);
    expect(plan("bible-year").days[0]?.[0]).toEqual(chapterRange(v("GEN", 1)));
    expect(plan("bible-year").days.at(-1)?.at(-1)).toEqual(chapterRange(v("REV", 22)));
    expect(plan("john-21").days).toHaveLength(21);
    expect(plan("sermon-mount").days).toHaveLength(7);
    expect(plan("psalms-proverbs").days).toHaveLength(31);
  });

  it("reads the OT once and the NT and Psalms twice in the year plan", () => {
    const all = chapters(plan("through-bible-year"));
    const count = (code: string) =>
      all.filter((r) => splitVerseId(r.start).ord === (BOOKS.find((b) => b.code === code)?.ord ?? -1)).length;
    expect(plan("through-bible-year").days).toHaveLength(365);
    expect(count("GEN")).toBe(50);
    expect(count("PSA")).toBe(300);
    expect(count("MAT")).toBe(56);
  });

  it("gives five psalms and one proverb a day", () => {
    const day1 = plan("psalms-proverbs").days[0] ?? [];
    expect(day1.map((r) => splitVerseId(r.start).chapter)).toEqual([1, 31, 61, 91, 121, 1]);
    const all = chapters(plan("psalms-proverbs"));
    expect(new Set(all.map((r) => r.start)).size).toBe(181);
  });

  it("keeps the Sermon on the Mount to Matthew 5–7 in verse ranges", () => {
    const days = plan("sermon-mount").days.flat();
    expect(days[0]).toEqual({ start: v("MAT", 5, 1), end: v("MAT", 5, 12) });
    expect(days.some(isWholeChapter)).toBe(false);
  });

  it("makes a custom plan from books in canonical order", () => {
    const custom = customPlan(["rom", "GAL", "ROM"], 10);
    expect(custom.days).toHaveLength(10);
    expect(chapters(custom)).toHaveLength(22);
    expect(custom.days[0]?.[0]).toEqual(chapterRange(v("ROM", 1)));
    expect(planPace(custom)).toBe(2.2);
    expect(customPlan(["NOPE"], 5).days).toEqual([]);
  });
});

describe("plan schedule", () => {
  it("counts calendar days from the start", () => {
    expect(dayForDate("2026-11-01", "2026-11-01")).toBe(1);
    expect(dayForDate("2026-10-30", "2026-11-02")).toBe(4);
    expect(dayForDate("2026-12-31", "2027-01-01")).toBe(2);
    // A start in the future still shows day 1.
    expect(dayForDate("2026-11-05", "2026-11-01")).toBe(1);
  });

  it("computes progress and the next unread day", () => {
    const done = new Set([1, 2, 4, 99]);
    expect(planProgress(4, done)).toBe(0.75);
    expect(nextUnreadDay(4, done)).toBe(3);
    expect(nextUnreadDay(2, done)).toBeUndefined();
    expect(planProgress(0, done)).toBe(0);
  });

  it("counts days behind, never today", () => {
    const start = "2026-11-01";
    expect(daysBehind(start, "2026-11-01", 30, new Set())).toBe(0);
    expect(daysBehind(start, "2026-11-04", 30, new Set([1]))).toBe(2);
    // Past the end of a 3-day plan, only its 3 days can be behind.
    expect(daysBehind(start, "2026-12-01", 3, new Set([2]))).toBe(2);
  });
});

describe("formatPassages", () => {
  it("collapses runs of whole chapters", () => {
    const days = [
      chapterRange(v("GEN", 1)),
      chapterRange(v("GEN", 2)),
      chapterRange(v("GEN", 3)),
      chapterRange(v("EXO", 1)),
    ];
    expect(formatPassages(days, "en")).toBe("Genesis 1–3, Exodus 1");
    expect(formatPassages([chapterRange(v("PSA", 1)), chapterRange(v("PSA", 31))], "en")).toBe("Psalm 1, Psalm 31");
    expect(formatPassages([{ start: v("MAT", 5, 1), end: v("MAT", 5, 12) }], "am")).toBe("ማቴዎስ 5፥1–12");
  });
});

describe("passageGroups", () => {
  it("groups runs of whole chapters in one book only", () => {
    const groups = passageGroups([
      chapterRange(v("GEN", 50)),
      chapterRange(v("EXO", 1)),
      chapterRange(v("EXO", 2)),
      { start: v("MAT", 5, 1), end: v("MAT", 5, 12) },
    ]);
    expect(groups.map((g) => g.length)).toEqual([1, 2, 1]);
  });
});
