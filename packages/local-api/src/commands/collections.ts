import type { VerseRange } from "@starter/bible-core/range";
import { z } from "zod";

import { CommandError, defineCommand, type CommandContext } from "../command";
import { LIMITS, rangeOf, verseRangeSchema } from "../schemas";
import * as collectionsService from "../services/collections";

/**
 * SOURCE OF TRUTH KEYWORDS: Collection, CollectionItem, collection shape, verse set
 * WHAT:  A named set of passages, as the UI sees it.
 * WHY:   Matches the desktop store's Collection; items carry ids so one can be removed.
 * WHERE: collections commands, desktop Study page and "add to collection" menu.
 */
export interface CollectionItem extends VerseRange {
  id: string;
}
export interface Collection {
  id: string;
  name: string;
  items: CollectionItem[];
  createdAt: number;
  updatedAt: number;
}

async function liveOrThrow(ctx: CommandContext, id: string) {
  const row = await collectionsService.getLive(ctx.db, id);
  if (!row) throw new CommandError("NOT_FOUND", "That collection no longer exists.");
  return row;
}

async function addItem(ctx: CommandContext, collectionId: string, range: VerseRange): Promise<CollectionItem> {
  const existing = await collectionsService.findLiveItem(ctx.db, collectionId, range);
  if (existing) return { id: existing.id, ...rangeOf(existing) };
  const id = ctx.newId();
  await collectionsService.insertItem(ctx.db, {
    id,
    collectionId,
    startVid: range.start,
    endVid: range.end,
    sort: await collectionsService.nextItemSort(ctx.db, collectionId),
    createdAt: ctx.now,
    updatedAt: ctx.now,
  });
  await collectionsService.touch(ctx.db, collectionId, ctx.now);
  return { id, ...range };
}

const idSchema = z.string().min(1).max(64);

/**
 * SOURCE OF TRUTH KEYWORDS: collections.create, collections.addItem, collections.removeItem, collections.list
 * WHAT:  Collection commands. Adding a passage already in the collection is a no-op that
 *        returns the existing item; removing soft-deletes the item.
 * WHY:   Same behaviour as the preview store's addToCollection/createCollection.
 * WHERE: desktop Study page, verse menu.
 */
export const collectionCommands = {
  create: defineCommand({
    entity: "collections",
    action: "create",
    kind: "mutation",
    input: z.object({ name: z.string().trim().min(1).max(LIMITS.collectionName), first: verseRangeSchema.optional() }),
    run: async (ctx, { name, first }): Promise<Collection> => {
      const id = ctx.newId();
      await collectionsService.insert(ctx.db, {
        id,
        name,
        sort: await collectionsService.nextSort(ctx.db),
        createdAt: ctx.now,
        updatedAt: ctx.now,
      });
      const items = first ? [await addItem(ctx, id, first)] : [];
      return { id, name, items, createdAt: ctx.now, updatedAt: ctx.now };
    },
    entityId: (c) => c.id,
  }),

  addItem: defineCommand({
    entity: "collections",
    action: "addItem",
    kind: "mutation",
    input: z.object({ collectionId: idSchema, range: verseRangeSchema }),
    run: async (ctx, { collectionId, range }) => {
      await liveOrThrow(ctx, collectionId);
      return addItem(ctx, collectionId, range);
    },
    entityId: (_item, input) => input.collectionId,
  }),

  removeItem: defineCommand({
    entity: "collections",
    action: "removeItem",
    kind: "mutation",
    input: z.object({ collectionId: idSchema, range: verseRangeSchema }),
    run: async (ctx, { collectionId, range }) => {
      await liveOrThrow(ctx, collectionId);
      const item = await collectionsService.findLiveItem(ctx.db, collectionId, range);
      if (!item) return { removed: false };
      await collectionsService.softDeleteItem(ctx.db, item.id, ctx.now);
      await collectionsService.touch(ctx.db, collectionId, ctx.now);
      return { removed: true };
    },
    entityId: (_out, input) => input.collectionId,
  }),

  list: defineCommand({
    entity: "collections",
    action: "list",
    kind: "query",
    input: z.object({}).default({}),
    run: async (ctx): Promise<Collection[]> => {
      const items = Map.groupBy(await collectionsService.liveItems(ctx.db), (i) => i.collectionId);
      return (await collectionsService.listLive(ctx.db)).map((c) => ({
        id: c.id,
        name: c.name,
        items: (items.get(c.id) ?? []).map((i) => ({ id: i.id, ...rangeOf(i) })),
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      }));
    },
  }),
};
