import { makeVerseId } from "@starter/bible-core/verse-id";
import { describe, expect, it } from "vitest";

import type { ChapterVerse } from "../../lib/bible/source";
import type { ShownChapter } from "../../lib/bible/use-chapter";
import { fitsOnlineLimits, trimForOnline, type WindowChapter } from "./use-chapter-window";

const shown = (id: string, ord: number, chapter: number, count: number): ShownChapter => ({
  id,
  data: {
    verses: Array.from({ length: count }, (_, i): ChapterVerse => {
      const vid = makeVerseId(ord, chapter, i + 1);
      return { vid, spanEnd: vid, label: String(i + 1), style: "p", text: "…" };
    }),
    headings: [],
  },
});

const chapter = (main: string, ord: number, n: number, count: number, second?: string): WindowChapter => ({
  vid: makeVerseId(ord, n, 0),
  main: shown(main, ord, n, count),
  second: second ? shown(second, ord, n, count) : undefined,
});

describe("online display limits in the continuous reader", () => {
  it("never limits bundled translations", () => {
    const psalms = Array.from({ length: 10 }, (_, i) => chapter("en-bsb", 19, 100 + i, 100));
    expect(fitsOnlineLimits(psalms)).toBe(true);
  });

  it("keeps an online translation within 500 verses on screen", () => {
    const six = Array.from({ length: 6 }, (_, i) => chapter("en-esv", 19, 100 + i, 90));
    expect(fitsOnlineLimits(six.slice(0, 5))).toBe(true); // 450 verses
    expect(fitsOnlineLimits(six)).toBe(false); // 540 verses
  });

  it("keeps an online translation within half a book (in chapters)", () => {
    // Philippians has 4 chapters: two may be shown, not three.
    const php = [1, 2, 3].map((n) => chapter("en-nlt", 50, n, 20));
    expect(fitsOnlineLimits(php.slice(0, 2))).toBe(true);
    expect(fitsOnlineLimits(php)).toBe(false);
  });

  it("counts the parallel column too, and failed (empty) chapters not at all", () => {
    const side = Array.from({ length: 6 }, (_, i) => chapter("en-bsb", 19, 100 + i, 90, "en-esv"));
    expect(fitsOnlineLimits(side)).toBe(false);
    const failed: WindowChapter = {
      ...chapter("en-esv", 19, 1, 0),
      main: { ...shown("en-esv", 19, 1, 0), error: "offline" },
    };
    expect(fitsOnlineLimits([failed, failed, failed])).toBe(true);
  });

  it("trims from the side the reader is leaving, never the chapter in view", () => {
    const php = [1, 2, 3].map((n) => chapter("en-nlt", 50, n, 20));
    const [c1, c2, c3] = php;
    expect(trimForOnline(php, c2?.vid, 1).map((c) => c.vid)).toEqual([c2?.vid, c3?.vid]);
    expect(trimForOnline(php, c2?.vid, -1).map((c) => c.vid)).toEqual([c1?.vid, c2?.vid]);
    // Moving forward with the last chapter in view drops the earliest ones.
    expect(trimForOnline(php, c3?.vid, 1).map((c) => c.vid)).toEqual([c2?.vid, c3?.vid]);
  });
});
