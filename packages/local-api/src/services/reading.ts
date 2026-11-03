import type { StudyDb } from "@starter/local-db/drizzle";
import { chapterReads, readingSessions, type ChapterReadRow, type ReadingSessionRow } from "@starter/local-db/schema";
import { asc, desc, eq, gte, inArray, isNull, and, lt, or } from "drizzle-orm";

/**
 * SOURCE OF TRUTH KEYWORDS: readingService, sessionsSince, chapterRead upsert, chaptersRead, lastRead, sessionDays, recentChapterReads
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

/** Distinct local days with a live session, newest first, strictly before `before` when given. */
export async function sessionDays(db: StudyDb, before: string | undefined, limit: number): Promise<string[]> {
  const live = isNull(readingSessions.deletedAt);
  const rows = await db
    .selectDistinct({ localDay: readingSessions.localDay })
    .from(readingSessions)
    .where(before ? and(live, lt(readingSessions.localDay, before)) : live)
    .orderBy(desc(readingSessions.localDay))
    .limit(limit);
  return rows.map((r) => r.localDay);
}

/** Live sessions on the given days, oldest first. */
export function sessionsOnDays(db: StudyDb, days: string[]): Promise<ReadingSessionRow[]> {
  if (days.length === 0) return Promise.resolve([]);
  return db
    .select()
    .from(readingSessions)
    .where(and(isNull(readingSessions.deletedAt), inArray(readingSessions.localDay, days)))
    .orderBy(asc(readingSessions.startedAt), asc(readingSessions.id));
}

/** The most recently finished live session. */
export async function latestSession(db: StudyDb): Promise<ReadingSessionRow | undefined> {
  return (
    await db
      .select()
      .from(readingSessions)
      .where(isNull(readingSessions.deletedAt))
      .orderBy(desc(readingSessions.endedAt), desc(readingSessions.id))
      .limit(1)
  ).at(0);
}

/** Live chapter reads, most recent first, after a keyset cursor (lastReadAt, id). */
export function recentChapterReads(
  db: StudyDb,
  after: { lastReadAt: number; id: string } | undefined,
  limit: number,
): Promise<ChapterReadRow[]> {
  const live = isNull(chapterReads.deletedAt);
  return db
    .select()
    .from(chapterReads)
    .where(
      after
        ? and(
            live,
            or(
              lt(chapterReads.lastReadAt, after.lastReadAt),
              and(eq(chapterReads.lastReadAt, after.lastReadAt), lt(chapterReads.id, after.id)),
            ),
          )
        : live,
    )
    .orderBy(desc(chapterReads.lastReadAt), desc(chapterReads.id))
    .limit(limit);
}
