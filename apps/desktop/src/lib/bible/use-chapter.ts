import type { VerseRange } from "@starter/bible-core/range";
import type { VerseId } from "@starter/bible-core/verse-id";
import { TRANSLATIONS, type TranslationSource } from "@starter/bible-data/manifest";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { onlineErrorReason, type OnlineErrorReason } from "./online-source";
import { bibleSource, type BibleSource, type ChapterData, type ChapterVerse } from "./source";

/**
 * SOURCE OF TRUTH KEYWORDS: TextLoad, useTextLoad, load state, retry, needs internet
 * WHAT:  Loads something from BibleSource for a screen: the data, or why it failed (online
 *        translations need the internet), and a retry. Stale responses are ignored.
 * WHY:   Every screen that shows text handles "no internet" the same way, and bundled text
 *        (which never fails) pays nothing for it.
 * WHERE: useChapterLoad, usePassage.
 */
export interface TextLoad<T> {
  data?: T;
  error?: OnlineErrorReason;
  retry: () => void;
}

function useTextLoad<T>(key: string, load: (source: BibleSource) => Promise<T>): TextLoad<T> {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ key: string; data?: T; error?: OnlineErrorReason } | undefined>();
  const fullKey = `${key}#${attempt}`;
  // `load` is rebuilt every render; the key names everything it reads.
  const loadRef = useRef(load);
  useLayoutEffect(() => {
    loadRef.current = load;
  });
  useEffect(() => {
    let live = true;
    void bibleSource()
      .then((source) => loadRef.current(source))
      .then(
        (data) => {
          if (live) setState({ key: fullKey, data });
        },
        (error: unknown) => {
          if (live) setState({ key: fullKey, error: onlineErrorReason(error) });
        },
      );
    return () => {
      live = false;
    };
  }, [fullKey]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return state?.key === fullKey ? { data: state.data, error: state.error, retry } : { retry };
}

/**
 * SOURCE OF TRUTH KEYWORDS: useChapter, useChapterLoad, useAvailableChapters, load chapter, chapter data hook
 * WHAT:  Loads one chapter of one translation (and the list of openable chapters) for a screen.
 *        useChapterLoad also reports an online failure with a retry; useChapter only the data.
 * WHY:   Screens share one loading path over BibleSource, with stale responses ignored.
 * WHERE: reader, Today (verse of the day, continue reading).
 */
export function useChapterLoad(translationId: string, chapterId: VerseId): TextLoad<ChapterData> {
  return useTextLoad(`${translationId}:${chapterId}`, (source) => source.getChapter(translationId, chapterId));
}

export function useChapter(translationId: string, chapterId: VerseId): ChapterData | undefined {
  return useChapterLoad(translationId, chapterId).data;
}

/**
 * SOURCE OF TRUTH KEYWORDS: usePassage, passage load, verse range text, study passage
 * WHAT:  Loads the verses of a range (within its first chapter) with the online error and retry.
 * WHY:   Study lists and the verse of the day show a few verses; for online translations that
 *        asks the publisher for just those verses, not whole chapters.
 * WHERE: Study (PassageText), Today (verse of the day).
 */
export function usePassage(translationId: string, range: VerseRange): TextLoad<ChapterVerse[]> {
  return useTextLoad(`${translationId}:${range.start}-${range.end}`, (source) =>
    source.getPassage(translationId, range),
  );
}

export function useAvailableChapters(): readonly VerseId[] | undefined {
  const [chapters, setChapters] = useState<readonly VerseId[] | undefined>();
  useEffect(() => {
    void bibleSource()
      .then((source) => source.availableChapters())
      .then(setChapters);
  }, []);
  return chapters;
}

/**
 * SOURCE OF TRUTH KEYWORDS: loadChapterWithFallback, ShownChapter, NT-only fallback, translation fallback, missing book
 * WHAT:  Loads one chapter of a translation; when that translation lacks the book (the 1962
 *        Amharic text is New Testament only), loads a whole-Bible translation in the same
 *        language instead and says which one was replaced.
 * WHY:   The reader keeps flowing through the Old Testament in the reader's language instead of
 *        showing an empty page, and each chapter carries its own notice.
 * WHERE: reader chapter window (continuous scrolling).
 */
export interface ShownChapter {
  data: ChapterData;
  /** The translation actually shown. */
  id: string;
  replaced?: { missing: TranslationSource | undefined; shown: TranslationSource | undefined };
  /** Set when an online translation could not be loaded; `data` is then empty. */
  error?: OnlineErrorReason;
}

export async function loadChapterWithFallback(translationId: string, chapterId: VerseId): Promise<ShownChapter> {
  const source = await bibleSource();
  let own: ChapterData;
  try {
    own = await source.getChapter(translationId, chapterId);
  } catch (error) {
    // Online text without a connection: an empty chapter that says why, never a crash.
    return { data: { verses: [], headings: [] }, id: translationId, error: onlineErrorReason(error) };
  }
  const meta = TRANSLATIONS.find((x) => x.id === translationId);
  const fallback = TRANSLATIONS.find(
    (x) => x.language === meta?.language && x.scope === "bible" && x.id !== translationId,
  );
  if (own.verses.length > 0 || !fallback) return { data: own, id: translationId };
  return {
    data: await source.getChapter(fallback.id, chapterId),
    id: fallback.id,
    replaced: { missing: meta, shown: fallback },
  };
}
