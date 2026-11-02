import type { HighlightColor } from "../lib/state/study-store";

/**
 * SOURCE OF TRUTH KEYWORDS: HIGHLIGHT_BG, highlight colour classes, highlight swatch, bg-hl
 * WHAT:  The background utility for each highlight meaning.
 * WHY:   Reader text, toolbar swatches and Study lists must show the same colour per meaning.
 * WHERE: chapter-text, reader action bar, Study highlights tab.
 */
export const HIGHLIGHT_BG: Record<HighlightColor, string> = {
  promise: "bg-hl-promise",
  command: "bg-hl-command",
  prayer: "bg-hl-prayer",
  insight: "bg-hl-insight",
  question: "bg-hl-question",
};
