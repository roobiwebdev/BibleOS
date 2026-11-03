import type { VerseRange } from "@starter/bible-core/range";
import type { StudyDb } from "@starter/local-db/drizzle";
import { bookmarks } from "@starter/local-db/schema";
import { and, desc, eq, isNull } from "drizzle-orm";

type BookmarkRow = typeof bookmarks.$inferSelect;

/**
 * SOURCE OF TRUTH KEYWORDS: bookmarksService, findLiveBookmark, listLiveBookmarks, bookmark soft delete
 * WHAT:  Queries on the bookmarks table (live rows only unless stated).
 * WHY:   Services hold reusable queries, commands hold decisions (CLAUDE.md routers/services).
 * WHERE: commands/bookmarks.ts.
 */
export async function get(db: StudyDb, id: string): Promise<BookmarkRow | undefined> {
  return (await db.select().from(bookmarks).where(eq(bookmarks.id, id))).at(0);
}

export async function findLive(db: StudyDb, range: VerseRange): Promise<BookmarkRow | undefined> {
  return (
    await db
      .select()
      .from(bookmarks)
      .where(and(eq(bookmarks.startVid, range.start), eq(bookmarks.endVid, range.end), isNull(bookmarks.deletedAt)))
  ).at(0);
}

export async function insert(db: StudyDb, row: typeof bookmarks.$inferInsert): Promise<void> {
  await db.insert(bookmarks).values(row);
}

export async function setLabel(db: StudyDb, id: string, label: string, now: number): Promise<void> {
  await db.update(bookmarks).set({ label, updatedAt: now }).where(eq(bookmarks.id, id));
}

export async function setDeleted(db: StudyDb, id: string, deletedAt: number | null, now: number): Promise<void> {
  await db.update(bookmarks).set({ deletedAt, updatedAt: now }).where(eq(bookmarks.id, id));
}

/** Live bookmarks, newest first. */
export function listLive(db: StudyDb, limit: number): Promise<BookmarkRow[]> {
  return db
    .select()
    .from(bookmarks)
    .where(isNull(bookmarks.deletedAt))
    .orderBy(desc(bookmarks.createdAt), desc(bookmarks.id))
    .limit(limit);
}
