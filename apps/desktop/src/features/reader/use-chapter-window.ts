import { bookByOrd } from "@starter/bible-core/books";
import { makeVerseId, splitVerseId, type VerseId } from "@starter/bible-core/verse-id";
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
    const nextVid = edge && adjacentChapter(edge.vid, direction);
    if (nextVid === undefined) return;
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
      setInView(vid);
      setState({ key: keyOf(translationsRef.current), chapters: [chapter] });
    },
    [scrollToTarget],
  );

  // A translation or parallel change reloads the mounted chapters in place.
  const key = keyOf(translations);
  useEffect(() => {
    const current = stateRef.current;
    if (current.key === key || current.chapters.length === 0) return;
    const gen = ++generation.current;
    void Promise.all(current.chapters.map((c) => loadWindowChapter(translationsRef.current, c.vid))).then(
      (chapters) => {
        if (gen !== generation.current) return;
        anchor.current = anchorOf(scrollRef.current);
        setState({ key, chapters });
      },
    );
  }, [key, scrollRef]);

  return { chapters: state.chapters, inView, jumpTo, onScroll: checkEdges };
}
