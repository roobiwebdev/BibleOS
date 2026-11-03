/*
 * Adapted from bible-rs (site/src/lib/ease.ts), https://github.com/michaelshimeles/bible-rs
 * Copyright (c) 2026 Micky (github.com/michaelshimeles). MIT License; full text in
 * apps/site/THIRD_PARTY_NOTICES.md.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: easing, span, envelope, clamp, lerp, easeOut, easeInOut, timeline maths
 * WHAT:  Pure helpers that turn a time in milliseconds into 0..1 progress values.
 * WHY:   The hero demo is a pure function of time; every animated value comes from these, so
 *        scrubbing, pausing and reduced motion all work without per-element state.
 * WHERE: demo/scene.tsx, demo/showcase.tsx.
 */
export const clamp = (x: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));

export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

/** Progress of `t` through [start, end], clamped to 0..1. */
export const span = (t: number, start: number, end: number) => clamp((t - start) / (end - start));

export const easeOut = (p: number) => 1 - (1 - p) ** 3;

export const easeInOut = (p: number) => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2);

/** 0 → 1 over [inStart, inEnd], then 1 → 0 over [outStart, outEnd]. */
export const envelope = (t: number, inStart: number, inEnd: number, outStart: number, outEnd: number) =>
  Math.min(easeOut(span(t, inStart, inEnd)), 1 - easeInOut(span(t, outStart, outEnd)));
