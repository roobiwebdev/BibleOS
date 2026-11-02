import { chapterOf, type VerseId } from "@starter/bible-core/verse-id";
import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";

import type { BibleSource, ChapterData, ChapterVerse } from "./source";

/**
 * SOURCE OF TRUTH KEYWORDS: translationStore, getChapter, verseContaining, bundled translation, bible_all
 * WHAT:  Read access to the bundled translation databases (one read-only SQLite file each under
 *        the app's resources/bibles), through the app's Rust bridge by translation id.
 * WHY:   The bridge opens only known translation files, read-only, so the web layer can never
 *        reach another path. Rows are checked here before any screen sees them. Merged verses:
 *        a verse id inside a span ("14-16") resolves to the span's row.
 * WHERE: BibleSource in the desktop app (reader, parallel view, Today).
 */
const verseRow = z.object({
  vid: z.number(),
  span_end: z.number(),
  label: z.string(),
  style: z.enum(["p", "c", "q1", "q2"]),
  text: z.string(),
});
const headingRow = z.object({ vid: z.number(), level: z.enum(["s", "ms", "d", "r"]), text: z.string() });

const query = async <T extends z.ZodTypeAny>(schema: T, translation: string, sql: string, params: number[]) =>
  z.array(schema).parse(await invoke("bible_all", { translation, sql, params }));

const toVerse = (row: z.infer<typeof verseRow>): ChapterVerse => ({
  vid: row.vid,
  spanEnd: row.span_end,
  label: row.label,
  style: row.style,
  text: row.text,
});

export async function getChapter(id: string, chapterId: VerseId): Promise<ChapterData> {
  const start = chapterOf(chapterId);
  const end = start + 999;
  // A translation without this book (the 1962 text is NT only) simply has no rows.
  const [rows, headings] = await Promise.all([
    query(verseRow, id, "SELECT vid, span_end, label, style, text FROM verses WHERE vid BETWEEN ? AND ? ORDER BY vid", [
      start,
      end,
    ]),
    query(headingRow, id, "SELECT vid, level, text FROM headings WHERE vid BETWEEN ? AND ? ORDER BY vid, seq", [
      start,
      end,
    ]),
  ]);
  return { verses: rows.map(toVerse), headings };
}

/** The verse row covering a verse id, including merged spans (John 3:16 inside "14-16"). */
export async function verseContaining(id: string, vid: VerseId): Promise<ChapterVerse | undefined> {
  const rows = await query(
    verseRow,
    id,
    "SELECT vid, span_end, label, style, text FROM verses WHERE vid <= ? AND span_end >= ? ORDER BY vid DESC LIMIT 1",
    [vid, vid],
  );
  const row = rows[0];
  return row ? toVerse(row) : undefined;
}

export const translationStore: BibleSource = {
  getChapter,
  // Every chapter is bundled in the app.
  availableChapters: async () => undefined,
};
