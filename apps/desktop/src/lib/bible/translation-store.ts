import { chapterOf, type VerseId } from "@starter/bible-core/verse-id";
import type { VerseStyle } from "@starter/bible-data/schema";
import { resolveResource } from "@tauri-apps/api/path";
import Database from "@tauri-apps/plugin-sql";

import type { BibleSource, ChapterData, ChapterHeading, ChapterVerse } from "./source";

/**
 * SOURCE OF TRUTH KEYWORDS: translationStore, getChapter, verseContaining, openTranslation, bundled translation, ChapterData
 * WHAT:  Read access to the bundled translation databases (one read-only SQLite file each,
 *        shipped under the app's resources/bibles folder).
 * WHY:   One place opens and caches the files and knows the schema, including merged verses:
 *        a verse id inside a span ("14-16") resolves to the span's row.
 * WHERE: reader, parallel view, search worker (later), Today page verse of the day.
 */
interface VerseRow {
  vid: number;
  span_end: number;
  label: string;
  style: VerseStyle;
  text: string;
}

const open = new Map<string, Promise<Database>>();

function openTranslation(id: string): Promise<Database> {
  let db = open.get(id);
  if (!db) {
    db = resolveResource(`bibles/${id}.sqlite`).then((path) => Database.load(`sqlite:${path}`));
    open.set(id, db);
  }
  return db;
}

const toVerse = (row: VerseRow): ChapterVerse => ({
  vid: row.vid,
  spanEnd: row.span_end,
  label: row.label,
  style: row.style,
  text: row.text,
});

export async function getChapter(id: string, chapterId: VerseId): Promise<ChapterData> {
  const db = await openTranslation(id);
  const start = chapterOf(chapterId);
  const end = start + 999;
  const [rows, headings] = await Promise.all([
    db.select<VerseRow[]>(
      "SELECT vid, span_end, label, style, text FROM verses WHERE vid BETWEEN $1 AND $2 ORDER BY vid",
      [start, end],
    ),
    db.select<ChapterHeading[]>("SELECT vid, level, text FROM headings WHERE vid BETWEEN $1 AND $2 ORDER BY vid, seq", [
      start,
      end,
    ]),
  ]);
  return { verses: rows.map(toVerse), headings };
}

/** The verse row covering a verse id, including merged spans (John 3:16 inside "14-16"). */
export async function verseContaining(id: string, vid: VerseId): Promise<ChapterVerse | undefined> {
  const db = await openTranslation(id);
  const rows = await db.select<VerseRow[]>(
    "SELECT vid, span_end, label, style, text FROM verses WHERE vid <= $1 AND span_end >= $1 ORDER BY vid DESC LIMIT 1",
    [vid],
  );
  const row = rows[0];
  return row ? toVerse(row) : undefined;
}

export const translationStore: BibleSource = {
  getChapter,
  // Every chapter is bundled in the app.
  availableChapters: async () => undefined,
};
