import type { VerseRange } from "@starter/bible-core/range";
import type { StudyDb } from "@starter/local-db/drizzle";
import { highlights, type HighlightRow } from "@starter/local-db/schema";
import { and, asc, eq, gte, isNull, lte } from "drizzle-orm";

/**
 * SOURCE OF TRUTH KEYWORDS: highlightsService, listOverlappingHighlights, insertHighlight, softDeleteHighlight
 * WHAT:  Queries on the highlights table. No rules: cutting and recolouring live in the command.
 * WHY:   Services hold reusable queries, commands hold decisions (CLAUDE.md routers/services).
 * WHERE: commands/highlights.ts, backup.
 */
export function listOverlapping(db: StudyDb, range: VerseRange): Promise<HighlightRow[]> {
  return db
    .select()
    .from(highlights)
    .where(and(isNull(highlights.deletedAt), lte(highlights.startVid, range.end), gte(highlights.endVid, range.start)))
    .orderBy(asc(highlights.startVid), asc(highlights.id));
}

export async function insert(db: StudyDb, row: typeof highlights.$inferInsert): Promise<void> {
  await db.insert(highlights).values(row);
}

export async function setRange(db: StudyDb, id: string, range: VerseRange, now: number): Promise<void> {
  // A trimmed highlight no longer matches its quoted words, so the sub-verse selection is cleared.
  await db
    .update(highlights)
    .set({ startVid: range.start, endVid: range.end, charStart: null, charEnd: null, quote: null, updatedAt: now })
    .where(eq(highlights.id, id));
}

export async function softDelete(db: StudyDb, id: string, now: number): Promise<void> {
  await db.update(highlights).set({ deletedAt: now, updatedAt: now }).where(eq(highlights.id, id));
}
