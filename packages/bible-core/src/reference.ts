import { BOOKS, type BookInfo, type Locale } from "./books";
import { normalizeForSearch } from "./normalize";
import { makeVerseId, type VerseId } from "./verse-id";

/**
 * SOURCE OF TRUTH KEYWORDS: ParsedReference, parseReference, matchBooks, formatReference, verse reference, ⌘K, [[links]]
 * WHAT:  Parses human Bible references in English or Amharic ("jn 3:16", "1 John 1:9-2:2",
 *        "ዮሐ 3፥16", "1ኛ ዮሐንስ 1፡9", "Gen 1-3") into a book + chapter/verse range, and formats
 *        them back per locale.
 * WHY:   The command palette, note links, search box and imports must all read references
 *        the same way. Matching order is exact name/alias, then prefix, then one or two typos,
 *        so short and misspelled input still lands on the intended book.
 * WHERE: desktop ⌘K palette, notes [[link]] parsing, search box, JSON import.
 */
export interface ParsedReference {
  book: BookInfo;
  chapter: number;
  verse?: number;
  endChapter?: number;
  endVerse?: number;
}

// Ordinal words count only when a space follows, so "isa" (Isaiah) never reads as "1 sa".
// Matched after search folding, so ሦስተኛ arrives as ሶስተኛ.
const ORDINAL_WORDS: ReadonlyArray<readonly [RegExp, string]> = [
  [/^(first|i|አንደኛ|አንድኛ) /u, "1"],
  [/^(second|ii|ሁለተኛ) /u, "2"],
  [/^(third|iii|ሶስተኛ) /u, "3"],
];

/** Normalized, space-free lookup key. "1ኛ ዮሐንስ" and "1 Jn" become "1ዮሀንስ" and "1jn". */
function keyOf(text: string): string {
  let key = normalizeForSearch(text);
  for (const [pattern, digit] of ORDINAL_WORDS) key = key.replace(pattern, digit);
  return key.replaceAll(" ", "").replace(/^(\d)(ኛ|ተኛ)/u, "$1");
}

interface IndexEntry {
  key: string;
  book: BookInfo;
}

const INDEX: readonly IndexEntry[] = BOOKS.flatMap((book) => {
  const names = [
    book.code,
    book.en.name,
    book.en.short,
    ...book.en.aliases,
    book.am.name,
    book.am.short,
    ...book.am.aliases,
  ];
  return [...new Set(names.map(keyOf))].filter((k) => k.length > 0).map((key) => ({ key, book }));
});

/** Damerau-Levenshtein (optimal string alignment) distance, by code point. */
function editDistance(a: string, b: string): number {
  const s = [...a];
  const t = [...b];
  const rows: number[][] = Array.from({ length: s.length + 1 }, (_row, i) =>
    Array.from({ length: t.length + 1 }, (_col, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  const at = (i: number, j: number): number => rows[i]?.[j] ?? Number.POSITIVE_INFINITY;
  for (let i = 1; i <= s.length; i++) {
    for (let j = 1; j <= t.length; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      let best = Math.min(at(i - 1, j) + 1, at(i, j - 1) + 1, at(i - 1, j - 1) + cost);
      if (i > 1 && j > 1 && s[i - 1] === t[j - 2] && s[i - 2] === t[j - 1]) {
        best = Math.min(best, at(i - 2, j - 2) + 1);
      }
      const row = rows[i];
      if (row) row[j] = best;
    }
  }
  return at(s.length, t.length);
}

/**
 * SOURCE OF TRUTH KEYWORDS: matchBooks, book search, book suggestions, fuzzy book name
 * WHAT:  Ranks books for a typed name: exact, then prefix, then near-miss spelling.
 * WHY:   Shared by the parser and the palette's live suggestions so both agree.
 * WHERE: parseReference, desktop ⌘K palette and book picker filter.
 */
const matchCache = new Map<string, BookInfo[]>();

export function matchBooks(input: string, limit = 5): BookInfo[] {
  const cacheKey = `${limit}|${input}`;
  const cached = matchCache.get(cacheKey);
  if (cached) return cached;
  const result = rankBooks(input, limit);
  if (matchCache.size > 500) matchCache.clear();
  matchCache.set(cacheKey, result);
  return result;
}

function rankBooks(input: string, limit: number): BookInfo[] {
  const key = keyOf(input);
  if (key.length === 0) return [];
  // Ties prefer names whose length matches the input: "jhon" is a swap of "john", not a cut of "jon".
  const scored = new Map<string, { book: BookInfo; score: number; lengthGap: number }>();
  const offer = (book: BookInfo, score: number, candidate: string) => {
    const lengthGap = Math.abs([...candidate].length - [...key].length);
    const prev = scored.get(book.code);
    if (!prev || score < prev.score || (score === prev.score && lengthGap < prev.lengthGap)) {
      scored.set(book.code, { book, score, lengthGap });
    }
  };
  for (const { key: candidate, book } of INDEX) {
    if (candidate === key) offer(book, 0, candidate);
    else if (key.length >= 2 && candidate.startsWith(key)) offer(book, 1, candidate);
    else if (key.length >= 4) {
      const allowed = key.length >= 7 ? 2 : 1;
      // Lengths further apart than the allowed edits can never match; skip the distance work.
      if (Math.abs([...candidate].length - [...key].length) > allowed) continue;
      const distance = editDistance(key, candidate);
      if (distance <= allowed) offer(book, 1 + distance, candidate);
    }
  }
  return [...scored.values()]
    .toSorted((x, y) => x.score - y.score || (x.score > 1 ? x.lengthGap - y.lengthGap : 0) || x.book.ord - y.book.ord)
    .slice(0, limit)
    .map((s) => s.book);
}

const SEP = "\\s*[:.፥፡]\\s*";
const DASH = "\\s*[-–—]\\s*";
const REFERENCE = new RegExp(`^(.*?)\\s*(\\d+)(?:${SEP}(\\d+))?(?:${DASH}(\\d+)(?:${SEP}(\\d+))?)?\\s*$`, "u");

/** No chapter in the Bible has more verses than Psalm 119 (176). */
export const MAX_VERSE = 176;

export function parseReference(input: string): ParsedReference | undefined {
  const text = input.trim();
  const match = REFERENCE.exec(text);
  const bookPart = match ? (match[1] ?? "") : text;
  const book = matchBooks(bookPart, 1)[0];
  if (!book) return undefined;
  if (!match) return { book, chapter: 1 };

  let chapter = Number(match[2]);
  let verse = match[3] === undefined ? undefined : Number(match[3]);
  const rangeA = match[4] === undefined ? undefined : Number(match[4]);
  const rangeB = match[5] === undefined ? undefined : Number(match[5]);
  // One-chapter books are cited by verse alone: "Jude 5" means Jude 1:5.
  if (book.chapters === 1 && verse === undefined && rangeB === undefined) {
    verse = chapter;
    chapter = 1;
  }
  if (chapter < 1 || chapter > book.chapters) return undefined;
  const verseOk = (v: number | undefined) => v === undefined || (v >= 1 && v <= MAX_VERSE);
  if (!verseOk(verse) || !verseOk(rangeB)) return undefined;

  const ref: ParsedReference = { book, chapter };
  if (verse !== undefined) ref.verse = verse;
  if (rangeA !== undefined) {
    if (rangeB !== undefined) {
      // "1:9-2:2": rangeA is a chapter, rangeB a verse.
      ref.endChapter = rangeA;
      ref.endVerse = rangeB;
    } else if (verse !== undefined) {
      ref.endVerse = rangeA; // "3:16-18"
    } else {
      ref.endChapter = rangeA; // "Gen 1-3"
    }
  }
  if (ref.endVerse !== undefined && ref.endVerse > MAX_VERSE) return undefined;
  if (ref.endChapter !== undefined && (ref.endChapter < chapter || ref.endChapter > book.chapters)) {
    return undefined;
  }
  if (ref.verse !== undefined && ref.endVerse !== undefined && (ref.endChapter ?? chapter) === chapter) {
    if (ref.endVerse < ref.verse) return undefined;
  }
  return ref;
}

/** First and last VerseId covered. Whole chapters use verse 0 … 999 as open bounds. */
export function referenceRange(ref: ParsedReference): { start: VerseId; end: VerseId } {
  const endChapter = ref.endChapter ?? ref.chapter;
  const start = makeVerseId(ref.book.ord, ref.chapter, ref.verse ?? 0);
  const endVerse = ref.endVerse ?? (ref.endChapter === undefined ? ref.verse : undefined) ?? 999;
  return { start, end: makeVerseId(ref.book.ord, endChapter, endVerse) };
}

/** "John 3:16-18" in English, "ዮሐንስ 3፥16-18" in Amharic (፥ is the customary separator). */
export function formatReference(ref: ParsedReference, locale: Locale): string {
  const sep = locale === "am" ? "፥" : ":";
  let out = `${ref.book[locale].short} ${ref.chapter}`;
  if (ref.verse !== undefined) out += `${sep}${ref.verse}`;
  if (ref.endChapter !== undefined && ref.endChapter !== ref.chapter) {
    out += `–${ref.endChapter}`;
    if (ref.endVerse !== undefined) out += `${sep}${ref.endVerse}`;
  } else if (ref.endVerse !== undefined) {
    out += `–${ref.endVerse}`;
  }
  return out;
}
