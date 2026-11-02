import { describe, expect, it } from "vitest";

import { chapterRange, formatRange, overlaps, subtractRange } from "./range";

const r = (start: number, end = start) => ({ start: 46_013_000 + start, end: 46_013_000 + end });

describe("verse ranges", () => {
  it("detects overlap", () => {
    expect(overlaps(r(4, 7), r(7, 9))).toBe(true);
    expect(overlaps(r(4, 7), r(8, 9))).toBe(false);
  });

  it("splits a range when a middle verse is cut out", () => {
    expect(subtractRange(r(4, 7), r(5))).toEqual([r(4), r(6, 7)]);
    expect(subtractRange(r(4, 7), r(4, 7))).toEqual([]);
    expect(subtractRange(r(4, 7), r(9))).toEqual([r(4, 7)]);
  });

  it("formats ranges and whole chapters", () => {
    expect(formatRange(r(4, 7), "en")).toBe("1 Corinthians 13:4–7");
    expect(formatRange(r(4), "am")).toBe("1ኛ ቆሮንቶስ 13፥4");
    expect(formatRange(chapterRange(43_003_000), "en")).toBe("John 3");
  });
});
