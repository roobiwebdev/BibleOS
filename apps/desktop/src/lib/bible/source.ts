import { normalizeForSearch } from "@starter/bible-core/normalize";
import {
  addToVocabulary,
  createTally,
  finishSearch,
  parseSearchQuery,
  scopeBooks,
  tallyVerse,
  type MatchMode,
  type SearchOutcome,
  type SearchScope,
} from "@starter/bible-core/search";
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
 * WHERE: reader, parallel view, Today page, search page.
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

/** A verse as search returns it; `matches` (in SearchResponse) are spans of `text` to highlight. */
export interface SearchVerse {
  vid: VerseId;
  spanEnd: VerseId;
  label: string;
  text: string;
}

export interface SearchOptions {
  scope: SearchScope;
  mode: MatchMode;
  /** How many results to return; `total` still counts every match. */
  limit: number;
  /** A newer search cancels this one. */
  signal?: AbortSignal;
}

export type SearchResponse = SearchOutcome<SearchVerse>;

export interface BibleSource {
  /** Empty verses when the translation has no text for this chapter. */
  getChapter(translationId: string, chapterId: VerseId): Promise<ChapterData>;
  /** Chapters that can be opened; undefined means every chapter. */
  availableChapters(): Promise<readonly VerseId[] | undefined>;
  /**
   * Whole-Bible search with no index: words, "phrases" and -exclusions matched on the
   * normalized text (see bible-core search.ts), results in Bible order.
   */
  search(translationId: string, query: string, options: SearchOptions): Promise<SearchResponse>;
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

interface SearchableVerse {
  verse: SearchVerse;
  norm: string;
}

const searchable = new Map<string, Promise<SearchableVerse[]>>();

/** A book's verses in order with their search copy, normalized once and cached. */
function loadSearchable(translationId: string, ord: number) {
  const key = `${translationId}/${ord}`;
  let verses = searchable.get(key);
  if (!verses) {
    verses = loadBook(translationId, ord).then((book) =>
      // Chapter ids are integer keys, so they come back in ascending (reading) order.
      Object.values(book).flatMap((chapter) =>
        chapter.verses.map(({ vid, spanEnd, label, text }) => ({
          verse: { vid, spanEnd, label, text },
          norm: normalizeForSearch(text),
        })),
      ),
    );
    searchable.set(key, verses);
  }
  return verses;
}

// Lets the page paint between books; a MessageChannel avoids setTimeout's 4 ms clamp.
const yieldToPage = () =>
  new Promise<void>((resolve) => {
    const channel = new MessageChannel();
    channel.port1.addEventListener("message", () => resolve(), { once: true });
    channel.port1.start();
    channel.port2.postMessage(null);
  });

/**
 * The preview scans the books in scope one at a time, giving the page a turn whenever a slice
 * of work has run for a frame, so typing stays smooth while the first search loads the files.
 */
async function previewSearch(translationId: string, input: string, options: SearchOptions): Promise<SearchResponse> {
  const query = parseSearchQuery(input);
  const tally = createTally<SearchVerse>(options.limit);
  if (query.include.length === 0) return finishSearch(tally, query, options.mode);
  // Start every book's download at once, then scan them in Bible order.
  const loads = scopeBooks(options.scope).map((book) => loadSearchable(translationId, book.ord));
  let sliceStart = performance.now();
  for (const pending of loads) {
    const verses = await pending;
    options.signal?.throwIfAborted();
    for (const { verse, norm } of verses) tallyVerse(tally, verse, norm, query, options.mode);
    if (performance.now() - sliceStart > 12) {
      await yieldToPage();
      options.signal?.throwIfAborted();
      sliceStart = performance.now();
    }
  }
  const vocabulary = tally.total === 0 ? await previewVocabulary(translationId, options.scope) : undefined;
  return finishSearch(tally, query, options.mode, vocabulary);
}

const vocabularies = new Map<string, Promise<Map<string, number>>>();

/** Words used in a scope, for spelling suggestions; built only after a search finds nothing. */
function previewVocabulary(translationId: string, scope: SearchScope) {
  const key = `${translationId}|${scope}`;
  let vocabulary = vocabularies.get(key);
  if (!vocabulary) {
    vocabulary = (async () => {
      const words = new Map<string, number>();
      for (const book of scopeBooks(scope)) {
        for (const { norm } of await loadSearchable(translationId, book.ord)) addToVocabulary(words, norm);
      }
      return words;
    })();
    vocabularies.set(key, vocabulary);
  }
  return vocabulary;
}

const previewSource: BibleSource = {
  async getChapter(translationId, chapterId) {
    const book = await loadBook(translationId, Math.floor(chapterId / 1_000_000));
    return book[String(chapterId)] ?? EMPTY;
  },
  // Every chapter is available in the preview too.
  availableChapters: async () => undefined,
  search: previewSearch,
};

let chosen: Promise<BibleSource> | undefined;

export function bibleSource(): Promise<BibleSource> {
  chosen ??= isTauri() ? import("./translation-store").then((m) => m.translationStore) : Promise.resolve(previewSource);
  return chosen;
}
