import { describe, expect, it } from "vitest";

import { normalizeForSearch } from "./normalize";
import {
  addToVocabulary,
  createTally,
  formatSearchQuery,
  highlightMatches,
  likePatterns,
  matchesQuery,
  normalizeWithMap,
  parseScope,
  parseSearchQuery,
  scopeBooks,
  scopeRange,
  splitBySpans,
  suggestQuery,
  tallyVerse,
} from "./search";

const JOHN_3_16 =
  "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.";
const JOHN_3_16_AM = "በእርሱ የሚያምን ሁሉ የዘላለም ሕይወት እንዲኖረው እንጂ እንዳይጠፋ እግዚአብሔር አንድያ ልጁን እስከ መስጠት ድረስ ዓለሙን እንዲሁ ወዶአልና፤";
const SIN_AM = "ኃጢአት የሠራ ሁሉ ዐመፅን ደግሞ ይሠራል፤ ኃጢአትም ዐመፅ ነው።";

const matches = (text: string, query: string, mode: "partial" | "whole" = "partial") =>
  matchesQuery(normalizeForSearch(text), parseSearchQuery(query), mode);

/** The highlighted pieces of the original text. */
const marked = (text: string, query: string, mode: "partial" | "whole" = "partial") =>
  splitBySpans(text, highlightMatches(text, parseSearchQuery(query), mode))
    .filter((p) => p.hit)
    .map((p) => p.text);

describe("parseSearchQuery", () => {
  it("reads words, phrases and exclusions", () => {
    const q = parseSearchQuery(`love "only begotten" -hate -"the world"`);
    expect(q.include.map((t) => [t.norm, t.phrase])).toEqual([
      ["love", false],
      ["only begotten", true],
    ]);
    expect(q.exclude.map((t) => [t.norm, t.phrase])).toEqual([
      ["hate", false],
      ["the world", true],
    ]);
  });

  it("accepts curly and guillemet quotes, folds case and accents, drops duplicates", () => {
    const q = parseSearchQuery("«የዘላለም ሕይወት» “Café” LOVE love");
    expect(q.include.map((t) => t.norm)).toEqual([normalizeForSearch("የዘላለም ሕይወት"), "cafe", "love"]);
  });

  it("splits on Ethiopic word separators and ignores a lone minus", () => {
    const q = parseSearchQuery("ኢየሱስ፡ክርስቶስ - ");
    expect(q.include.map((t) => t.norm)).toEqual(["ኢየሱስ", "ክርስቶስ"]);
    expect(q.exclude).toEqual([]);
    expect(q.include[0]?.ethiopic).toBe(true);
  });

  it("round-trips through formatSearchQuery", () => {
    expect(formatSearchQuery(parseSearchQuery(`Love "Only Begotten" -hate`))).toBe(`love "only begotten" -hate`);
  });
});

describe("matchesQuery", () => {
  it("needs every word, in any order", () => {
    expect(matches(JOHN_3_16, "world love")).toBe(true);
    expect(matches(JOHN_3_16, "world hate")).toBe(false);
  });

  it("matches a word start in partial mode and the whole word in whole mode", () => {
    expect(matches(JOHN_3_16, "love")).toBe(true); // loved
    expect(matches(JOHN_3_16, "love", "whole")).toBe(false);
    expect(matches(JOHN_3_16, "loved", "whole")).toBe(true);
    expect(matches("This is my beloved Son", "love")).toBe(false);
  });

  it("matches phrases only when the words are adjacent", () => {
    expect(matches(JOHN_3_16, '"only begotten son"')).toBe(true);
    expect(matches(JOHN_3_16, '"begotten only"')).toBe(false);
    expect(matches(JOHN_3_16, '"the world that"')).toBe(true); // punctuation does not break a phrase
  });

  it("excludes words and phrases", () => {
    expect(matches(JOHN_3_16, "love -perish")).toBe(false);
    expect(matches(JOHN_3_16, 'love -"perish not"')).toBe(true);
  });

  it("finds Amharic homophone spellings: ሀጢአት finds ኃጢአት", () => {
    expect(matches(SIN_AM, "ሀጢአት")).toBe(true);
    expect(matches(SIN_AM, "ሐጢአት", "whole")).toBe(true);
    expect(matches(SIN_AM, "አመፅ")).toBe(true); // ዐመፅ
    expect(matches(SIN_AM, "ሰራ")).toBe(true); // ሠራ inside የሠራ
  });

  it("matches Amharic inside words in partial mode only", () => {
    expect(matches(JOHN_3_16_AM, "ዘላለም")).toBe(true); // የዘላለም
    expect(matches(JOHN_3_16_AM, "ዘላለም", "whole")).toBe(false);
    expect(matches(JOHN_3_16_AM, "የዘላለም", "whole")).toBe(true);
    expect(matches(JOHN_3_16_AM, '"የዘላለም ሕይወት"')).toBe(true);
    expect(matches(JOHN_3_16_AM, "እግዚአብሔር -ዓለሙ")).toBe(false);
  });

  it("matches nothing for an empty or exclusion-only query", () => {
    expect(matches(JOHN_3_16, "")).toBe(false);
    expect(matches(JOHN_3_16, "-hate")).toBe(false);
  });
});

describe("highlightMatches", () => {
  it("marks whole words in the original text without changing it", () => {
    expect(marked(JOHN_3_16, "love world")).toEqual(["loved", "world"]);
    expect(marked(JOHN_3_16, '"only begotten"')).toEqual(["only begotten"]);
    expect(marked("Naïve café, CAFÉ!", "cafe")).toEqual(["café", "CAFÉ"]);
  });

  it("marks Amharic words written with other homophone letters", () => {
    expect(marked(SIN_AM, "ሀጢአት")).toEqual(["ኃጢአት", "ኃጢአትም"]);
    expect(marked(JOHN_3_16_AM, "አለሙ")).toEqual(["ዓለሙን"]);
  });

  it("keeps offsets in step with normalizeForSearch", () => {
    for (const text of [JOHN_3_16, JOHN_3_16_AM, SIN_AM, "  “Lord,” said he—“É ½”  "]) {
      const map = normalizeWithMap(text);
      expect(map.norm).toBe(normalizeForSearch(text));
      expect(map.from).toHaveLength(map.norm.length);
    }
  });

  it("splits text into plain and marked parts that rebuild the original", () => {
    const parts = splitBySpans(JOHN_3_16_AM, highlightMatches(JOHN_3_16_AM, parseSearchQuery("ሕይወት"), "partial"));
    expect(parts.map((p) => p.text).join("")).toBe(JOHN_3_16_AM);
    expect(parts.filter((p) => p.hit).map((p) => p.text)).toEqual(["ሕይወት"]);
  });
});

describe("scope", () => {
  it("maps scopes to books and verse id ranges", () => {
    expect(scopeBooks("all")).toHaveLength(66);
    expect(scopeBooks("OT")).toHaveLength(39);
    expect(scopeBooks("NT")).toHaveLength(27);
    expect(scopeRange("NT")).toEqual({ start: 40_000_000, end: 66_999_999 });
    expect(scopeRange("JHN")).toEqual({ start: 43_000_000, end: 43_999_999 });
    expect(scopeRange("all")).toEqual({ start: 1_000_000, end: 66_999_999 });
  });

  it("parses scopes, falling back to the whole Bible", () => {
    expect(parseScope("jhn")).toBe("JHN");
    expect(parseScope("NT")).toBe("NT");
    expect(parseScope("nonsense")).toBe("all");
    expect(parseScope(undefined)).toBe("all");
  });
});

describe("likePatterns", () => {
  it("escapes LIKE wildcards", () => {
    expect(likePatterns(parseSearchQuery('love "only begotten"'))).toEqual(["%love%", "%only begotten%"]);
    expect(likePatterns({ include: [{ norm: "a_b%", phrase: false, ethiopic: false }], exclude: [] })).toEqual([
      "%a\\_b\\%%",
    ]);
  });
});

describe("tally", () => {
  it("counts every match and per book but keeps only the limit", () => {
    const tally = createTally<{ vid: number }>(1);
    const q = parseSearchQuery("love");
    tallyVerse(tally, { vid: 43_003_016 }, "god so loved", q, "partial");
    tallyVerse(tally, { vid: 62_004_008 }, "god is love", q, "partial");
    tallyVerse(tally, { vid: 62_004_009 }, "no match", q, "partial");
    expect(tally.total).toBe(2);
    expect(tally.hits).toEqual([{ vid: 43_003_016 }]);
    expect([...tally.perBook]).toEqual([
      [43, 1],
      [62, 1],
    ]);
  });
});

describe("suggestQuery", () => {
  const vocabulary = new Map<string, number>();
  for (const text of [JOHN_3_16, JOHN_3_16_AM, SIN_AM, "the righteousness of god", "righteous men"]) {
    addToVocabulary(vocabulary, normalizeForSearch(text));
  }

  it("suggests the closest word the translation uses", () => {
    expect(suggestQuery(parseSearchQuery("rightousness"), vocabulary, "partial")).toBe("righteousness");
    expect(suggestQuery(parseSearchQuery("begoten son"), vocabulary, "partial")).toBe("begotten son");
    expect(suggestQuery(parseSearchQuery("ሕይወቶ"), vocabulary, "whole")).toBe(normalizeForSearch("ሕይወት"));
  });

  it("returns nothing when every word exists or nothing is close", () => {
    expect(suggestQuery(parseSearchQuery("love"), vocabulary, "partial")).toBeUndefined();
    expect(suggestQuery(parseSearchQuery("xylophone"), vocabulary, "partial")).toBeUndefined();
  });
});
