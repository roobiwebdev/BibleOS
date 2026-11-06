import { normalizeForSearch } from "@starter/bible-core/normalize";
import type { VerseRange } from "@starter/bible-core/range";
import {
  createTally,
  finishSearch,
  formatSearchQuery,
  parseSearchQuery,
  scopeRange,
  tallyVerse,
} from "@starter/bible-core/search";
import { bookCodeOf, chapterOf, splitVerseId, type VerseId } from "@starter/bible-core/verse-id";
import {
  isOnlineTranslationId,
  ONLINE_LIMITS,
  ONLINE_RELAY,
  relayErrorSchema,
  relayPassageSchema,
  relaySearchSchema,
  type OnlineTranslationId,
  type RelayRequest,
  type RelaySearch,
} from "@starter/bible-data/online";

import type { ChapterData, ChapterVerse, SearchOptions, SearchResponse, SearchVerse } from "./source";

/**
 * SOURCE OF TRUTH KEYWORDS: OnlineTextError, OnlineErrorReason, needs internet, offline, not configured, rate limited
 * WHAT:  Why online text could not be shown: no connection, the relay has no key for it yet,
 *        the publisher's limit is reached, or anything else.
 * WHY:   Screens show a friendly message with a retry for each reason instead of crashing or
 *        spinning forever, and the reader keeps working with bundled translations.
 * WHERE: online source (thrown), loadChapterWithFallback, useChapterLoad, usePassage, search hook.
 */
export type OnlineErrorReason = "offline" | "not-configured" | "rate-limited" | "failed";

export class OnlineTextError extends Error {
  constructor(readonly reason: OnlineErrorReason) {
    super(`Online text unavailable: ${reason}`);
    this.name = "OnlineTextError";
  }
}

export const onlineErrorReason = (error: unknown): OnlineErrorReason =>
  error instanceof OnlineTextError ? error.reason : "failed";

/**
 * SOURCE OF TRUTH KEYWORDS: createVerseCache, VerseCache, LRU cache, 500 verses, cache cap, versesStored
 * WHAT:  A least-recently-used cache whose size is counted in verses, not entries.
 * WHY:   The ESV terms allow keeping at most 500 verses (ONLINE_LIMITS.versesStored), and the app
 *        applies the same rule to the NLT. Each online translation gets its own cache, so the
 *        total kept per translation never passes the cap however the reader moves around.
 * WHERE: online source (chapters, verse ranges and search results).
 */
export function createVerseCache<V>(capacity: number = ONLINE_LIMITS.versesStored) {
  const entries = new Map<string, { value: V; verses: number }>();
  let size = 0;
  return {
    get(key: string): V | undefined {
      const entry = entries.get(key);
      if (!entry) return undefined;
      // Re-insert to mark as most recently used.
      entries.delete(key);
      entries.set(key, entry);
      return entry.value;
    },
    set(key: string, value: V, verses: number) {
      const old = entries.get(key);
      if (old) {
        entries.delete(key);
        size -= old.verses;
      }
      if (verses > capacity) return;
      for (const [k, entry] of entries) {
        if (size + verses <= capacity) break;
        entries.delete(k);
        size -= entry.verses;
      }
      entries.set(key, { value, verses });
      size += verses;
    },
    /** Verses currently kept. */
    get size() {
      return size;
    },
    clear() {
      entries.clear();
      size = 0;
    },
  };
}

type VersesEntry = { kind: "verses"; verses: ChapterVerse[]; headings: ChapterData["headings"] };
type Cached = VersesEntry | { kind: "search"; data: RelaySearch };
type PassageRequest = Extract<RelayRequest, { kind: "chapter" | "verses" }>;

/** One request per key at a time; a failure is not remembered, so a retry asks again. */
function shared<T>(inflight: Map<string, Promise<T>>, key: string, run: () => Promise<T>): Promise<T> {
  const pending = inflight.get(key);
  if (pending) return pending;
  const started = run().finally(() => inflight.delete(key));
  inflight.set(key, started);
  return started;
}

const REQUEST_TIMEOUT_MS = 15_000;

const onlineId = (translationId: string): OnlineTranslationId => {
  if (!isOnlineTranslationId(translationId)) throw new OnlineTextError("failed");
  return translationId;
};

export interface OnlineSourceOptions {
  fetch: typeof fetch;
  /** Defaults to ONLINE_RELAY.origin. */
  origin?: string;
  /** True when the system says it has no network; skips the request. */
  isOffline?: () => boolean;
}

/**
 * SOURCE OF TRUTH KEYWORDS: createOnlineSource, onlineSource, online BibleSource, relay client, ESV fetch, NLT fetch
 * WHAT:  Reads online translations (ESV, NLT) through the relay at bible.roobi.dev: one
 *        chapter, a verse range inside one chapter, or a search, each checked with the relay's
 *        Zod schemas and kept in a per-translation cache of at most 500 verses.
 * WHY:   Online text must behave like bundled text for every screen (same ChapterData, same
 *        search outcome, same VerseIds, so notes and highlights carry over) while keeping the
 *        publishers' limits. Requests for the same thing at the same time share one fetch.
 * WHERE: bibleSource() routes every online translation id here.
 */
export function createOnlineSource(options: OnlineSourceOptions) {
  const origin = options.origin ?? ONLINE_RELAY.origin;
  const caches = new Map<string, ReturnType<typeof createVerseCache<Cached>>>();
  const versesInflight = new Map<string, Promise<VersesEntry>>();
  const searchInflight = new Map<string, Promise<RelaySearch>>();

  const cacheFor = (translationId: string) => {
    let cache = caches.get(translationId);
    if (!cache) {
      cache = createVerseCache<Cached>();
      caches.set(translationId, cache);
    }
    return cache;
  };

  async function call(request: RelayRequest, signal?: AbortSignal): Promise<unknown> {
    if (options.isOffline?.()) throw new OnlineTextError("offline");
    const params = new URLSearchParams(Object.entries(request).map(([k, v]) => [k, String(v)]));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const forward = () => controller.abort();
    signal?.addEventListener("abort", forward, { once: true });
    let response: Response;
    try {
      response = await options.fetch(`${origin}${ONLINE_RELAY.path}?${params.toString()}`, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
    } catch (error) {
      signal?.throwIfAborted();
      // A network failure (no connection, DNS, TLS) or our timeout.
      throw new OnlineTextError(error instanceof DOMException && error.name === "AbortError" ? "failed" : "offline");
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", forward);
    }
    const body: unknown = await response.json().catch(() => undefined);
    if (response.ok) return body;
    const problem = relayErrorSchema.safeParse(body);
    const code = problem.success ? problem.data.error : undefined;
    throw new OnlineTextError(
      code === "not-configured"
        ? "not-configured"
        : code === "rate-limited" || response.status === 429
          ? "rate-limited"
          : "failed",
    );
  }

  async function loadVerses(translationId: string, request: PassageRequest, key: string): Promise<VersesEntry> {
    const cache = cacheFor(translationId);
    const hit = cache.get(key);
    if (hit?.kind === "verses") return hit;
    return shared(versesInflight, `${translationId}|${key}`, async () => {
      const parsed = relayPassageSchema.safeParse(await call(request));
      if (!parsed.success || parsed.data.translation !== translationId) throw new OnlineTextError("failed");
      const verses = parsed.data.verses.map((v): ChapterVerse => ({
        vid: v.vid,
        spanEnd: v.spanEnd ?? v.vid,
        // Combined verses read "20-21", the same label the bundled translations use.
        label:
          v.spanEnd === undefined
            ? String(splitVerseId(v.vid).verse)
            : `${splitVerseId(v.vid).verse}-${splitVerseId(v.spanEnd).verse}`,
        style: v.style,
        text: v.text,
      }));
      const entry: VersesEntry = { kind: "verses", verses, headings: parsed.data.headings };
      cache.set(key, entry, verses.length);
      return entry;
    });
  }

  async function getChapter(translationId: string, chapterId: VerseId): Promise<ChapterData> {
    const t = onlineId(translationId);
    const book = bookCodeOf(chapterId);
    const { chapter } = splitVerseId(chapterId);
    if (!book || chapter < 1) return { verses: [], headings: [] };
    const entry = await loadVerses(t, { kind: "chapter", t, book, chapter }, `c:${chapterOf(chapterId)}`);
    return { verses: entry.verses, headings: entry.headings };
  }

  /** Verses of a range inside its first chapter (the reader opens anything longer). */
  async function getPassage(translationId: string, range: VerseRange): Promise<ChapterVerse[]> {
    const t = onlineId(translationId);
    const chapterId = chapterOf(range.start);
    const inRange = (v: ChapterVerse) => v.spanEnd >= range.start && v.vid <= range.end;
    const whole = cacheFor(t).get(`c:${chapterId}`);
    if (whole?.kind === "verses") return whole.verses.filter(inRange);
    const book = bookCodeOf(range.start);
    const { chapter, verse } = splitVerseId(range.start);
    if (!book || chapter < 1) return [];
    if (verse === 0 || chapterOf(range.end) !== chapterId)
      return (await getChapter(t, chapterId)).verses.filter(inRange);
    const to = Math.max(verse, splitVerseId(range.end).verse);
    const entry = await loadVerses(t, { kind: "verses", t, book, chapter, from: verse, to }, `v:${range.start}-${to}`);
    return entry.verses.filter(inRange);
  }

  /**
   * The publisher searches the whole Bible and returns its first results; the shared matcher
   * then applies the scope, whole-word mode and exclusions, so highlights work as they do offline.
   */
  async function search(translationId: string, input: string, opts: SearchOptions): Promise<SearchResponse> {
    const t = onlineId(translationId);
    const query = parseSearchQuery(input);
    const tally = createTally<SearchVerse>(opts.limit);
    const q = formatSearchQuery({ include: query.include, exclude: [] }).slice(0, ONLINE_LIMITS.searchQueryLength);
    if (query.include.length === 0 || q.length < 2)
      return { ...finishSearch(tally, query, opts.mode), online: { total: 0, received: 0 } };
    const cache = cacheFor(t);
    const key = `s:${q}`;
    const hit = cache.get(key);
    const data =
      hit?.kind === "search"
        ? hit.data
        : await shared(searchInflight, `${t}|${key}`, async () => {
            const parsed = relaySearchSchema.safeParse(await call({ kind: "search", t, q }, opts.signal));
            if (!parsed.success || parsed.data.translation !== t) throw new OnlineTextError("failed");
            cache.set(key, { kind: "search", data: parsed.data }, parsed.data.results.length);
            return parsed.data;
          });
    opts.signal?.throwIfAborted();
    const { start, end } = scopeRange(opts.scope);
    for (const r of data.results.toSorted((a, b) => a.vid - b.vid)) {
      if (r.vid < start || r.vid > end) continue;
      const verse: SearchVerse = { vid: r.vid, spanEnd: r.vid, label: String(splitVerseId(r.vid).verse), text: r.text };
      tallyVerse(tally, verse, normalizeForSearch(r.text), query, opts.mode);
    }
    return { ...finishSearch(tally, query, opts.mode), online: { total: data.total, received: data.results.length } };
  }

  return {
    getChapter,
    getPassage,
    search,
    /** Verses kept for a translation (tests and diagnostics). */
    cachedVerses: (translationId: string) => caches.get(translationId)?.size ?? 0,
  };
}

export type OnlineSource = ReturnType<typeof createOnlineSource>;
