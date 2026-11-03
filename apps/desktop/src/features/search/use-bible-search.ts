import type { MatchMode, SearchScope } from "@starter/bible-core/search";
import { useEffect, useState } from "react";

import { bibleSource, type SearchResponse } from "../../lib/bible/source";

export interface BibleSearchState {
  /** The latest finished response; kept while a newer search runs so the list does not flash. */
  data?: SearchResponse;
  /** Milliseconds the latest finished search took. */
  ms?: number;
  loading: boolean;
  failed: boolean;
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
  const key = `${translationId}|${scope}|${mode}|${limit}|${query}`;
  const [state, setState] = useState<{ key: string; data?: SearchResponse; ms?: number; failed: boolean }>({
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
        () => {
          if (!controller.signal.aborted) setState((prev) => ({ ...prev, key, failed: true }));
        },
      );
    return () => controller.abort();
  }, [translationId, query, scope, mode, limit, key]);

  if (!query.trim()) return { loading: false, failed: false };
  return { data: state.data, ms: state.ms, loading: state.key !== key, failed: state.key === key && state.failed };
}
