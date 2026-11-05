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
import type { VerseRange } from "@starter/bible-core/range";
import { chapterOf, type VerseId } from "@starter/bible-core/verse-id";
import { isOnlineTranslationId } from "@starter/bible-data/online";
import type { HeadingLevel, VerseStyle } from "@starter/bible-data/schema";
import { isTauri } from "@tauri-apps/api/core";
import { z } from "zod";

import type { OnlineSource } from "./online-source";

/**
 * SOURCE OF TRUTH KEYWORDS: BibleSource, bibleSource, ChapterData, ChapterVerse, ChapterHeading, preview data
 * WHAT:  The one interface screens use to read scripture, and the choice of implementation:
 *        bundled SQLite files inside the desktop app, or per-book JSON files in the browser
 *        preview; online translations (ESV, NLT) go to the online source in both.
 * WHY:   The UI is designed and reviewed in a browser before the native app exists. Screens
 *        depend on this interface only, so switching to the real store changes no screen code.
 *        Online calls can fail (no internet): they reject with OnlineTextError, never hang.
 * WHERE: reader, parallel view, Today page, study, search page.
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

export type SearchResponse = SearchOutcome<SearchVerse> & {
  /** Set for online translations: the publisher's own count, and how many results it sent. */
  online?: { total: number; received: number };
};

export interface BibleSource {
  /** Empty verses when the translation has no text for this chapter. */
  getChapter(translationId: string, chapterId: VerseId): Promise<ChapterData>;
  /** The verses of a range that fall in the range's first chapter (study lists, verse of the day). */
  getPassage(translationId: string, range: VerseRange): Promise<ChapterVerse[]>;
  /** Chapters that can be opened; undefined means every chapter. */
  availableChapters(): Promise<readonly VerseId[] | undefined>;
  /**
   * Whole-Bible search with no index: words, "phrases" and -exclusions matched on the
   * normalized text (see bible-core search.ts), results in Bible order.
   */
  search(translationId: string, query: string, options: SearchOptions): Promise<SearchResponse>;
}

const EMPTY: ChapterData = { verses: [], headings: [] };

/**
 * SOURCE OF TRUTH KEYWORDS: passageFromChapter, getPassage, verse range in chapter, passage cut
 * WHAT:  The verses of a range that fall in its first chapter, cut from the whole chapter.
 * WHY:   Bundled and preview sources read whole chapters anyway, so they share this one cut;
 *        only the online source asks for just the verses.
 * WHERE: preview source, bundled translation store.
 */
export async function passageFromChapter(
  getChapter: BibleSource["getChapter"],
  translationId: string,
  range: VerseRange,
): Promise<ChapterVerse[]> {
  const { verses } = await getChapter(translationId, chapterOf(range.start));
  return verses.filter((v) => v.spanEnd >= range.start && v.vid <= range.end);
}

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

async function previewChapter(translationId: string, chapterId: VerseId): Promise<ChapterData> {
  const book = await loadBook(translationId, Math.floor(chapterId / 1_000_000));
  return book[String(chapterId)] ?? EMPTY;
}

const previewSource: BibleSource = {
  getChapter: previewChapter,
  getPassage: (translationId, range) => passageFromChapter(previewChapter, translationId, range),
  // Every chapter is available in the preview too.
  availableChapters: async () => undefined,
  search: previewSearch,
};

/**
 * Online translation ids go to the online source (loaded on first use); everything else to the
 * bundled store or the preview files.
 */
function withOnline(bundled: BibleSource): BibleSource {
  let online: Promise<OnlineSource> | undefined;
  const onlineSource = () => {
    online ??= import("./online-source").then((m) =>
      m.createOnlineSource({ fetch: (input, init) => fetch(input, init), isOffline: () => navigator.onLine === false }),
    );
    return online;
  };
  return {
    getChapter: async (id, chapterId) =>
      isOnlineTranslationId(id) ? (await onlineSource()).getChapter(id, chapterId) : bundled.getChapter(id, chapterId),
    getPassage: async (id, range) =>
      isOnlineTranslationId(id) ? (await onlineSource()).getPassage(id, range) : bundled.getPassage(id, range),
    availableChapters: () => bundled.availableChapters(),
    search: async (id, query, options) =>
      isOnlineTranslationId(id)
        ? (await onlineSource()).search(id, query, options)
        : bundled.search(id, query, options),
  };
}

let chosen: Promise<BibleSource> | undefined;

export function bibleSource(): Promise<BibleSource> {
  chosen ??= (
    isTauri() ? import("./translation-store").then((m) => m.translationStore) : Promise.resolve(previewSource)
  ).then(withOnline);
  return chosen;
}
