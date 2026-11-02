import type { VerseRange } from "@starter/bible-core/range";
import type { StudyDb } from "@starter/local-db/drizzle";
import { collectionItems, collections, type CollectionItemRow, type CollectionRow } from "@starter/local-db/schema";
import { and, asc, eq, isNull, max } from "drizzle-orm";

/**
 * SOURCE OF TRUTH KEYWORDS: collectionsService, liveCollection, findLiveItem, collection items query
 * WHAT:  Queries on collections and their items (live rows only unless stated).
 * WHY:   Services hold reusable queries, commands hold decisions (CLAUDE.md routers/services).
 * WHERE: commands/collections.ts.
 */
export async function getLive(db: StudyDb, id: string): Promise<CollectionRow | undefined> {
  return (
    await db
      .select()
      .from(collections)
      .where(and(eq(collections.id, id), isNull(collections.deletedAt)))
  ).at(0);
}

export async function nextSort(db: StudyDb): Promise<number> {
  const [row] = await db.select({ top: max(collections.sort) }).from(collections);
  return (row?.top ?? -1) + 1;
}

export async function nextItemSort(db: StudyDb, collectionId: string): Promise<number> {
  const [row] = await db
    .select({ top: max(collectionItems.sort) })
    .from(collectionItems)
    .where(eq(collectionItems.collectionId, collectionId));
  return (row?.top ?? -1) + 1;
}

export async function insert(db: StudyDb, row: typeof collections.$inferInsert): Promise<void> {
  await db.insert(collections).values(row);
}

export async function insertItem(db: StudyDb, row: typeof collectionItems.$inferInsert): Promise<void> {
  await db.insert(collectionItems).values(row);
}

export async function findLiveItem(
  db: StudyDb,
  collectionId: string,
  range: VerseRange,
): Promise<CollectionItemRow | undefined> {
  return (
    await db
      .select()
      .from(collectionItems)
      .where(
        and(
          eq(collectionItems.collectionId, collectionId),
          eq(collectionItems.startVid, range.start),
          eq(collectionItems.endVid, range.end),
          isNull(collectionItems.deletedAt),
        ),
      )
  ).at(0);
}

export async function softDeleteItem(db: StudyDb, id: string, now: number): Promise<void> {
  await db.update(collectionItems).set({ deletedAt: now, updatedAt: now }).where(eq(collectionItems.id, id));
}

export async function touch(db: StudyDb, id: string, now: number): Promise<void> {
  await db.update(collections).set({ updatedAt: now }).where(eq(collections.id, id));
}

export function listLive(db: StudyDb): Promise<CollectionRow[]> {
  return db
    .select()
    .from(collections)
    .where(isNull(collections.deletedAt))
    .orderBy(asc(collections.sort), asc(collections.id));
}

export function liveItems(db: StudyDb): Promise<CollectionItemRow[]> {
  return db
    .select()
    .from(collectionItems)
    .where(isNull(collectionItems.deletedAt))
    .orderBy(asc(collectionItems.collectionId), asc(collectionItems.sort));
}
