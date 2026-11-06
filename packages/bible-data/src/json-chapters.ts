import { bookByCode } from "@starter/bible-core/books";

import type { UsfmBook, UsfmVerse } from "./usfm";

/**
 * SOURCE OF TRUTH KEYWORDS: readJsonChapters, stripCrossReferences, JSON chapters parser, bible.com export, cross-reference cleaning, CROSS_REFERENCE_BOOKS, checkVerseGrid, VERSE_GRID_EXCEPTIONS
 * WHAT:  Reads a translation exported as one JSON file per chapter
 *        (`<root>/<USFM book code>/<chapter>.json`, `{ book_code, book_name, chapter, verses: [{ verse, text }] }`)
 *        into the same `UsfmBook` shape the USFM parser returns, after removing the
 *        cross-references the export glued into the text.
 * WHY:   The Amharic 2005 (አም05) export copied bible.com's "see also" links into the verses:
 *        whole fake verses made only of references (`1ዜ.መ. 29፥27`) and references stuck to the
 *        start or end of real verses (`… ፈጠረ። ዘፍ. 5፥1-2`). They were attached by verse number,
 *        not by meaning, so they are removed, never kept as data. Removal touches only the
 *        edges of a verse (and the gap between two sentences): the scripture itself is never
 *        changed beyond trimming whitespace. Every rule fails the build loudly instead of guessing.
 * WHERE: build.ts (sources with `format: "json-chapters"`), json-chapters.test.ts.
 */

export interface JsonChapterVerse {
  verse: number;
  text: string;
}

export interface JsonChapter {
  bookCode: string;
  bookName: string;
  chapter: number;
  verses: JsonChapterVerse[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isPositiveInt = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0;

/** Validates one chapter file; throws with the file name on any shape problem. */
export function parseJsonChapter(raw: unknown, name: string): JsonChapter {
  if (!isRecord(raw)) throw new Error(`${name}: not a JSON object`);
  const { book_code: bookCode, book_name: bookName, chapter, verses } = raw;
  if (typeof bookCode !== "string" || typeof bookName !== "string" || !isPositiveInt(chapter)) {
    throw new Error(`${name}: missing book_code, book_name or chapter`);
  }
  if (!Array.isArray(verses)) throw new Error(`${name}: verses is not a list`);
  const parsed: JsonChapterVerse[] = [];
  for (const verse of verses) {
    if (!isRecord(verse) || !isPositiveInt(verse.verse) || typeof verse.text !== "string") {
      throw new Error(`${name}: bad verse entry ${JSON.stringify(verse)}`);
    }
    parsed.push({ verse: verse.verse, text: verse.text });
  }
  return { bookCode, bookName, chapter, verses: parsed };
}

/**
 * Every Amharic book abbreviation the 2005 export uses in front of a cross-reference, collected
 * from the data (3ዮሐ. is added for completeness). Undotted entries are short names the export
 * writes without a dot (ሮም 15፥26, ኢያሱ 3፥14). "ዜና መ." appears once (2SA 17:25) without its
 * book number.
 */
export const CROSS_REFERENCE_BOOKS: readonly string[] = [
  // Old Testament
  "ዘፍ.",
  "ዘፀ.",
  "ዘሌ.",
  "ዘኍ.",
  "ዘዳ.",
  "ኢያሱ",
  "መሳ.",
  "ሩት",
  "1ሳሙ.",
  "2ሳሙ.",
  "1ነገ.",
  "2ነገ.",
  "1ዜ.መ.",
  "2ዜ.መ.",
  "ዜና መ.",
  "ዕዝ.",
  "ነህ.",
  "አስ.",
  "ኢዮብ",
  "መዝ.",
  "ምሳ.",
  "መክ.",
  "ኢሳ.",
  "ኤር.",
  "ሰቆ.ኤ.",
  "ሕዝ.",
  "ዳን.",
  "ሆሴዕ",
  "ኢዩ.",
  "አሞጽ",
  "አብ.",
  "ዮናስ",
  "ሚክ.",
  "ናሆም",
  "ዕን.",
  "ሶፎ.",
  "ሐጌ",
  "ዘካ.",
  "ሚል.",
  // New Testament
  "ማቴ.",
  "ማር.",
  "ሉቃ.",
  "ዮሐ.",
  "ሐ.ሥ.",
  "ሮም",
  "1ቆሮ.",
  "2ቆሮ.",
  "ገላ.",
  "ኤፌ.",
  "ፊል.",
  "ቆላ.",
  "1ተሰ.",
  "2ተሰ.",
  "1ጢሞ.",
  "2ጢሞ.",
  "ቲቶ",
  "ፊልሞና",
  "ዕብ.",
  "ያዕ.",
  "1ጴጥ.",
  "2ጴጥ.",
  "1ዮሐ.",
  "2ዮሐ.",
  "3ዮሐ.",
  "ይሁዳ",
  "ራዕ.",
];

/** One-chapter books, cited by verse only ("ፊልሞና 24", "ይሁዳ 14"). */
const ONE_CHAPTER_BOOKS: readonly string[] = ["አብ.", "ፊልሞና", "2ዮሐ.", "3ዮሐ.", "ይሁዳ"];

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const alternation = (list: readonly string[]) =>
  list
    .toSorted((a, b) => b.length - a.length)
    .map((item) => escape(item).replace(/ /g, "\\s"))
    .join("|");

const BOOK = `(?:${alternation(CROSS_REFERENCE_BOOKS)})`;
const ONE_CHAPTER = `(?:${alternation(ONE_CHAPTER_BOOKS)})`;
// 5፥1, 5፥1-2, 5፥1-6፥3, and the bare "26፥" the export sometimes leaves.
const CHAPTER_VERSE = String.raw`\d+፥(?:\d+(?:[-–]\d+(?:፥\d+)?)?)?`;
const NUMBER = String.raw`\d+(?:[-–]\d+)?`;
/** A single reference, ending at a word boundary. */
const REF = `(?:(?:${BOOK}\\s?)?${CHAPTER_VERSE}|${ONE_CHAPTER}\\s?${NUMBER})(?=\\s|$)`;
const ITEM = `(?:${REF}|${NUMBER}(?=\\s|$))`;

/** A reference at the start of a verse, with the space after it. */
const LEADING_REF = new RegExp(`^(${REF})\\s*`, "u");
/** Bare numbers at the start that sit in front of a reference (`136 ዘፍ. 1፥1`). */
const LEADING_NUMBERS = new RegExp(`^((?:${NUMBER}\\s+)+)(?=${REF})`, "u");
/** A reference at the end of a verse. */
const TRAILING_REF = new RegExp(`(?:^|\\s)(${REF})$`, "u");
/** Bare chapter numbers that trail a reference chain (`… 107፥1 118፥1 136`). */
const TRAILING_NUMBERS = new RegExp(`(?<=${REF})((?:\\s+${NUMBER})+)$`, "u");
/** A verse-number label: `10`, `31-35`. */
const LEADING_LABEL = /^(\d+)(?:[-–](\d+))?(?=\s|$)/u;
/** A label at the end counts only after sentence punctuation, so list totals (`… ወገን 95`) stay. */
const TRAILING_LABEL = /(?<=[።፥፤፦!?”’])\s+(\d+)(?:[-–](\d+))?$/u;
/** A whole "verse" made of references and numbers only (`1ነገ. 7፥40-47`, `ፊልሞና 24`, `31`). */
const ONLY_REFERENCES = new RegExp(`^\\s*${ITEM}(?:\\s+${ITEM})*\\s*$`, "u");
/**
 * A reference chain between two sentences: after sentence-final punctuation and before more
 * text (ACT 1:1 `ቴዎፍሎስ ሆይ! ሉቃ. 1፥1-4 በመጀመሪያ …`). bible.com put the link at a paragraph
 * break inside the verse; the punctuation (optionally followed by closing quotes) proves it is
 * not inside a sentence.
 */
const BETWEEN_SENTENCES = new RegExp(`(?<=[።!?፤፦][”’]*)\\s+(${REF}(?:\\s+(?:${NUMBER}\\s+)*${REF})*)\\s+(?=\\S)`, "gu");

/** Any chapter:verse reference shape left in text, used by the post-clean checks. */
export const REFERENCE_SHAPE = /\d+፥\d+/u;
/**
 * A book abbreviation left at an edge: a dotted one (`ዘፍ.`) first or last, or any of them last.
 * Undotted short names (ኢያሱ, ይሁዳ, ዮናስ) are also people, so a verse may start with one.
 */
const DOTTED_BOOK = `(?:${alternation(CROSS_REFERENCE_BOOKS.filter((b) => b.endsWith(".")))})`;
const EDGE_BOOK = new RegExp(`^\\s*${DOTTED_BOOK}(?=\\s|$)|(?:^|\\s)${BOOK}\\s*$`, "u");

/**
 * Reviewed references inside a sentence, removed by exact text. bible.com placed these at a
 * line break in the middle of the verse; nothing else in the verse is touched.
 */
export const INLINE_REFERENCES: Readonly<Record<string, string>> = {
  // "… ከጢሞቴዎስ፥ ሐ.ሥ. 18፥1 በቆሮንቶስ …": Acts 18:1 linked at the line break of the greeting.
  "2CO 1:1": "ሐ.ሥ. 18፥1",
  // "… ሰው ድምፅ” ኢሳ. 40፥3 ብሎ …": the link to Isaiah 40:3 placed after the quotation it cites.
  "MAT 3:3": "ኢሳ. 40፥3",
  "MRK 1:3": "ኢሳ. 40፥3",
};

/**
 * Reviewed references that belong to the translation itself and stay in the text.
 */
export const KEPT_REFERENCES: Readonly<Record<string, string>> = {
  // The translators' own note "(see Judges 1:14)", printed in parentheses inside the verse.
  "JOS 15:18": "(መሳ 1፥14 ተመልከት)",
};

export interface StripResult {
  text: string;
  /** What was removed, in the order found. */
  removed: string[];
  /** The part of `removed` that stood between two sentences rather than at an edge. */
  betweenSentences: string[];
}

const covers = (match: RegExpExecArray, verse: number) => {
  const from = Number(match[1]);
  const to = match[2] === undefined ? from : Number(match[2]);
  return from <= verse && verse <= to;
};

/**
 * Removes cross-references and echoed verse-number labels from the start and end of one
 * verse, and reference chains standing between two sentences. Returns empty text when the
 * verse was nothing but references. `verse` is the entry's own number: a bare number at an
 * edge is removed as a label only when it is that number (or a range holding it), or, at
 * the end, the next verse's number.
 */
export function stripCrossReferences(text: string, verse: number): StripResult {
  if (ONLY_REFERENCES.test(text)) return { text: "", removed: [text.trim()], betweenSentences: [] };
  const removed: string[] = [];
  let rest = text.trim();
  const take = (match: RegExpExecArray | null, fromStart: boolean): boolean => {
    if (!match?.[0]) return false;
    removed.push(match[0].trim());
    rest = fromStart ? rest.slice(match[0].length).trimStart() : rest.slice(0, match.index).trimEnd();
    return true;
  };
  for (;;) {
    if (take(LEADING_REF.exec(rest), true) || take(LEADING_NUMBERS.exec(rest), true)) continue;
    const lead = LEADING_LABEL.exec(rest);
    if (lead && covers(lead, verse) && take(lead, true)) continue;
    if (take(TRAILING_REF.exec(rest), false) || take(TRAILING_NUMBERS.exec(rest), false)) continue;
    const tail = TRAILING_LABEL.exec(rest);
    if (tail && (covers(tail, verse) || Number(tail[1]) === verse + 1) && take(tail, false)) continue;
    break;
  }
  const betweenSentences: string[] = [];
  rest = rest.replace(BETWEEN_SENTENCES, (_match, chain: string) => {
    removed.push(chain);
    betweenSentences.push(chain);
    return " ";
  });
  return { text: rest.trim(), removed, betweenSentences };
}

export interface CleanedVerse {
  code: string;
  chapter: number;
  verse: number;
  before: string;
  after: string;
  removed: string[];
  betweenSentences: string[];
}

export interface MergedSpan {
  code: string;
  chapter: number;
  verse: number;
  verseEnd: number;
}

export interface CleanReport {
  /** Entries dropped because nothing but references was left. */
  fakeVerses: CleanedVerse[];
  /** Real verses that lost references or labels at their edges (or between sentences). */
  strippedVerses: CleanedVerse[];
  /** Later copies of a verse number already seen; each one must have been a fake. */
  duplicateNumbers: CleanedVerse[];
  /** Verses the translation merges, which the export repeats under every number. */
  mergedSpans: MergedSpan[];
}

export const emptyCleanReport = (): CleanReport => ({
  fakeVerses: [],
  strippedVerses: [],
  duplicateNumbers: [],
  mergedSpans: [],
});

export interface JsonChaptersResult {
  books: UsfmBook[];
  /** Book name from the export, by USFM code. */
  bookNames: Map<string, string>;
  report: CleanReport;
}

function removeInline(where: string, text: string): string {
  const reference = INLINE_REFERENCES[where];
  if (reference === undefined) return text;
  if (!text.includes(` ${reference} `)) throw new Error(`${where}: reviewed inline reference "${reference}" not found`);
  return text.replace(` ${reference} `, " ");
}

/**
 * Cleans one chapter: drops reference-only entries, strips edge references, joins verses the
 * export repeats under several numbers into one merged verse, and checks the verses run 1..N
 * with no gaps.
 */
export function cleanChapter(chapter: JsonChapter, report: CleanReport): UsfmVerse[] {
  const where = `${chapter.bookCode} ${chapter.chapter}`;
  const kept = new Map<number, string>();
  const seen = new Set<number>();
  for (const { verse, text } of chapter.verses) {
    const stripped = stripCrossReferences(text, verse);
    const after = removeInline(`${where}:${verse}`, stripped.text);
    const removed =
      after === stripped.text ? stripped.removed : [...stripped.removed, INLINE_REFERENCES[`${where}:${verse}`] ?? ""];
    const { betweenSentences } = stripped;
    const entry = {
      code: chapter.bookCode,
      chapter: chapter.chapter,
      verse,
      before: text,
      after,
      removed,
      betweenSentences,
    };
    if (seen.has(verse)) {
      report.duplicateNumbers.push(entry);
      if (after) throw new Error(`${where}:${verse} appears twice and the later copy is not only references: ${text}`);
    }
    seen.add(verse);
    if (!after) {
      report.fakeVerses.push(entry);
      continue;
    }
    if (after !== text) report.strippedVerses.push(entry);
    kept.set(verse, after);
  }
  const numbers = [...kept.keys()].toSorted((a, b) => a - b);
  const last = numbers.at(-1) ?? 0;
  if (last === 0) throw new Error(`${where}: no verses left after cleaning`);
  const gaps = Array.from({ length: last }, (_, i) => i + 1).filter((n) => !kept.has(n));
  if (gaps.length) throw new Error(`${where}: verses ${gaps.join(", ")} are missing after cleaning`);

  const verses: UsfmVerse[] = [];
  for (const n of numbers) {
    const text = kept.get(n) ?? "";
    const previous = verses.at(-1);
    if (previous && previous.text === text) {
      previous.verseEnd = n;
      continue;
    }
    // The export has no paragraph marks, so each verse starts its own line.
    verses.push({ chapter: chapter.chapter, verse: n, verseEnd: n, style: "p", text });
  }
  for (const v of verses) {
    if (v.verseEnd !== v.verse) {
      report.mergedSpans.push({ code: chapter.bookCode, chapter: v.chapter, verse: v.verse, verseEnd: v.verseEnd });
    }
  }
  return verses;
}

/**
 * Reads every `<CODE>/<chapter>.json` file of an unzipped export (paths may sit under one
 * top-level folder) into books. Headings are empty: the export has none.
 */
export function readJsonChapters(files: Readonly<Record<string, Uint8Array>>): JsonChaptersResult {
  const decoder = new TextDecoder("utf-8");
  const report = emptyCleanReport();
  const chaptersByBook = new Map<string, JsonChapter[]>();
  const bookNames = new Map<string, string>();
  for (const [name, data] of Object.entries(files)) {
    const match = /(?:^|\/)([0-9A-Z]{3})\/(\d+)\.json$/.exec(name);
    if (!match?.[1]) continue;
    const chapter = parseJsonChapter(JSON.parse(decoder.decode(data)), name);
    if (chapter.bookCode !== match[1] || String(chapter.chapter) !== match[2]) {
      throw new Error(`${name}: file name does not match ${chapter.bookCode} ${chapter.chapter}`);
    }
    if (!bookByCode(chapter.bookCode)) throw new Error(`${name}: book ${chapter.bookCode} is not in the catalogue`);
    chaptersByBook.set(chapter.bookCode, [...(chaptersByBook.get(chapter.bookCode) ?? []), chapter]);
    bookNames.set(chapter.bookCode, chapter.bookName);
  }

  const books: UsfmBook[] = [];
  for (const [code, chapters] of chaptersByBook) {
    const info = bookByCode(code);
    const sorted = chapters.toSorted((a, b) => a.chapter - b.chapter);
    const numbers = sorted.map((c) => c.chapter);
    const expected = Array.from({ length: info?.chapters ?? 0 }, (_, i) => i + 1);
    if (numbers.join(",") !== expected.join(",")) {
      throw new Error(`${code}: chapters ${numbers.join(",")} do not match the catalogue's ${expected.length}`);
    }
    const name = bookNames.get(code);
    books.push({
      code,
      title: name ? { h: name, toc1: name, toc2: name } : {},
      verses: sorted.flatMap((chapter) => cleanChapter(chapter, report)),
      headings: [],
    });
  }
  return { books, bookNames, report };
}

/**
 * Reviewed places where a translation's last verse differs from the KJV grid, by translation
 * id and "CODE chapter". The value is the translation's own last verse. Anything not listed
 * here fails the build, so a cleaning mistake (a fake verse kept, a real one dropped) cannot
 * slip through as "versification".
 */
export const VERSE_GRID_EXCEPTIONS: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  "am-2005": {
    // KJV 14 ends "… face to face. Peace be to thee. …"; the 2005 (like the BSB, NIV and ESV)
    // numbers the greeting "ሰላም ለአንተ ይሁን። …" as its own verse 15.
    "3JN 1": 15,
    // The 2005 ends chapter 12 with "ዘንዶውም በባሕሩ ዳር አሸዋ ላይ ቆመ።" ("the dragon stood on
    // the sand of the sea"), which the KJV prints as the start of 13:1. The BSB numbers it 12:18 too.
    "REV 12": 18,
  },
};

/**
 * Compares each chapter's last verse with the reference grid (KJV last verse by "CODE chapter").
 * Returns one line per difference not covered by `exceptions`, plus any exception that no
 * longer applies, so the list stays honest.
 */
export function checkVerseGrid(
  books: readonly UsfmBook[],
  grid: ReadonlyMap<string, number>,
  exceptions: Readonly<Record<string, number>>,
): string[] {
  const problems: string[] = [];
  const used = new Set<string>();
  const lastVerse = new Map<string, number>();
  for (const book of books) {
    for (const v of book.verses) {
      const key = `${book.code} ${v.chapter}`;
      lastVerse.set(key, Math.max(lastVerse.get(key) ?? 0, v.verseEnd));
    }
  }
  for (const key of grid.keys()) {
    if (!lastVerse.has(key) && books.some((b) => key.startsWith(`${b.code} `))) {
      problems.push(`${key}: chapter missing`);
    }
  }
  for (const [key, actual] of lastVerse) {
    const expected = grid.get(key);
    if (actual === expected) continue;
    if (exceptions[key] === actual) {
      used.add(key);
      continue;
    }
    problems.push(`${key}: ends at verse ${actual}, the KJV at ${expected ?? "none"}`);
  }
  for (const key of Object.keys(exceptions)) {
    if (!used.has(key)) problems.push(`${key}: listed as an exception but matches no difference`);
  }
  return problems;
}

/**
 * Post-clean checks: no chapter:verse shape anywhere (apart from the reviewed KEPT_REFERENCES)
 * and no book abbreviation at either edge of a verse.
 */
export function findLeftoverReferences(books: readonly UsfmBook[]): string[] {
  const problems: string[] = [];
  const keptSeen = new Set<string>();
  for (const book of books) {
    for (const v of book.verses) {
      const key = `${book.code} ${v.chapter}:${v.verse}`;
      const kept = KEPT_REFERENCES[key];
      let text = v.text;
      if (kept !== undefined && text.includes(kept)) {
        keptSeen.add(key);
        text = text.replace(kept, "");
      }
      if (REFERENCE_SHAPE.test(text) || EDGE_BOOK.test(text)) problems.push(`${key}: ${v.text}`);
    }
  }
  for (const key of Object.keys(KEPT_REFERENCES)) {
    if (!keptSeen.has(key) && books.some((b) => key.startsWith(`${b.code} `))) {
      problems.push(`${key}: reviewed kept reference not found`);
    }
  }
  return problems;
}
