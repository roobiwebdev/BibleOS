import { dayKeyOf } from "@starter/bible-core/calendar";
import type { VerseId } from "@starter/bible-core/verse-id";
import { useEffect, useRef } from "react";

import { useStudy } from "./study-store";

const IDLE_AFTER_MS = 3 * 60_000;
const MIN_SESSION_SECONDS = 8;

/**
 * SOURCE OF TRUTH KEYWORDS: useReadingTimer, reading time, focused reading, session tracking, idle detection
 * WHAT:  Counts seconds of actual reading on a chapter and saves them as a reading session when
 *        the chapter changes or the reader closes.
 * WHY:   Habit numbers should reflect reading, not an open window: time counts only while the
 *        page is visible, the window has focus, and the reader scrolled, clicked or typed in the
 *        last three minutes. Very short visits (under 8 s) are not sessions.
 * WHERE: reader page.
 */
export function useReadingTimer(chapterId: VerseId, translationId: string, active: boolean) {
  const { recordReading } = useStudy();
  const seconds = useRef(0);
  const startedAt = useRef(0);
  const lastActivity = useRef(0);

  useEffect(() => {
    const touch = () => {
      lastActivity.current = Date.now();
    };
    const events = ["scroll", "keydown", "pointerdown", "pointermove", "wheel"] as const;
    for (const e of events) window.addEventListener(e, touch, { passive: true, capture: true });
    return () => {
      for (const e of events) window.removeEventListener(e, touch, { capture: true });
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    seconds.current = 0;
    startedAt.current = Date.now();
    lastActivity.current = Date.now();
    const tick = setInterval(() => {
      const reading =
        document.visibilityState === "visible" &&
        document.hasFocus() &&
        Date.now() - lastActivity.current < IDLE_AFTER_MS;
      if (reading) seconds.current += 1;
    }, 1000);
    return () => {
      clearInterval(tick);
      if (seconds.current >= MIN_SESSION_SECONDS) {
        const endedAt = Date.now();
        recordReading({
          startedAt: startedAt.current,
          endedAt,
          seconds: seconds.current,
          vid: chapterId,
          translationId,
          day: dayKeyOf(new Date(endedAt)),
        });
      }
    };
  }, [chapterId, translationId, active, recordReading]);
}
