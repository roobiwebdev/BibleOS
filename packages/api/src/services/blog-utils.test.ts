import { describe, expect, it } from "vitest";

import { pageCount, resolvePublishedAt, slugify } from "./blog-utils";

describe("slugify", () => {
  it("lowercases and hyphenates words", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });
  it("strips punctuation and collapses separators", () => {
    expect(slugify("  Hello,   World!! -- Again ")).toBe("hello-world-again");
  });
  it("returns empty string when nothing usable remains", () => {
    expect(slugify("!!!")).toBe("");
  });
});

describe("resolvePublishedAt", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  const earlier = new Date("2025-06-01T00:00:00Z");
  it("stamps now on first publish", () => {
    expect(resolvePublishedAt(true, null, now)).toEqual(now);
  });
  it("keeps the original publish date on republish", () => {
    expect(resolvePublishedAt(true, earlier, now)).toEqual(earlier);
  });
  it("clears the date when unpublished", () => {
    expect(resolvePublishedAt(false, earlier, now)).toBeNull();
  });
});

describe("pageCount", () => {
  it("rounds up", () => {
    expect(pageCount(31, 15)).toBe(3);
    expect(pageCount(0, 15)).toBe(0);
  });
});
