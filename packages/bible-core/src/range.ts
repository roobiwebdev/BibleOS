import { bookByOrd, type Locale } from "./books";
import { formatReference } from "./reference";
import { splitVerseId, type VerseId } from "./verse-id";

/**
 * SOURCE OF TRUTH KEYWORDS: VerseRange, overlaps, subtractRange, formatRange, chapterRange, isWholeChapter, passage range
 * WHAT:  A passage as an inclusive pair of canonical verse ids, and the operations every
 *        feature needs on it: overlap, cutting one range out of another, and a label.
 * WHY:   Highlights, notes, collections, selection and search results all work on ranges.
 *        One implementation keeps "does this verse belong to that highlight" consistent, and
 *        lets recolouring one verse split a longer highlight instead of deleting it.
 * WHERE: desktop study store, reader, notes rail, Study, Today; later the study database.
 */
export interface VerseRange {
  start: VerseId;
  end: VerseId;
}

export function overlaps(a: VerseRange, b: VerseRange): boolean {
  return a.start <= b.end && b.start <= a.end;
}

/** What remains of `from` after removing `cut`: zero, one or two ranges. */
export function subtractRange(from: VerseRange, cut: VerseRange): VerseRange[] {
  if (!overlaps(from, cut)) return [from];
  const pieces: VerseRange[] = [];
  if (from.start < cut.start) pieces.push({ start: from.start, end: cut.start - 1 });
  if (cut.end < from.end) pieces.push({ start: cut.end + 1, end: from.end });
  return pieces;
}

/** The range covering a whole chapter (verse 0 through the last possible verse). */
export function chapterRange(chapterId: VerseId): VerseRange {
  return { start: chapterId, end: chapterId + 999 };
}

export function isWholeChapter(range: VerseRange): boolean {
  return range.start % 1000 === 0 && range.end % 1000 === 999 && range.end - range.start === 999;
}

/** "John 3:16–18", "John 3" for a whole chapter, "ዮሐንስ 3፥16" in Amharic. */
export function formatRange(range: VerseRange, locale: Locale): string {
  const a = splitVerseId(range.start);
  const b = splitVerseId(range.end);
  const book = bookByOrd(a.ord);
  if (!book) return "";
  if (isWholeChapter(range)) return formatReference({ book, chapter: a.chapter }, locale);
  const sameChapter = a.chapter === b.chapter;
  return formatReference(
    {
      book,
      chapter: a.chapter,
      verse: a.verse || undefined,
      endChapter: sameChapter ? undefined : b.chapter,
      endVerse: b.verse === a.verse && sameChapter ? undefined : b.verse || undefined,
    },
    locale,
  );
}
