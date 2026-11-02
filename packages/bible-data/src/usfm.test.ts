import { describe, expect, it } from "vitest";

import { parseUsfm } from "./usfm";

describe("parseUsfm", () => {
  it("reads titles, chapters and verses, dropping Strong's numbers and footnotes", () => {
    const book = parseUsfm(String.raw`\id GEN eng-kjv2006
\h Genesis
\toc1 The First Book of Moses, Called Genesis
\toc2 Genesis
\mt1 The First Book of Moses, Called Genesis
\c 1
\p
\v 1 In the \w beginning|strong="H7225"\w* \w God|strong="H0430"\w* created the heaven and the earth.
\v 2 And the earth was \add without\add* form.\f + \fr 1.2 \ft void: Heb. empty\f*
`);
    expect(book.code).toBe("GEN");
    expect(book.title).toEqual({ h: "Genesis", toc1: "The First Book of Moses, Called Genesis", toc2: "Genesis" });
    expect(book.verses).toEqual([
      { chapter: 1, verse: 1, verseEnd: 1, style: "p", text: "In the beginning God created the heaven and the earth." },
      { chapter: 1, verse: 2, verseEnd: 2, style: "c", text: "And the earth was without form." },
    ]);
  });

  it("keeps merged Amharic verses as one span", () => {
    const book = parseUsfm(`\\id JHN\n\\c 1\n\\p\n\\v 23 ቃል።\n\\v 24-26 ዮሐንስ መልሶ። እኔ በውኃ አጠምቃለሁ፤\n\\v 27 ቀጣይ።\n`);
    expect(book.verses.map((v) => [v.verse, v.verseEnd])).toEqual([
      [23, 23],
      [24, 26],
      [27, 27],
    ]);
    expect(book.verses[1]?.text).toBe("ዮሐንስ መልሶ። እኔ በውኃ አጠምቃለሁ፤");
  });

  it("ignores Door43 chunk markers and chapter labels", () => {
    const book = parseUsfm(`\\id GEN\n\\c 1\n\\cl ምዕራፍ 1\n\\s5\n\\p\n\\v 1 መጀመሪያ\n\\s5\n\\v 2 ምድርም\n`);
    expect(book.headings).toEqual([]);
    expect(book.verses.map((v) => v.text)).toEqual(["መጀመሪያ", "ምድርም"]);
  });

  it("attaches headings and psalm titles to the next verse", () => {
    const book = parseUsfm(String.raw`\id PSA
\c 3
\d A Psalm of David, when he fled from Absalom his son.
\q1
\v 1 LORD, how are they increased that trouble me!
\q2 many are they that rise up against me.
\s1 Salvation Belongs to the LORD
\q1
\v 2 Many there be which say of my soul,
`);
    expect(book.headings).toEqual([
      { chapter: 3, beforeVerse: 1, level: "d", text: "A Psalm of David, when he fled from Absalom his son." },
      { chapter: 3, beforeVerse: 2, level: "s", text: "Salvation Belongs to the LORD" },
    ]);
    expect(book.verses[0]).toMatchObject({
      style: "q1",
      text: "LORD, how are they increased that trouble me!\nmany are they that rise up against me.",
    });
    expect(book.verses[1]?.style).toBe("q1");
  });

  it("drops cross-references and keeps words of Jesus as plain text", () => {
    const book = parseUsfm(String.raw`\id JHN
\c 3
\p
\v 16 \wj For God so loved the world,\wj* \x - \xo 3:16 \xt Rom 5:8\x*that he gave
`);
    expect(book.verses[0]?.text).toBe("For God so loved the world, that he gave");
  });

  it("turns a leading pilcrow into a paragraph start", () => {
    const book = parseUsfm(`\\id JHN\n\\c 3\n\\v 15 That whosoever\n\\v 16 ¶ For God so loved the world\n`);
    expect(book.verses[1]).toMatchObject({ style: "p", text: "For God so loved the world" });
  });
});
