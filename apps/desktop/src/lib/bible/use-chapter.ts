import type { VerseId } from "@starter/bible-core/verse-id";
import { TRANSLATIONS, type TranslationSource } from "@starter/bible-data/manifest";
import { useEffect, useState } from "react";

import { bibleSource, type ChapterData } from "./source";

/**
 * SOURCE OF TRUTH KEYWORDS: useChapter, useAvailableChapters, load chapter, chapter data hook
 * WHAT:  Loads one chapter of one translation (and the list of openable chapters) for a screen.
 * WHY:   Screens share one loading path over BibleSource, with stale responses ignored.
 * WHERE: reader, Today (verse of the day).
 */
export function useChapter(translationId: string, chapterId: VerseId): ChapterData | undefined {
  const [state, setState] = useState<{ key: string; data: ChapterData } | undefined>();
  const key = `${translationId}:${chapterId}`;
  useEffect(() => {
    let live = true;
    void bibleSource()
      .then((source) => source.getChapter(translationId, chapterId))
      .then((data) => {
        if (live) setState({ key, data });
      });
    return () => {
      live = false;
    };
  }, [translationId, chapterId, key]);
  return state?.key === key ? state.data : undefined;
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
}

export async function loadChapterWithFallback(translationId: string, chapterId: VerseId): Promise<ShownChapter> {
  const source = await bibleSource();
  const own = await source.getChapter(translationId, chapterId);
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
