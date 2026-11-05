import { bookByOrd } from "@starter/bible-core/books";
import { makeVerseId, splitVerseId, type VerseId } from "@starter/bible-core/verse-id";
import { isOnlineTranslationId, ONLINE_LIMITS } from "@starter/bible-data/online";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

import { loadChapterWithFallback, type ShownChapter } from "../../lib/bible/use-chapter";

/**
 * SOURCE OF TRUTH KEYWORDS: adjacentChapter, next chapter, previous chapter, book boundary, chapter step
 * WHAT:  The chapter before or after a chapter in canonical order, crossing book boundaries
 *        (Genesis 50 → Exodus 1). Undefined before Genesis 1 and after the last book.
 * WHY:   Continuous scrolling, the [ ] keys and the header arrows all step the same way.
 * WHERE: reader page, useChapterWindow.
 */
export function adjacentChapter(chapterId: VerseId, delta: 1 | -1): VerseId | undefined {
  const { ord, chapter } = splitVerseId(chapterId);
  const book = bookByOrd(ord);
  if (!book) return undefined;
  const next = chapter + delta;
  if (next >= 1 && next <= book.chapters) return makeVerseId(ord, next);
  const other = bookByOrd(ord + delta);
  if (!other) return undefined;
  return makeVerseId(other.ord, delta > 0 ? 1 : other.chapters);
}

export interface WindowChapter {
  vid: VerseId;
  main: ShownChapter;
  /** Only loaded in parallel mode. */
  second: ShownChapter | undefined;
}

interface Translations {
  main: string;
  second: string;
  parallel: boolean;
}

/** Chapters kept on the far side of the chapter in view; anything further is unloaded. */
const KEEP_BEHIND = 2;
/** Load more once the reader is within this many screens of an edge. */
const EDGE_SCREENS = 1.5;
/** The band (from the top of the scroller) whose chapter counts as "in view". */
const VIEW_BAND = "-22% 0px -77% 0px";

const keyOf = (t: Translations) => `${t.main}|${t.parallel ? t.second : ""}`;

async function loadWindowChapter(t: Translations, vid: VerseId): Promise<WindowChapter> {
  const [main, second] = await Promise.all([
    loadChapterWithFallback(t.main, vid),
    t.parallel ? loadChapterWithFallback(t.second, vid) : Promise.resolve(undefined),
  ]);
  return { vid, main, second };
}

/**
 * SOURCE OF TRUTH KEYWORDS: fitsOnlineLimits, trimForOnline, display limit, half a book, 500 verses on screen
 * WHAT:  Whether the mounted chapters keep each online translation within its publisher's
 *        display limit: at most 500 verses, and at most half of a book's chapters (one chapter
 *        is always allowed), and trimming the window from the far side until they do.
 * WHY:   ESV terms: "You may not display more than 500 verses or one-half of any book (whichever
 *        is less) on any page." The continuous reader is one page, so it keeps fewer chapters
 *        mounted for online text. Half a book is counted in chapters; bundled text is unlimited.
 * WHERE: useChapterWindow (loading the next chapter, translation changes).
 */
export function fitsOnlineLimits(chapters: readonly WindowChapter[]): boolean {
  const shown = new Map<string, { verses: number; chapters: Map<number, number> }>();
  for (const chapter of chapters) {
    for (const text of [chapter.main, chapter.second]) {
      if (!text || !isOnlineTranslationId(text.id) || text.data.verses.length === 0) continue;
      const entry = shown.get(text.id) ?? { verses: 0, chapters: new Map<number, number>() };
      const { ord } = splitVerseId(chapter.vid);
      entry.verses += text.data.verses.length;
      entry.chapters.set(ord, (entry.chapters.get(ord) ?? 0) + 1);
      shown.set(text.id, entry);
    }
  }
  for (const entry of shown.values()) {
    if (entry.verses > ONLINE_LIMITS.versesShown) return false;
    for (const [ord, count] of entry.chapters) {
      if (count > Math.max(1, Math.floor((bookByOrd(ord)?.chapters ?? 1) / 2))) return false;
    }
  }
  return true;
}

export function trimForOnline(
  chapters: WindowChapter[],
  keep: VerseId | undefined,
  direction: 1 | -1,
): WindowChapter[] {
  let out = chapters;
  while (out.length > 1 && !fitsOnlineLimits(out)) {
    // Drop from the side the reader is moving away from, never the chapter in view.
    const dropFirst = direction > 0 ? out[0]?.vid !== keep : out.at(-1)?.vid === keep;
    out = dropFirst ? out.slice(1) : out.slice(0, -1);
  }
  return out;
}

const failed = (chapter: WindowChapter | undefined) => Boolean(chapter?.main.error ?? chapter?.second?.error);

/** Where the first visible chapter sits, so it can be put back after content above it changes. */
function anchorOf(scroller: HTMLElement | null): { vid: VerseId; top: number } | null {
  if (!scroller) return null;
  const top = scroller.getBoundingClientRect().top;
  for (const section of scroller.querySelectorAll<HTMLElement>("[data-chapter]")) {
    const rect = section.getBoundingClientRect();
    if (rect.bottom > top) return { vid: Number(section.dataset.chapter), top: rect.top - top };
  }
  return null;
}

function sectionOf(scroller: HTMLElement, vid: VerseId): HTMLElement | null {
  return scroller.querySelector<HTMLElement>(`[data-chapter="${vid}"]`);
}

/**
 * SOURCE OF TRUTH KEYWORDS: useChapterWindow, continuous reader, infinite scroll, lazy chapters, scroll anchoring, chapter in view
 * WHAT:  The chapters currently mounted in the continuous reader (a small window around the
 *        chapter in view), which chapter is in view, and jumping to a chapter or verse.
 * WHY:   Reading flows from one chapter into the next without page turns, but the whole Bible
 *        must never be in the DOM. Chapters are added only once their text has loaded, and the
 *        scroll position is corrected before paint whenever content above the reader changes
 *        (prepending or unloading), so the text never jumps. WebKit has no CSS scroll anchoring.
 * WHERE: reader page.
 */
export function useChapterWindow(scrollRef: RefObject<HTMLDivElement | null>, translations: Translations) {
  const [state, setState] = useState<{ key: string; chapters: WindowChapter[] }>({ key: "", chapters: [] });
  const [inView, setInView] = useState<VerseId | undefined>();
  // Async loaders read the latest values through refs, synced before any other effect runs.
  const stateRef = useRef(state);
  const inViewRef = useRef(inView);
  const translationsRef = useRef(translations);
  useLayoutEffect(() => {
    stateRef.current = state;
    inViewRef.current = inView;
    translationsRef.current = translations;
  });

  const busy = useRef(false);
  // The next chapter the online display limit kept out, and the chapter in view then; it is not
  // asked for again until the reader moves to another chapter.
  const blocked = useRef<{ next: VerseId; inView: VerseId | undefined } | null>(null);
  const [limited, setLimited] = useState(false);
  const generation = useRef(0);
  const anchor = useRef<{ vid: VerseId; top: number } | null>(null);
  const pendingScroll = useRef<{ vid: VerseId; verse?: VerseId; smooth: boolean } | null>(null);

  const scrollToTarget = useCallback(
    (target: { vid: VerseId; verse?: VerseId; smooth: boolean }) => {
      const scroller = scrollRef.current;
      if (!scroller) return false;
      const section = sectionOf(scroller, target.vid);
      if (!section) return false;
      // A merged verse (John 3:14-16 in one) is stored at its first id: take the last verse at or before the target.
      let verse: HTMLElement | null = null;
      if (target.verse !== undefined) {
        for (const el of section.querySelectorAll<HTMLElement>("[data-vid]")) {
          if (Number(el.dataset.vid) <= target.verse) verse = el;
        }
      }
      if (verse) {
        verse.scrollIntoView({ block: "center", behavior: target.smooth ? "smooth" : "auto" });
      } else {
        scroller.scrollTop += section.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
      }
      return true;
    },
    [scrollRef],
  );

  /** Loads more text when the reader nears either end of what is mounted. */
  const checkEdges = useCallback(() => {
    const scroller = scrollRef.current;
    const current = stateRef.current;
    if (!scroller || busy.current || current.chapters.length === 0) return;
    const margin = scroller.clientHeight * EDGE_SCREENS;
    const direction =
      scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < margin
        ? 1
        : scroller.scrollTop < margin
          ? -1
          : 0;
    if (direction === 0) return;
    const edge = direction > 0 ? current.chapters.at(-1) : current.chapters[0];
    // Past a chapter that could not load (no internet), wait for a retry instead of asking again.
    if (failed(edge)) return;
    const nextVid = edge && adjacentChapter(edge.vid, direction);
    if (nextVid === undefined) return;
    if (blocked.current?.next === nextVid && blocked.current.inView === inViewRef.current) return;
    busy.current = true;
    const gen = generation.current;
    void loadWindowChapter(translationsRef.current, nextVid)
      .then((next) => {
        if (gen !== generation.current || stateRef.current !== current) {
          // The window changed while loading: look again from where the reader is now.
          requestAnimationFrame(() => scroller.dispatchEvent(new Event("scroll")));
          return;
        }
        let chapters = direction > 0 ? [...current.chapters, next] : [next, ...current.chapters];
        // Unload chapters far behind the one in view, on the side we are moving away from.
        const centre = chapters.findIndex((c) => c.vid === inViewRef.current);
        if (centre >= 0) {
          chapters =
            direction > 0
              ? chapters.slice(Math.max(0, centre - KEEP_BEHIND))
              : chapters.slice(0, centre + KEEP_BEHIND + 1);
        }
        chapters = trimForOnline(chapters, inViewRef.current, direction);
        if (!chapters.includes(next)) {
          blocked.current = { next: nextVid, inView: inViewRef.current };
          setLimited(true);
          return;
        }
        blocked.current = null;
        setLimited(false);
        anchor.current = anchorOf(scroller);
        setState({ key: current.key, chapters });
      })
      .finally(() => {
        busy.current = false;
      });
  }, [scrollRef]);

  // After every change: scroll to a requested target, or keep the anchored chapter in place.
  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || state.chapters.length === 0) return;
    const target = pendingScroll.current;
    if (target && scrollToTarget(target)) {
      pendingScroll.current = null;
      anchor.current = null;
    } else if (anchor.current) {
      const section = sectionOf(scroller, anchor.current.vid);
      if (section) {
        scroller.scrollTop +=
          section.getBoundingClientRect().top - scroller.getBoundingClientRect().top - anchor.current.top;
      }
      anchor.current = null;
    }
    const frame = requestAnimationFrame(checkEdges);
    return () => cancelAnimationFrame(frame);
  }, [state.chapters, scrollRef, scrollToTarget, checkEdges]);

  // The chapter crossing a band near the top of the scroller is the one being read.
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const vid = Number(entry.target.getAttribute("data-chapter"));
          if (entry.isIntersecting && Number.isFinite(vid)) setInView(vid);
        }
      },
      { root: scroller, rootMargin: VIEW_BAND, threshold: 0 },
    );
    for (const chapter of state.chapters) {
      const section = sectionOf(scroller, chapter.vid);
      if (section) observer.observe(section);
    }
    return () => observer.disconnect();
  }, [state.chapters, scrollRef]);

  /** Shows a chapter (and optionally a verse in it): scrolls if mounted, otherwise starts a new window there. */
  const jumpTo = useCallback(
    async (vid: VerseId, verse?: VerseId) => {
      const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const mounted = stateRef.current.key === keyOf(translationsRef.current);
      if (mounted && stateRef.current.chapters.some((c) => c.vid === vid)) {
        // Glide only within the chapter on screen; a longer glide would pass through other chapters.
        const glide = verse !== undefined && smooth && vid === inViewRef.current;
        setInView(vid);
        scrollToTarget({ vid, verse, smooth: glide });
        return;
      }
      const gen = ++generation.current;
      const chapter = await loadWindowChapter(translationsRef.current, vid);
      if (gen !== generation.current) return;
      pendingScroll.current = { vid, verse, smooth: false };
      blocked.current = null;
      setLimited(false);
      setInView(vid);
      setState({ key: keyOf(translationsRef.current), chapters: [chapter] });
    },
    [scrollToTarget],
  );

  /** Loads the mounted chapters again for the current translations, kept within online limits. */
  const reload = useCallback(
    (key: string) => {
      const current = stateRef.current;
      const gen = ++generation.current;
      void Promise.all(current.chapters.map((c) => loadWindowChapter(translationsRef.current, c.vid))).then(
        (loaded) => {
          if (gen !== generation.current) return;
          const chapters = trimForOnline(loaded, inViewRef.current, 1);
          blocked.current = null;
          setLimited(chapters.length < loaded.length);
          anchor.current = anchorOf(scrollRef.current);
          setState({ key, chapters });
        },
      );
    },
    [scrollRef],
  );

  // A translation or parallel change reloads the mounted chapters in place.
  const key = keyOf(translations);
  useEffect(() => {
    const current = stateRef.current;
    if (current.key === key || current.chapters.length === 0) return;
    reload(key);
  }, [key, reload]);

  /** Tries online chapters that failed (no internet) again. */
  const retry = useCallback(() => {
    if (stateRef.current.chapters.length > 0) reload(stateRef.current.key);
  }, [reload]);

  return { chapters: state.chapters, inView, jumpTo, onScroll: checkEdges, retry, limited };
}
