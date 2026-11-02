import { subtractRange, type VerseRange } from "@starter/bible-core/range";
import type { HighlightRow } from "@starter/local-db/schema";
import { z } from "zod";

import { defineCommand, type CommandContext } from "../command";
import {
  HIGHLIGHT_COLORS,
  highlightColorSchema,
  isHighlightColor,
  rangeOf,
  verseRangeSchema,
  type HighlightColor,
} from "../schemas";
import * as highlightsService from "../services/highlights";

/**
 * SOURCE OF TRUTH KEYWORDS: Highlight, toHighlight, highlight shape
 * WHAT:  A highlight as the UI sees it: a verse range, a colour key and timestamps.
 * WHY:   Matches the desktop store's Highlight so screens keep working when storage changes.
 * WHERE: highlights commands, desktop reader.
 */
export interface Highlight extends VerseRange {
  id: string;
  color: HighlightColor;
  createdAt: number;
  updatedAt: number;
}

export function toHighlight(row: HighlightRow): Highlight {
  return {
    id: row.id,
    ...rangeOf(row),
    color: isHighlightColor(row.color) ? row.color : HIGHLIGHT_COLORS[3],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Cuts `cut` out of every live highlight: the first remaining piece keeps the highlight's id,
 * a second piece (when the cut falls in the middle) becomes a new row, and a fully covered
 * highlight is soft-deleted. Same rule as bible-core subtractRange and the preview store.
 */
async function cutHighlights(ctx: CommandContext, cut: VerseRange): Promise<void> {
  for (const row of await highlightsService.listOverlapping(ctx.db, cut)) {
    const [first, ...rest] = subtractRange(rangeOf(row), cut);
    if (!first) {
      await highlightsService.softDelete(ctx.db, row.id, ctx.now);
      continue;
    }
    await highlightsService.setRange(ctx.db, row.id, first, ctx.now);
    for (const piece of rest) {
      await highlightsService.insert(ctx.db, {
        id: ctx.newId(),
        startVid: piece.start,
        endVid: piece.end,
        color: row.color,
        createdAt: row.createdAt,
        updatedAt: ctx.now,
      });
    }
  }
}

/**
 * SOURCE OF TRUTH KEYWORDS: highlights.set, highlights.remove, highlights.list, recolour, split highlight
 * WHAT:  Highlight commands. `set` paints a range one colour (cutting whatever was there),
 *        `remove` clears a range, `list` returns live highlights overlapping a range.
 * WHY:   Recolouring one verse of a longer highlight must split it, not delete it.
 * WHERE: desktop reader toolbar and verse menu, Study page.
 */
export const highlightCommands = {
  set: defineCommand({
    entity: "highlights",
    action: "set",
    kind: "mutation",
    input: z.object({ range: verseRangeSchema, color: highlightColorSchema }),
    run: async (ctx, { range, color }) => {
      await cutHighlights(ctx, range);
      const row = {
        id: ctx.newId(),
        startVid: range.start,
        endVid: range.end,
        color,
        createdAt: ctx.now,
        updatedAt: ctx.now,
      };
      await highlightsService.insert(ctx.db, row);
      return toHighlight({ ...row, deletedAt: null, charStart: null, charEnd: null, quote: null });
    },
    entityId: (h) => h.id,
  }),

  remove: defineCommand({
    entity: "highlights",
    action: "remove",
    kind: "mutation",
    input: z.object({ range: verseRangeSchema }),
    run: async (ctx, { range }) => {
      await cutHighlights(ctx, range);
      return { removed: true };
    },
  }),

  list: defineCommand({
    entity: "highlights",
    action: "list",
    kind: "query",
    input: z.object({ range: verseRangeSchema }),
    run: async (ctx, { range }) => (await highlightsService.listOverlapping(ctx.db, range)).map(toHighlight),
  }),
};
