/*
 * Playback behaviour (loop while visible, hold a settled frame for reduced motion until the
 * visitor presses play, seek by chapter) follows bible-rs (site/src/lib/demo/player.svelte.ts),
 * https://github.com/michaelshimeles/bible-rs. Copyright (c) 2026 Micky
 * (github.com/michaelshimeles). MIT License; full text in apps/site/THIRD_PARTY_NOTICES.md.
 */
import { useCallback, useEffect, useState, type RefObject } from "react";

import { useInView, usePrefersReducedMotion } from "../lib/motion";
import { DURATION, SETTLED } from "./script";

/** `?demo=12000` freezes the demo at that moment, for the poster and Open Graph captures. */
function frozenTime(): number | undefined {
  const raw = new URLSearchParams(window.location.search).get("demo");
  if (raw === null) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.min(Math.max(value, 0), DURATION) : undefined;
}

export interface DemoClock {
  time: number;
  paused: boolean;
  toggle: () => void;
  replay: () => void;
  seek: (t: number) => void;
}

/**
 * SOURCE OF TRUTH KEYWORDS: useDemoClock, demo player, play, pause, seek, loop, reduced motion
 * WHAT:  The hero demo's clock in milliseconds, looping over DURATION.
 * WHY:   It advances only while the demo is on screen in a visible tab, so it costs nothing
 *        elsewhere. With reduced motion it shows SETTLED until the visitor starts it.
 * WHERE: demo/showcase.tsx.
 */
export function useDemoClock(ref: RefObject<Element | null>): DemoClock {
  const reduced = usePrefersReducedMotion();
  const visible = useInView(ref, 0.3);
  const [frozen] = useState(frozenTime);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [touched, setTouched] = useState(false);

  const moving = frozen === undefined && (!reduced || touched);
  const running = moving && playing && visible;

  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const dt = Math.min(100, now - last);
      last = now;
      setT((x) => (x + dt) % DURATION);
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [running]);

  const paused = !(moving && playing);

  const toggle = useCallback(() => {
    setTouched(true);
    setPlaying((p) => (paused ? true : !p));
  }, [paused]);

  const replay = useCallback(() => {
    setTouched(true);
    setT(0);
    setPlaying(true);
  }, []);

  const seek = useCallback((to: number) => {
    setTouched(true);
    setT(to);
  }, []);

  return { time: frozen ?? (moving ? t : SETTLED), paused, toggle, replay, seek };
}
