/*
 * The timeline structure (chapters, word-by-word captions, typed text as key times) follows the
 * hero demo of bible-rs, https://github.com/michaelshimeles/bible-rs
 * Copyright (c) 2026 Micky (github.com/michaelshimeles). MIT License; full text in
 * apps/site/THIRD_PARTY_NOTICES.md. The scenes and content are BibleOS's own.
 */

/** The scene is laid out at this size and scaled to fit its frame. */
export const STAGE = { w: 1200, h: 760 } as const;

export const DURATION = 25_000;
/** With reduced motion the demo holds here: a highlighted verse with its note written. */
export const SETTLED = 14_800;

export interface Typing {
  text: string;
  keys: readonly number[];
}

function typing(text: string, start: number, step: number): Typing {
  return { text, keys: [...text].map((_, i) => start + i * step) };
}

/**
 * SOURCE OF TRUTH KEYWORDS: demo timeline, T, CHAPTERS, CAPTIONS, DURATION, SETTLED, hero demo script
 * WHAT:  When everything in the hero demo happens, in milliseconds from the start of the loop.
 * WHY:   One table drives the scene, the chapter scrubber and the captions, so retiming a step
 *        moves all three together.
 * WHERE: demo/scene.tsx, demo/showcase.tsx, demo/use-clock.ts.
 */
export const T = {
  today: { fill: [500, 2400] as const },
  jump: {
    open: 4400,
    typing: typing("john 3:16", 4750, 110),
    enter: 5900,
    land: 6050,
    flash: [6300, 8400] as const,
  },
  study: {
    select: 9200,
    bar: 9400,
    pick: 10_100,
    note: 10_700,
    rail: 10_800,
    typing: typing("Love goes first. He gave before anyone asked. See [[1 John 4:19]].", 11_200, 38),
    tag: 13_800,
    save: 14_200,
    barOut: 14_300,
  },
  search: {
    open: 15_400,
    typing: typing("ፍቅር", 15_800, 200),
    enter: 16_700,
    land: 16_850,
    results: 17_100,
    resultStep: 110,
  },
  theme: {
    open: 20_300,
    night: 21_100,
    paper: 22_700,
    sepia: 24_100,
    close: 24_500,
  },
} as const;

export const CHAPTERS = [
  { label: "Today", t: 0 },
  { label: "Go to", t: 4200 },
  { label: "Study", t: 9000 },
  { label: "Search", t: 15_200 },
  { label: "Themes", t: 20_100 },
] as const;

export interface Caption {
  start: number;
  end: number;
  words: { text: string; at: number }[];
}

/** Spreads the words across [start, end], giving longer words more time. */
function caption(text: string, start: number, end: number): Caption {
  const parts = text.split(" ");
  const weights = parts.map((w) => w.length + 2);
  const total = weights.reduce((a, b) => a + b, 0);
  let at = start;
  const words = parts.map((w, i) => {
    const word = { text: w, at };
    at += ((end - start) * (weights[i] ?? 0)) / total;
    return word;
  });
  return { start, end, words };
}

export const CAPTIONS: readonly Caption[] = [
  caption("Each day opens with a verse and your reading rhythm.", 300, 2200),
  caption("Go to any passage, typed in English or Amharic.", 4400, 6200),
  caption("Highlight a verse and write a note beside it.", 9200, 11_400),
  caption("Search every verse, in Amharic as well as English.", 15_400, 17_400),
  caption("Read in Sepia, Paper or Night. The app icon follows.", 20_300, 22_400),
];

/** The part of a typed text that has appeared by time t. */
export const typed = (t: number, text: Typing) => text.text.slice(0, text.keys.filter((k) => t >= k).length);

/** Caret visibility: solid while typing, blinking otherwise. */
export const caretOn = (t: number, text: Typing) =>
  text.keys.some((k) => t >= k && t < k + 450) || Math.floor(t / 530) % 2 === 0;
