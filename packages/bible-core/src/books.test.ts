import { describe, expect, it } from "vitest";

import { BOOKS, bookByCode, bookByOrd } from "./books";
import { makeVerseId, splitVerseId, verseIdFromCode, chapterOf } from "./verse-id";

describe("book catalogue", () => {
  it("has the 66-book Protestant canon with 1,189 chapters", () => {
    expect(BOOKS).toHaveLength(66);
    expect(BOOKS.reduce((sum, b) => sum + b.chapters, 0)).toBe(1189);
    expect(BOOKS.filter((b) => b.testament === "OT")).toHaveLength(39);
  });

  it("has unique codes and contiguous order numbers", () => {
    expect(new Set(BOOKS.map((b) => b.code)).size).toBe(66);
    BOOKS.forEach((b, i) => expect(b.ord).toBe(i + 1));
    expect(bookByCode("jhn")?.en.name).toBe("John");
    expect(bookByOrd(43)?.code).toBe("JHN");
  });
});

describe("verse ids", () => {
  it("round-trips and sorts in reading order", () => {
    const vid = makeVerseId(43, 3, 16);
    expect(vid).toBe(43_003_016);
    expect(splitVerseId(vid)).toEqual({ ord: 43, chapter: 3, verse: 16 });
    expect(verseIdFromCode("JHN", 3, 16)).toBe(vid);
    expect(chapterOf(vid)).toBe(43_003_000);
    expect(makeVerseId(1, 50, 26)).toBeLessThan(makeVerseId(2, 1, 1));
  });

  it("rejects out-of-range parts", () => {
    expect(() => makeVerseId(1, 1, 1000)).toThrow(RangeError);
  });
});
