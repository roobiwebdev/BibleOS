import { bookByCode, bookByOrd } from "./books";

/**
 * SOURCE OF TRUTH KEYWORDS: VerseId, vid, makeVerseId, splitVerseId, canonical verse key, versification
 * WHAT:  A single integer naming a verse in the canonical (KJV-order) scheme:
 *        book ord × 1,000,000 + chapter × 1,000 + verse. Chapter-level ids use verse 0.
 * WHY:   Highlights, notes, collections, reading progress and parallel view all key on the
 *        same verse no matter which translation is open. Integers sort in reading order and
 *        index cheaply in SQLite. Translations whose numbering differs map onto this scheme
 *        at build time (verse_map), so study data never depends on a translation.
 * WHERE: bible-data build, translation stores, study database, reader, search results.
 */
export type VerseId = number;

export interface VerseParts {
  ord: number;
  chapter: number;
  verse: number;
}

const BOOK_FACTOR = 1_000_000;
const CHAPTER_FACTOR = 1_000;

export function makeVerseId(ord: number, chapter: number, verse = 0): VerseId {
  if (chapter < 0 || chapter >= BOOK_FACTOR / CHAPTER_FACTOR || verse < 0 || verse >= CHAPTER_FACTOR) {
    throw new RangeError(`Verse out of range: ${ord} ${chapter}:${verse}`);
  }
  return ord * BOOK_FACTOR + chapter * CHAPTER_FACTOR + verse;
}

export function splitVerseId(vid: VerseId): VerseParts {
  return {
    ord: Math.floor(vid / BOOK_FACTOR),
    chapter: Math.floor((vid % BOOK_FACTOR) / CHAPTER_FACTOR),
    verse: vid % CHAPTER_FACTOR,
  };
}

/** Chapter id (verse 0) for any verse in that chapter. */
export function chapterOf(vid: VerseId): VerseId {
  return vid - (vid % CHAPTER_FACTOR);
}

export function verseIdFromCode(code: string, chapter: number, verse = 0): VerseId | undefined {
  const book = bookByCode(code);
  return book ? makeVerseId(book.ord, chapter, verse) : undefined;
}

export function bookCodeOf(vid: VerseId): string | undefined {
  return bookByOrd(splitVerseId(vid).ord)?.code;
}
