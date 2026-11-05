import {
  addToVocabulary,
  createTally,
  finishSearch,
  likePatterns,
  parseSearchQuery,
  scopeRange,
  tallyVerse,
} from "@starter/bible-core/search";
import { chapterOf, type VerseId } from "@starter/bible-core/verse-id";
import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";

import {
  passageFromChapter,
  type BibleSource,
  type ChapterData,
  type ChapterVerse,
  type SearchOptions,
  type SearchResponse,
  type SearchVerse,
} from "./source";

/**
 * SOURCE OF TRUTH KEYWORDS: translationStore, getChapter, verseContaining, searchTranslation, bundled translation, bible_all
 * WHAT:  Read access to the bundled translation databases (one read-only SQLite file each under
 *        the app's resources/bibles), through the app's Rust bridge by translation id.
 * WHY:   The bridge opens only known translation files, read-only, so the web layer can never
 *        reach another path. Rows are checked here before any screen sees them. Merged verses:
 *        a verse id inside a span ("14-16") resolves to the span's row.
 * WHERE: BibleSource in the desktop app (reader, parallel view, Today, search).
 */
const verseRow = z.object({
  vid: z.number(),
  span_end: z.number(),
  label: z.string(),
  style: z.enum(["p", "c", "q1", "q2"]),
  text: z.string(),
});
const headingRow = z.object({ vid: z.number(), level: z.enum(["s", "ms", "d", "r"]), text: z.string() });

const query = async <T extends z.ZodTypeAny>(
  schema: T,
  translation: string,
  sql: string,
  params: readonly (number | string)[],
) => z.array(schema).parse(await invoke("bible_all", { translation, sql, params }));

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

const candidateRow = z.object({ vid: z.number(), text_norm: z.string() });
const normRow = z.object({ text_norm: z.string() });
const resultRow = z.object({ vid: z.number(), span_end: z.number(), label: z.string(), text: z.string() });

/**
 * SQLite narrows candidates with one LIKE per term on text_norm (bound parameters, read-only
 * connection); the shared matcher then applies word boundaries and exclusions exactly as the
 * preview does. Exclusions are not pushed into SQL because NOT LIKE '%lov%' would also drop
 * verses that only say "beloved", which partial mode does not count as a match. Only ids and
 * search copies cross the bridge for every candidate; display text is fetched for the shown
 * results alone, so a common word like "the" stays fast.
 */
export async function searchTranslation(id: string, input: string, options: SearchOptions): Promise<SearchResponse> {
  const parsed = parseSearchQuery(input);
  const tally = createTally<{ vid: VerseId }>(options.limit);
  const { start, end } = scopeRange(options.scope);
  if (parsed.include.length > 0) {
    const patterns = likePatterns(parsed);
    const filters = patterns.map(() => " AND text_norm LIKE ? ESCAPE '\\'").join("");
    const candidates = await query(
      candidateRow,
      id,
      `SELECT vid, text_norm FROM verses WHERE vid BETWEEN ? AND ?${filters} ORDER BY vid`,
      [start, end, ...patterns],
    );
    options.signal?.throwIfAborted();
    for (const row of candidates) tallyVerse(tally, { vid: row.vid }, row.text_norm, parsed, options.mode);
  }
  const ids = tally.hits.map((hit) => hit.vid);
  const rows =
    ids.length === 0
      ? []
      : await query(
          resultRow,
          id,
          `SELECT vid, span_end, label, text FROM verses WHERE vid IN (${ids.map(() => "?").join(",")}) ORDER BY vid`,
          ids,
        );
  const shown = {
    ...tally,
    hits: rows.map((r): SearchVerse => ({ vid: r.vid, spanEnd: r.span_end, label: r.label, text: r.text })),
  };
  let vocabulary: Map<string, number> | undefined;
  if (parsed.include.length > 0 && tally.total === 0) {
    vocabulary = new Map();
    const norms = await query(normRow, id, "SELECT text_norm FROM verses WHERE vid BETWEEN ? AND ?", [start, end]);
    for (const row of norms) addToVocabulary(vocabulary, row.text_norm);
  }
  return finishSearch(shown, parsed, options.mode, vocabulary);
}

export const translationStore: BibleSource = {
  getChapter,
  getPassage: (id, range) => passageFromChapter(getChapter, id, range),
  // Every chapter is bundled in the app.
  availableChapters: async () => undefined,
  search: searchTranslation,
};
