import { readFileSync } from "node:fs";
import { join } from "node:path";

import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";

import {
  checkVerseGrid,
  cleanChapter,
  emptyCleanReport,
  findLeftoverReferences,
  readJsonChapters,
  stripCrossReferences,
} from "./json-chapters";
import { archiveFileName, LOCAL_SOURCES_DIR, TRANSLATIONS } from "./manifest";
import type { UsfmBook } from "./usfm";

const strip = (text: string, verse = 1) => stripCrossReferences(text, verse).text;

const makeChapter = (verses: Array<[number, string]>) => ({
  bookCode: "COL",
  bookName: "ወደ ቆላስይስ ሰዎች",
  chapter: 4,
  verses: verses.map(([verse, text]) => ({ verse, text })),
});

const makeBook = (code: string, last: Array<[number, number]>): UsfmBook => ({
  code,
  title: {},
  headings: [],
  verses: last.flatMap(([chapter, n]) =>
    Array.from({ length: n }, (_, i) => ({ chapter, verse: i + 1, verseEnd: i + 1, style: "p" as const, text: "x" })),
  ),
});

describe("stripCrossReferences", () => {
  it("removes references at the end and the start", () => {
    expect(strip("በመጀመሪያ እግዚአብሔር ሰማያትንና ምድርን ፈጠረ። ዘፍ. 5፥1-2")).toBe("በመጀመሪያ እግዚአብሔር ሰማያትንና ምድርን ፈጠረ።");
    expect(strip("2ቆሮ. 4፥6 ከዚህ በኋላ እግዚአብሔር “ውሃውን ከውሃ የሚለይ ጠፈር ይሁን” አለ፤ ማር. 10፥6", 6)).toBe(
      "ከዚህ በኋላ እግዚአብሔር “ውሃውን ከውሃ የሚለይ ጠፈር ይሁን” አለ፤",
    );
    expect(strip("ገላ. 5፥9 ከዚህ በፊት በጻፍኩላችሁ መልእክት", 9)).toBe("ከዚህ በፊት በጻፍኩላችሁ መልእክት");
  });

  it("removes chains, including bare chapter:verse and trailing chapter numbers", () => {
    expect(strip("ምሕረቱ ለዘለዓለም ነው። 106፥1 107፥1 118፥1 136")).toBe("ምሕረቱ ለዘለዓለም ነው።");
    expect(strip("26፥ 7፥3 ቃሉን ስሙ።", 3)).toBe("ቃሉን ስሙ።");
    expect(strip("ኤር. 49፥7-22 35፥1-15 የኤዶም ጅረቶች ይለወጣሉ።", 9)).toBe("የኤዶም ጅረቶች ይለወጣሉ።");
    expect(strip("ዐረፈ። ዘዳ. 15፥7-11 ዘኍ. 30፥1-16 ሮም 4፥13 ኢያሱ 7፥1-26")).toBe("ዐረፈ።");
  });

  it("treats a verse made only of references or numbers as empty", () => {
    expect(strip("1ዜ.መ. 29፥27", 27)).toBe("");
    expect(strip("1ነገ. 7፥40-47", 40)).toBe("");
    expect(strip("ፊልሞና 24 ፊልሞና 24", 24)).toBe("");
    expect(strip("31", 31)).toBe("");
    expect(strip("15፥37-39", 37)).toBe("");
  });

  it("removes echoed verse-number labels only when they name this verse", () => {
    expect(strip("10 የአትክልት ቦታውን የሚያጠጣ ወንዝ ይፈስ ነበር፤", 10)).toBe("የአትክልት ቦታውን የሚያጠጣ ወንዝ ይፈስ ነበር፤");
    expect(strip("31-35 ዮሐ. 6፥31 የእግዚአብሔር ቊጣ ተነሣ።", 31)).toBe("የእግዚአብሔር ቊጣ ተነሣ።");
    expect(strip("ፍሬው አይበላም። 23 15፥23", 23)).toBe("ፍሬው አይበላም።");
    expect(strip("10 ሰዎች መጡ።", 4)).toBe("10 ሰዎች መጡ።");
  });

  it("keeps numbers and names that belong to the text", () => {
    // A list total at the end, not after punctuation, is scripture.
    expect(strip("ከሐሹም ወገን 223 ከጊባር ወገን 95", 95)).toBe("ከሐሹም ወገን 223 ከጊባር ወገን 95");
    expect(strip("ዕድሜው 910 ሲሆነውም ሞተ። ይሁዳ 14", 14)).toBe("ዕድሜው 910 ሲሆነውም ሞተ።");
    // Short book names are also people.
    expect(strip("ኢያሱ ሕዝቡን ባዘዘው መሠረት ሄዱ፤")).toBe("ኢያሱ ሕዝቡን ባዘዘው መሠረት ሄዱ፤");
  });

  it("never changes punctuation, quotes or parentheses", () => {
    const text = "ውሃ (ውቅያኖስ) ሆነ፤ “ብርሃን ይሁን” አለ፦ ‘አሜን!’";
    expect(strip(`ዘፍ. 1፥2 ${text} ኢሳ. 45፥7`)).toBe(text);
  });

  it("removes a chain standing between two sentences, never one inside a sentence", () => {
    expect(strip("ቴዎፍሎስ ሆይ! ሉቃ. 1፥1-4 በመጀመሪያ መጽሐፌ ጽፌአለሁ።")).toBe("ቴዎፍሎስ ሆይ! በመጀመሪያ መጽሐፌ ጽፌአለሁ።");
    expect(strip("ቅበረኝ።” ዘፍ. 49፥29-32 ዮሴፍም “እሺ” አለው።")).toBe("ቅበረኝ።” ዮሴፍም “እሺ” አለው።");
    expect(strip("ከጢሞቴዎስ፥ ሐ.ሥ. 18፥1 በቆሮንቶስ ለምትገኘው")).toBe("ከጢሞቴዎስ፥ ሐ.ሥ. 18፥1 በቆሮንቶስ ለምትገኘው");
    expect(strip("ሰው ድምፅ” ኢሳ. 40፥3 ብሎ ተናገረ።")).toBe("ሰው ድምፅ” ኢሳ. 40፥3 ብሎ ተናገረ።");
  });
});

describe("cleanChapter", () => {
  it("drops fake verses and keeps real ones numbered 1..N", () => {
    const report = emptyCleanReport();
    const verses = cleanChapter(
      makeChapter([
        [1, "ጌቶች ሆይ! ኤፌ. 6፥9"],
        [2, "ጸልዩ፤"],
        [21, "ኤፌ. 6፥21-22"],
        [24, "ፊልሞና 24 ፊልሞና 24"],
        [25, "25"],
      ]),
      report,
    );
    expect(verses.map((v) => [v.verse, v.text])).toEqual([
      [1, "ጌቶች ሆይ!"],
      [2, "ጸልዩ፤"],
    ]);
    expect(report.fakeVerses.map((v) => v.verse)).toEqual([21, 24, 25]);
  });

  it("joins a verse the export repeats under several numbers into one span", () => {
    const report = emptyCleanReport();
    const verses = cleanChapter(
      makeChapter([
        [1, "በሁለተኛው ቀን ናትናኤል ነበር።"],
        [2, "በሁለተኛው ቀን ናትናኤል ነበር። ዘኍ. 1፥8"],
        [3, "በሦስተኛው ቀን ኤሊአብ ነበር።"],
      ]),
      report,
    );
    expect(verses.map((v) => [v.verse, v.verseEnd])).toEqual([
      [1, 2],
      [3, 3],
    ]);
    expect(report.mergedSpans).toEqual([{ code: "COL", chapter: 4, verse: 1, verseEnd: 2 }]);
  });

  it("accepts a repeated number only when the later copy is junk", () => {
    const report = emptyCleanReport();
    cleanChapter(
      makeChapter([
        [1, "ጸልዩ፤"],
        [1, "ኤፌ. 6፥1"],
      ]),
      report,
    );
    expect(report.duplicateNumbers).toHaveLength(1);
    expect(() =>
      cleanChapter(
        makeChapter([
          [1, "ጸልዩ፤"],
          [1, "ሌላ ቃል።"],
        ]),
        emptyCleanReport(),
      ),
    ).toThrow(/appears twice/);
  });

  it("fails on a gap in the verse numbers", () => {
    expect(() =>
      cleanChapter(
        makeChapter([
          [1, "ጸልዩ፤"],
          [3, "ንገሩ።"],
        ]),
        emptyCleanReport(),
      ),
    ).toThrow(/verses 2 are missing/);
  });
});

describe("checkVerseGrid", () => {
  const grid = new Map([
    ["3JN 1", 14],
    ["JUD 1", 25],
  ]);

  it("passes when every chapter matches or is a reviewed exception", () => {
    expect(checkVerseGrid([makeBook("3JN", [[1, 15]]), makeBook("JUD", [[1, 25]])], grid, { "3JN 1": 15 })).toEqual([]);
  });

  it("reports a difference that is not an exception, and an exception that matches nothing", () => {
    expect(checkVerseGrid([makeBook("3JN", [[1, 15]]), makeBook("JUD", [[1, 25]])], grid, { "JUD 1": 26 })).toEqual([
      "3JN 1: ends at verse 15, the KJV at 14",
      "JUD 1: listed as an exception but matches no difference",
    ]);
  });
});

describe("Amharic 2005 export", () => {
  const source = TRANSLATIONS.find((t) => t.id === "am-2005");
  if (!source) throw new Error("am-2005 is missing from the manifest");
  const zip = readFileSync(join(import.meta.dirname, "..", LOCAL_SOURCES_DIR, archiveFileName(source)));
  const { books, report } = readJsonChapters(unzipSync(zip, { filter: (f) => f.name.endsWith(".json") }));
  const verse = (code: string, chapter: number, n: number) =>
    books.find((b) => b.code === code)?.verses.find((v) => v.chapter === chapter && v.verse === n)?.text;

  it("has 66 books and 1,189 chapters, each running 1..N", () => {
    expect(books).toHaveLength(66);
    const chapters = new Set(books.flatMap((b) => b.verses.map((v) => `${b.code} ${v.chapter}`)));
    expect(chapters.size).toBe(1189);
    for (const book of books) {
      const byChapter = Map.groupBy(book.verses, (v) => v.chapter);
      for (const [chapter, verses] of byChapter) {
        let next = 1;
        for (const v of verses) {
          expect(v.verse, `${book.code} ${chapter}:${v.verse}`).toBe(next);
          next = v.verseEnd + 1;
        }
      }
    }
  });

  it("covers 31,104 verses with no references left", () => {
    const covered = books.flatMap((b) => b.verses).reduce((n, v) => n + v.verseEnd - v.verse + 1, 0);
    expect(covered).toBe(31_104);
    expect(findLeftoverReferences(books)).toEqual([]);
    expect(report.duplicateNumbers.every((v) => v.after === "")).toBe(true);
  });

  it("matches the spot checks", () => {
    expect(verse("GEN", 1, 1)).toBe("በመጀመሪያ እግዚአብሔር ሰማያትንና ምድርን ፈጠረ።");
    expect(verse("1CO", 5, 9)?.startsWith("ከዚህ በፊት")).toBe(true);
    expect(verse("ROM", 16, 27)?.endsWith("አሜን።")).toBe(true);
    expect(verse("3JN", 1, 15)).toBe("ሰላም ለአንተ ይሁን። ወዳጆች ሰላምታ ያቀርቡልሃል። አንተም ለወዳጆቻችን አንድ በአንድ ሰላምታ አቅርብልን።");
    expect(verse("JOS", 15, 18)).toContain("(መሳ 1፥14 ተመልከት)");
    expect(verse("2CO", 1, 1)).toContain("ከጢሞቴዎስ፥ በቆሮንቶስ");
    expect(verse("MAT", 3, 3)).toContain("ሰው ድምፅ” ብሎ ነቢዩ");
  });
});
