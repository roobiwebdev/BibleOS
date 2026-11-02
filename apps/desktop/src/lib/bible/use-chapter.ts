import type { VerseId } from "@starter/bible-core/verse-id";
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
