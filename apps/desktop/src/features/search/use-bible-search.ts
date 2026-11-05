import type { MatchMode, SearchScope } from "@starter/bible-core/search";
import { useCallback, useEffect, useState } from "react";

import { onlineErrorReason, type OnlineErrorReason } from "../../lib/bible/online-source";
import { bibleSource, type SearchResponse } from "../../lib/bible/source";

export interface BibleSearchState {
  /** The latest finished response; kept while a newer search runs so the list does not flash. */
  data?: SearchResponse;
  /** Milliseconds the latest finished search took. */
  ms?: number;
  loading: boolean;
  failed: boolean;
  /** Why an online search failed (no internet, not set up, too many requests). */
  error?: OnlineErrorReason;
  retry: () => void;
}

/**
 * SOURCE OF TRUTH KEYWORDS: useBibleSearch, search hook, BibleSource.search, cancel stale search
 * WHAT:  Runs a Bible search for the search page and times it; a newer query cancels the older one.
 * WHY:   Typing fires many searches. Aborting the stale ones keeps the preview's book scan from
 *        piling up, and keeping the last response visible avoids an empty flash between keys.
 * WHERE: search page.
 */
export function useBibleSearch(
  translationId: string,
  query: string,
  options: { scope: SearchScope; mode: MatchMode; limit: number },
): BibleSearchState {
  const { scope, mode, limit } = options;
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const key = `${translationId}|${scope}|${mode}|${limit}|${query}#${attempt}`;
  const [state, setState] = useState<{
    key: string;
    data?: SearchResponse;
    ms?: number;
    failed: boolean;
    error?: OnlineErrorReason;
  }>({
    key: "",
    failed: false,
  });

  useEffect(() => {
    if (!query.trim()) return;
    const controller = new AbortController();
    const started = performance.now();
    void bibleSource()
      .then((source) => source.search(translationId, query, { scope, mode, limit, signal: controller.signal }))
      .then(
        (data) => {
          if (!controller.signal.aborted) {
            setState({ key, data, ms: Math.round(performance.now() - started), failed: false });
          }
        },
        (error: unknown) => {
          if (!controller.signal.aborted) {
            setState((prev) => ({ ...prev, key, failed: true, error: onlineErrorReason(error) }));
          }
        },
      );
    return () => controller.abort();
  }, [translationId, query, scope, mode, limit, key]);

  if (!query.trim()) return { loading: false, failed: false, retry };
  const failed = state.key === key && state.failed;
  return {
    data: state.data,
    ms: state.ms,
    loading: state.key !== key,
    failed,
    error: failed ? state.error : undefined,
    retry,
  };
}
