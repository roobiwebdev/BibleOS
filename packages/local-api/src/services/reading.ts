import type { StudyDb } from "@starter/local-db/drizzle";
import { chapterReads, readingSessions, type ChapterReadRow } from "@starter/local-db/schema";
import { asc, desc, eq, gte, isNull, and } from "drizzle-orm";

/**
 * SOURCE OF TRUTH KEYWORDS: readingService, sessionsSince, chapterRead upsert, chaptersRead, lastRead
 * WHAT:  Queries on reading_sessions and chapter_reads.
 * WHY:   Services hold reusable queries, commands hold decisions (CLAUDE.md routers/services).
 *        Totals and streaks are computed from sessions by bible-core habits, never stored.
 * WHERE: commands/reading.ts.
 */
export async function insertSession(db: StudyDb, row: typeof readingSessions.$inferInsert): Promise<void> {
  await db.insert(readingSessions).values(row);
}

export function sessionsSince(
  db: StudyDb,
  firstDay: string,
): Promise<Array<{ localDay: string; focusedSeconds: number }>> {
  return db
    .select({ localDay: readingSessions.localDay, focusedSeconds: readingSessions.focusedSeconds })
    .from(readingSessions)
    .where(and(isNull(readingSessions.deletedAt), gte(readingSessions.localDay, firstDay)))
    .orderBy(asc(readingSessions.localDay));
}

export async function chapterRead(db: StudyDb, chapterVid: number): Promise<ChapterReadRow | undefined> {
  return (await db.select().from(chapterReads).where(eq(chapterReads.chapterVid, chapterVid))).at(0);
}

export async function insertChapterRead(db: StudyDb, row: typeof chapterReads.$inferInsert): Promise<void> {
  await db.insert(chapterReads).values(row);
}

export async function bumpChapterRead(db: StudyDb, row: ChapterReadRow, now: number): Promise<void> {
  await db
    .update(chapterReads)
    .set({ times: row.times + 1, lastReadAt: now, updatedAt: now, deletedAt: null })
    .where(eq(chapterReads.id, row.id));
}

/** Live chapters read, most recent first. */
export function chaptersRead(db: StudyDb): Promise<Array<{ chapterVid: number }>> {
  return db
    .select({ chapterVid: chapterReads.chapterVid })
    .from(chapterReads)
    .where(isNull(chapterReads.deletedAt))
    .orderBy(desc(chapterReads.lastReadAt), desc(chapterReads.id));
}
