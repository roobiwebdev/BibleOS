import type { StudyDb } from "@starter/local-db/drizzle";
import { toSqlValue } from "@starter/local-db/drizzle";
import type { SqliteExecutor } from "@starter/local-db/executor";
import {
  bookmarks,
  chapterReads,
  collectionItems,
  collections,
  goals,
  highlights,
  noteAnchors,
  noteLinks,
  noteTags,
  notes,
  planProgress,
  plans,
  readingSessions,
  settings,
  tags,
  type ChapterReadRow,
} from "@starter/local-db/schema";
import { asc, eq, getTableColumns, getTableName, inArray, type Table } from "drizzle-orm";

/**
 * SOURCE OF TRUTH KEYWORDS: backupService, exportTables, upsertRows, last write wins, ON CONFLICT, merge by id
 * WHAT:  Reads every study table for export, and writes imported rows with SQLite upserts.
 * WHY:   Import merges by primary key. Syncable rows use last-write-wins on updated_at, so
 *        re-importing the same file changes nothing (idempotent) and a newer local edit is
 *        never overwritten by an older backup. A trailing `ON CONFLICT DO NOTHING` skips rows
 *        that would break another unique rule (e.g. the same passage twice in one collection).
 *        Built from the Drizzle table definitions, so new columns are picked up automatically.
 * WHERE: commands/backup.ts.
 */
export async function exportTables(db: StudyDb) {
  return {
    highlights: await db.select().from(highlights).orderBy(asc(highlights.id)),
    notes: await db.select().from(notes).orderBy(asc(notes.id)),
    noteAnchors: await db.select().from(noteAnchors).orderBy(asc(noteAnchors.id)),
    tags: await db.select().from(tags).orderBy(asc(tags.id)),
    noteTags: await db.select().from(noteTags).orderBy(asc(noteTags.noteId), asc(noteTags.tagId)),
    noteLinks: await db.select().from(noteLinks).orderBy(asc(noteLinks.id)),
    collections: await db.select().from(collections).orderBy(asc(collections.id)),
    collectionItems: await db.select().from(collectionItems).orderBy(asc(collectionItems.id)),
    readingSessions: await db.select().from(readingSessions).orderBy(asc(readingSessions.id)),
    chapterReads: await db.select().from(chapterReads).orderBy(asc(chapterReads.id)),
    goals: await db.select().from(goals).orderBy(asc(goals.id)),
    settings: await db.select().from(settings).orderBy(asc(settings.key)),
    plans: await db.select().from(plans).orderBy(asc(plans.id)),
    planProgress: await db.select().from(planProgress).orderBy(asc(planProgress.id)),
    bookmarks: await db.select().from(bookmarks).orderBy(asc(bookmarks.id)),
  };
}

const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;

/**
 * Upserts rows into `table`. With `newerWins`, an existing row (same `key`) is replaced only
 * when the incoming updated_at is later. Without it, existing rows are left alone.
 * Returns how many rows were inserted or replaced.
 */
export async function upsertRows(
  executor: SqliteExecutor,
  table: Table,
  rows: ReadonlyArray<Record<string, unknown>>,
  options: { key?: string; newerWins: boolean },
): Promise<number> {
  if (rows.length === 0) return 0;
  const columns = Object.entries(getTableColumns(table)).map(([prop, column]) => ({ prop, name: column.name }));
  const tableName = quote(getTableName(table));
  const names = columns.map((c) => quote(c.name));
  const key = quote(options.key ?? "id");
  const updates = columns
    .filter((c) => quote(c.name) !== key)
    .map((c) => `${quote(c.name)} = excluded.${quote(c.name)}`)
    .join(", ");
  const conflict = options.newerWins
    ? `ON CONFLICT(${key}) DO UPDATE SET ${updates} WHERE excluded."updated_at" > ${tableName}."updated_at" ON CONFLICT DO NOTHING`
    : "ON CONFLICT DO NOTHING";
  const statement = `INSERT INTO ${tableName} (${names.join(", ")}) VALUES (${names.map(() => "?").join(", ")}) ${conflict}`;

  let changed = 0;
  for (const row of rows) {
    const result = await executor.run(
      statement,
      columns.map((c) => toSqlValue(row[c.prop])),
    );
    changed += result.changes;
  }
  return changed;
}

/** updated_at of existing rows of `table` by id. */
export async function existingNoteVersions(db: StudyDb, ids: readonly string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  // Chunked to stay far below SQLite's bound-parameter limit.
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    const rows = await db
      .select({ id: notes.id, updatedAt: notes.updatedAt })
      .from(notes)
      .where(inArray(notes.id, chunk));
    for (const r of rows) map.set(r.id, r.updatedAt);
  }
  return map;
}

export async function deleteNoteChildren(db: StudyDb, noteId: string): Promise<void> {
  await db.delete(noteAnchors).where(eq(noteAnchors.noteId, noteId));
  await db.delete(noteTags).where(eq(noteTags.noteId, noteId));
  await db.delete(noteLinks).where(eq(noteLinks.fromNoteId, noteId));
}

export async function tagIdByName(db: StudyDb, name: string): Promise<string | undefined> {
  return (await db.select({ id: tags.id }).from(tags).where(eq(tags.name, name))).at(0)?.id;
}

/** Merges one chapter_reads row by chapter: earliest first read, latest last read, most reads. */
export async function mergeChapterRead(db: StudyDb, incoming: ChapterReadRow): Promise<number> {
  const existing = (await db.select().from(chapterReads).where(eq(chapterReads.chapterVid, incoming.chapterVid))).at(0);
  if (!existing) {
    await db.insert(chapterReads).values(incoming).onConflictDoNothing();
    return 1;
  }
  const merged = {
    firstReadAt: Math.min(existing.firstReadAt, incoming.firstReadAt),
    lastReadAt: Math.max(existing.lastReadAt, incoming.lastReadAt),
    times: Math.max(existing.times, incoming.times),
    updatedAt: Math.max(existing.updatedAt, incoming.updatedAt),
    deletedAt: incoming.updatedAt > existing.updatedAt ? incoming.deletedAt : existing.deletedAt,
  };
  const same =
    merged.firstReadAt === existing.firstReadAt &&
    merged.lastReadAt === existing.lastReadAt &&
    merged.times === existing.times &&
    merged.updatedAt === existing.updatedAt &&
    merged.deletedAt === existing.deletedAt;
  if (same) return 0;
  await db.update(chapterReads).set(merged).where(eq(chapterReads.id, existing.id));
  return 1;
}
