import type { VerseId } from "@starter/bible-core/verse-id";
import type { HeadingLevel, VerseStyle } from "@starter/bible-data/schema";
import { isTauri } from "@tauri-apps/api/core";
import { z } from "zod";

/**
 * SOURCE OF TRUTH KEYWORDS: BibleSource, bibleSource, ChapterData, ChapterVerse, ChapterHeading, preview data
 * WHAT:  The one interface screens use to read scripture, and the choice of implementation:
 *        bundled SQLite files inside the desktop app, or per-book JSON files in the browser preview.
 * WHY:   The UI is designed and reviewed in a browser before the native app exists. Screens
 *        depend on this interface only, so switching to the real store changes no screen code.
 * WHERE: reader, parallel view, Today page, search (later).
 */
export interface ChapterVerse {
  vid: VerseId;
  spanEnd: VerseId;
  label: string;
  style: VerseStyle;
  text: string;
}

export interface ChapterHeading {
  vid: VerseId;
  level: HeadingLevel;
  text: string;
}

export interface ChapterData {
  verses: ChapterVerse[];
  headings: ChapterHeading[];
}

export interface BibleSource {
  /** Empty verses when the translation has no text for this chapter. */
  getChapter(translationId: string, chapterId: VerseId): Promise<ChapterData>;
  /** Chapters that can be opened; undefined means every chapter. */
  availableChapters(): Promise<readonly VerseId[] | undefined>;
}

const EMPTY: ChapterData = { verses: [], headings: [] };

// Each book file is checked once on load, so a stale export fails loudly instead of rendering wrong text.
const chapterSchema = z.object({
  verses: z.array(
    z.object({
      vid: z.number(),
      spanEnd: z.number(),
      label: z.string(),
      style: z.enum(["p", "c", "q1", "q2"]),
      text: z.string(),
    }),
  ),
  headings: z.array(z.object({ vid: z.number(), level: z.enum(["s", "ms", "d", "r"]), text: z.string() })),
});
const bookFileSchema = z.record(z.string(), chapterSchema);

const books = new Map<string, Promise<z.infer<typeof bookFileSchema>>>();

/**
 * The browser preview reads the whole Bible from per-book JSON files exported by
 * `pnpm --filter desktop bibles` into public/preview-bible. A missing file (the 1962 text has
 * no Old Testament) is an empty book, not an error.
 */
function loadBook(translationId: string, ord: number) {
  const key = `${translationId}/${ord}`;
  let book = books.get(key);
  if (!book) {
    book = fetch(`/preview-bible/${key}.json`).then(async (response) =>
      response.ok && response.headers.get("content-type")?.includes("json")
        ? bookFileSchema.parse(await response.json())
        : {},
    );
    books.set(key, book);
  }
  return book;
}

const previewSource: BibleSource = {
  async getChapter(translationId, chapterId) {
    const book = await loadBook(translationId, Math.floor(chapterId / 1_000_000));
    return book[String(chapterId)] ?? EMPTY;
  },
  // Every chapter is available in the preview too.
  availableChapters: async () => undefined,
};

let chosen: Promise<BibleSource> | undefined;

export function bibleSource(): Promise<BibleSource> {
  chosen ??= isTauri() ? import("./translation-store").then((m) => m.translationStore) : Promise.resolve(previewSource);
  return chosen;
}
