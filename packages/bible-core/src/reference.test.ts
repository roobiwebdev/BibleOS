import { describe, expect, it } from "vitest";

import { formatReference, matchBooks, parseReference, referenceRange } from "./reference";

const code = (input: string) => parseReference(input)?.book.code;

describe("parseReference", () => {
  it.each([
    ["John 3:16", "JHN"],
    ["jn 3:16", "JHN"],
    ["Jhon 3", "JHN"], // typo
    ["1 John 1:9", "1JN"],
    ["1jn1:9", "1JN"],
    ["First John 1", "1JN"],
    ["Isa 53", "ISA"],
    ["1 Thess 4", "1TH"],
    ["Psalm 23", "PSA"],
    ["Song of Songs 2", "SNG"],
    ["Revelations 21", "REV"], // common misspelling
    ["ዮሐ 3፥16", "JHN"],
    ["ዮሐንስ 3:16", "JHN"],
    ["ዮሀንስ 3", "JHN"], // homophone spelling
    ["1ኛ ዮሐንስ 1፡9", "1JN"],
    ["1ዮሐ 1:9", "1JN"],
    ["ሁለተኛ ቆሮንቶስ 5", "2CO"],
    ["ዘፍጥረት 1", "GEN"],
    ["መዝ 23", "PSA"],
    ["ራእይ 22", "REV"],
  ])("%s → %s", (input, expected) => {
    expect(code(input)).toBe(expected);
  });

  it("reads verse and chapter ranges", () => {
    expect(parseReference("John 3:16-18")).toMatchObject({ chapter: 3, verse: 16, endVerse: 18 });
    expect(parseReference("1 John 1:9-2:2")).toMatchObject({ chapter: 1, verse: 9, endChapter: 2, endVerse: 2 });
    expect(parseReference("Gen 1-3")).toMatchObject({ chapter: 1, endChapter: 3 });
    expect(parseReference("Ruth")).toMatchObject({ chapter: 1 });
  });

  it("rejects impossible references", () => {
    expect(parseReference("Jude 2")).toBeUndefined();
    expect(parseReference("John 3:18-16")).toBeUndefined();
    expect(parseReference("Xyzzy 1")).toBeUndefined();
  });

  it("formats per locale", () => {
    const ref = parseReference("jn 3:16-18");
    expect(ref && formatReference(ref, "en")).toBe("John 3:16–18");
    expect(ref && formatReference(ref, "am")).toBe("ዮሐንስ 3፥16–18");
  });

  it("produces verse-id ranges", () => {
    const ref = parseReference("John 3");
    expect(ref && referenceRange(ref)).toEqual({ start: 43_003_000, end: 43_003_999 });
  });

  it("suggests books by prefix in canonical order", () => {
    expect(matchBooks("jo").map((b) => b.code)).toEqual(["JOS", "JOB", "JOL", "JON", "JHN"]);
  });
});
