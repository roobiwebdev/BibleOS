import type { VerseRange } from "@starter/bible-core/range";
import { z } from "zod";

import { CommandError, defineCommand, type CommandContext } from "../command";
import { LIMITS, rangeOf, verseRangeSchema } from "../schemas";
import * as bookmarksService from "../services/bookmarks";

/**
 * SOURCE OF TRUTH KEYWORDS: Bookmark, bookmark shape, saved place, bookmark label
 * WHAT:  One bookmarked passage as the UI sees it: an exact verse range plus an optional label.
 * WHY:   A bookmark is a quick "keep my place here", separate from collections, so it is just
 *        a range; the label is empty until the reader names it.
 * WHERE: bookmarks commands, desktop study store, BookmarkButton, Study → Bookmarks.
 */
export interface Bookmark extends VerseRange {
  id: string;
  label: string;
  createdAt: number;
  updatedAt: number;
}

function toBookmark(row: {
  id: string;
  startVid: number;
  endVid: number;
  label: string;
  createdAt: number;
  updatedAt: number;
}): Bookmark {
  return { id: row.id, ...rangeOf(row), label: row.label, createdAt: row.createdAt, updatedAt: row.updatedAt };
}

async function rowOrThrow(ctx: CommandContext, id: string) {
  const row = await bookmarksService.get(ctx.db, id);
  if (!row) throw new CommandError("NOT_FOUND", "That bookmark no longer exists.");
  return row;
}

const idSchema = z.string().min(1).max(64);
// A label is a short title; it shares the title limit so every name in the app has one cap.
const labelSchema = z.string().trim().max(LIMITS.title);

/**
 * SOURCE OF TRUTH KEYWORDS: bookmarks.toggle, bookmarks.list, bookmarks.rename, bookmarks.remove, bookmarks.restore, undo
 * WHAT:  Bookmark commands. `toggle` adds a bookmark on an exact range or removes the one that
 *        is there; `remove` soft-deletes and `restore` undoes it; `rename` sets the label.
 * WHY:   One click in the reader must flip the state, so toggle decides add or remove in one
 *        transaction. Undo restores the same row (same id and change history), like notes.
 * WHERE: desktop BookmarkButton (reader header), study store, Study → Bookmarks.
 */
export const bookmarkCommands = {
  toggle: defineCommand({
    entity: "bookmarks",
    action: "toggle",
    kind: "mutation",
    input: z.object({ range: verseRangeSchema, label: labelSchema.optional() }),
    run: async (ctx, { range, label }): Promise<{ bookmarked: boolean; bookmark: Bookmark }> => {
      const existing = await bookmarksService.findLive(ctx.db, range);
      if (existing) {
        await bookmarksService.setDeleted(ctx.db, existing.id, ctx.now, ctx.now);
        return { bookmarked: false, bookmark: toBookmark({ ...existing, updatedAt: ctx.now }) };
      }
      const row = {
        id: ctx.newId(),
        startVid: range.start,
        endVid: range.end,
        label: label ?? "",
        createdAt: ctx.now,
        updatedAt: ctx.now,
      };
      await bookmarksService.insert(ctx.db, row);
      return { bookmarked: true, bookmark: toBookmark(row) };
    },
    entityId: (out) => out.bookmark.id,
  }),

  list: defineCommand({
    entity: "bookmarks",
    action: "list",
    kind: "query",
    input: z.object({ limit: z.number().int().min(1).max(LIMITS.listLimit).default(LIMITS.listLimit) }).default({
      limit: LIMITS.listLimit,
    }),
    run: async (ctx, { limit }): Promise<Bookmark[]> =>
      (await bookmarksService.listLive(ctx.db, limit)).map(toBookmark),
  }),

  rename: defineCommand({
    entity: "bookmarks",
    action: "rename",
    kind: "mutation",
    input: z.object({ id: idSchema, label: labelSchema }),
    run: async (ctx, { id, label }): Promise<Bookmark> => {
      const row = await rowOrThrow(ctx, id);
      if (row.deletedAt != null) throw new CommandError("CONFLICT", "Restore the bookmark before renaming it.");
      await bookmarksService.setLabel(ctx.db, id, label, ctx.now);
      return toBookmark({ ...row, label, updatedAt: ctx.now });
    },
    entityId: (_out, input) => input.id,
  }),

  remove: defineCommand({
    entity: "bookmarks",
    action: "remove",
    kind: "mutation",
    input: z.object({ id: idSchema }),
    run: async (ctx, { id }) => {
      const row = await rowOrThrow(ctx, id);
      if (row.deletedAt == null) await bookmarksService.setDeleted(ctx.db, id, ctx.now, ctx.now);
      return { id };
    },
    entityId: (_out, input) => input.id,
  }),

  restore: defineCommand({
    entity: "bookmarks",
    action: "restore",
    kind: "mutation",
    input: z.object({ id: idSchema }),
    run: async (ctx, { id }): Promise<Bookmark> => {
      const row = await rowOrThrow(ctx, id);
      if (row.deletedAt == null) return toBookmark(row);
      // The same passage was bookmarked again since: keep that one rather than show two.
      const live = await bookmarksService.findLive(ctx.db, rangeOf(row));
      if (live) return toBookmark(live);
      await bookmarksService.setDeleted(ctx.db, id, null, ctx.now);
      return toBookmark({ ...row, updatedAt: ctx.now });
    },
    entityId: (out) => out.id,
  }),
};
