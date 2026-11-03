import { commands } from "@starter/local-api/api";
import type { HistoryDay, RecentChapter, ResumePoint } from "@starter/local-api/commands/reading";
import { useCallback, useEffect, useState } from "react";

import { callCommand } from "../../lib/data/local-api";

const DAYS_PER_PAGE = 14;
const CHAPTERS_PER_PAGE = 12;

interface HistoryState {
  status: "loading" | "ready" | "failed";
  days: HistoryDay[];
  nextBefore: string | null;
  resume: ResumePoint | null;
  recent: RecentChapter[];
  nextCursor: string | null;
  loadingMore: boolean;
}

const INITIAL: HistoryState = {
  status: "loading",
  days: [],
  nextBefore: null,
  resume: null,
  recent: [],
  nextCursor: null,
  loadingMore: false,
};

/**
 * SOURCE OF TRUTH KEYWORDS: useReadingHistory, history pages, load more days, recent chapters, resume point
 * WHAT:  Loads the History screen's data through reading.history and reading.recentChapters,
 *        and appends older pages on demand.
 * WHY:   History is paged and only needed on one screen, so it is not held in the global study
 *        store. Reading is recorded in the reader, never while History is open, so loading the
 *        first page each time the screen opens keeps it current.
 * WHERE: features/history/history-page.tsx.
 */
export function useReadingHistory() {
  const [state, setState] = useState<HistoryState>(INITIAL);

  useEffect(() => {
    let live = true;
    Promise.all([
      callCommand(commands.reading.history, { limit: DAYS_PER_PAGE }),
      callCommand(commands.reading.recentChapters, { limit: CHAPTERS_PER_PAGE }),
    ])
      .then(([history, recent]) => {
        if (!live) return;
        setState({
          status: "ready",
          days: history.days,
          nextBefore: history.nextBefore,
          resume: history.resume,
          recent: recent.items,
          nextCursor: recent.nextCursor,
          loadingMore: false,
        });
      })
      .catch((error: unknown) => {
        console.error("[history]", error);
        if (live) setState((s) => ({ ...s, status: "failed" }));
      });
    return () => {
      live = false;
    };
  }, []);

  const loadMoreDays = useCallback(() => {
    if (!state.nextBefore || state.loadingMore) return;
    setState((s) => ({ ...s, loadingMore: true }));
    callCommand(commands.reading.history, { limit: DAYS_PER_PAGE, before: state.nextBefore })
      .then((page) =>
        setState((s) => ({ ...s, days: [...s.days, ...page.days], nextBefore: page.nextBefore, loadingMore: false })),
      )
      .catch((error: unknown) => {
        console.error("[history]", error);
        setState((s) => ({ ...s, loadingMore: false }));
      });
  }, [state.nextBefore, state.loadingMore]);

  const loadMoreChapters = useCallback(() => {
    if (!state.nextCursor) return;
    callCommand(commands.reading.recentChapters, { limit: CHAPTERS_PER_PAGE, cursor: state.nextCursor })
      .then((page) => setState((s) => ({ ...s, recent: [...s.recent, ...page.items], nextCursor: page.nextCursor })))
      .catch((error: unknown) => console.error("[history]", error));
  }, [state.nextCursor]);

  return { ...state, loadMoreDays, loadMoreChapters };
}
