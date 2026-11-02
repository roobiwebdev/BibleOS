import type { VerseRange } from "@starter/bible-core/range";
import type { StudyDb } from "@starter/local-db/drizzle";
import {
  noteAnchors,
  noteLinks,
  notes,
  noteTags,
  tags,
  type NoteAnchorRow,
  type NoteRow,
} from "@starter/local-db/schema";
import { and, asc, desc, eq, exists, gte, inArray, isNotNull, isNull, like, lte, or, sql, type SQL } from "drizzle-orm";

/**
 * SOURCE OF TRUTH KEYWORDS: notesService, listNotes, NoteFilters, ensureTags, replaceNoteChildren, backlinks query
 * WHAT:  Queries on notes and their owned rows (anchors, tags, links). No rules: link parsing,
 *        tag cleaning and undo live in commands/notes.ts.
 * WHY:   Services hold reusable queries, commands hold decisions (CLAUDE.md routers/services).
 *        Joins select distinct column names only (executor.ts duplicate-column rule).
 * WHERE: commands/notes.ts.
 */
export interface NoteFilters {
  kind?: string;
  tag?: string;
  /** Already normalized with normalizeForSearch and split into words. */
  words?: string[];
  anchoredIn?: VerseRange;
  includeDeleted?: boolean;
  limit: number;
}

export interface NoteChildren {
  anchors: VerseRange[];
  tagIds: string[];
  links: Array<{ label: string; toNoteId: string | null; range: VerseRange | null }>;
}

export async function getById(db: StudyDb, id: string): Promise<NoteRow | undefined> {
  return (await db.select().from(notes).where(eq(notes.id, id))).at(0);
}

export async function insert(db: StudyDb, row: typeof notes.$inferInsert): Promise<void> {
  await db.insert(notes).values(row);
}

export async function update(
  db: StudyDb,
  id: string,
  fields: Pick<NoteRow, "kind" | "title" | "bodyMd" | "bodyNorm" | "updatedAt">,
): Promise<void> {
  await db.update(notes).set(fields).where(eq(notes.id, id));
}

export async function setDeleted(db: StudyDb, id: string, deletedAt: number | null, now: number): Promise<void> {
  await db.update(notes).set({ deletedAt, updatedAt: now }).where(eq(notes.id, id));
}

/** Tag ids for names, creating missing tags. Names must already be cleaned. */
export async function ensureTags(
  db: StudyDb,
  names: readonly string[],
  now: number,
  newId: () => string,
): Promise<string[]> {
  if (names.length === 0) return [];
  const existing = await db
    .select({ id: tags.id, name: tags.name })
    .from(tags)
    .where(inArray(tags.name, [...names]));
  const byName = new Map(existing.map((t) => [t.name, t.id]));
  const ids: string[] = [];
  for (const name of names) {
    let id = byName.get(name);
    if (!id) {
      id = newId();
      await db.insert(tags).values({ id, name, createdAt: now, updatedAt: now });
      byName.set(name, id);
    }
    ids.push(id);
  }
  return ids;
}

/** Replaces a note's anchors, tags and links (they are owned by the note). */
export async function replaceChildren(
  db: StudyDb,
  noteId: string,
  children: NoteChildren,
  now: number,
  newId: () => string,
): Promise<void> {
  await db.delete(noteAnchors).where(eq(noteAnchors.noteId, noteId));
  await db.delete(noteTags).where(eq(noteTags.noteId, noteId));
  await db.delete(noteLinks).where(eq(noteLinks.fromNoteId, noteId));
  for (const [sort, a] of children.anchors.entries()) {
    await db
      .insert(noteAnchors)
      .values({ id: newId(), noteId, startVid: a.start, endVid: a.end, sort, createdAt: now });
  }
  for (const tagId of children.tagIds) await db.insert(noteTags).values({ noteId, tagId, createdAt: now });
  for (const link of children.links) {
    await db.insert(noteLinks).values({
      id: newId(),
      fromNoteId: noteId,
      toNoteId: link.toNoteId,
      toStartVid: link.range?.start ?? null,
      toEndVid: link.range?.end ?? null,
      label: link.label,
      createdAt: now,
    });
  }
}

/** Live notes whose title matches (case-insensitively), keyed by lowercased title. */
export async function idsByTitle(
  db: StudyDb,
  titles: readonly string[],
  excludeId: string,
): Promise<Map<string, string>> {
  if (titles.length === 0) return new Map();
  const lowered = [...new Set(titles.map((t) => t.toLowerCase()))];
  const rows = await db
    .select({ id: notes.id, title: notes.title })
    .from(notes)
    .where(and(isNull(notes.deletedAt), inArray(sql`lower(${notes.title})`, lowered)))
    .orderBy(asc(notes.createdAt));
  const map = new Map<string, string>();
  for (const r of rows) if (r.id !== excludeId && !map.has(r.title.toLowerCase())) map.set(r.title.toLowerCase(), r.id);
  return map;
}

export function list(db: StudyDb, f: NoteFilters): Promise<NoteRow[]> {
  const where: SQL[] = [];
  if (!f.includeDeleted) where.push(isNull(notes.deletedAt));
  if (f.kind) where.push(eq(notes.kind, f.kind));
  if (f.tag) {
    const tagged = db
      .select({ noteId: noteTags.noteId })
      .from(noteTags)
      .innerJoin(tags, eq(tags.id, noteTags.tagId))
      .where(eq(tags.name, f.tag));
    where.push(inArray(notes.id, tagged));
  }
  // normalizeForSearch strips punctuation, so the words can't carry LIKE wildcards.
  for (const word of f.words ?? []) where.push(like(notes.bodyNorm, `%${word}%`));
  if (f.anchoredIn) {
    const anchored = db
      .select({ one: sql`1` })
      .from(noteAnchors)
      .where(
        and(
          eq(noteAnchors.noteId, notes.id),
          lte(noteAnchors.startVid, f.anchoredIn.end),
          gte(noteAnchors.endVid, f.anchoredIn.start),
        ),
      );
    where.push(exists(anchored));
  }
  return db
    .select()
    .from(notes)
    .where(and(...where))
    .orderBy(desc(notes.updatedAt), desc(notes.id))
    .limit(f.limit);
}

export function anchorsOf(db: StudyDb, noteIds: readonly string[]): Promise<NoteAnchorRow[]> {
  if (noteIds.length === 0) return Promise.resolve([]);
  return db
    .select()
    .from(noteAnchors)
    .where(inArray(noteAnchors.noteId, [...noteIds]))
    .orderBy(asc(noteAnchors.noteId), asc(noteAnchors.sort));
}

export function tagNamesOf(db: StudyDb, noteIds: readonly string[]): Promise<Array<{ noteId: string; name: string }>> {
  if (noteIds.length === 0) return Promise.resolve([]);
  return db
    .select({ noteId: noteTags.noteId, name: tags.name })
    .from(noteTags)
    .innerJoin(tags, eq(tags.id, noteTags.tagId))
    .where(inArray(noteTags.noteId, [...noteIds]))
    .orderBy(asc(tags.name));
}

/** Ids of live notes linking to a note (by id, or by its title when the link was unresolved). */
export async function linkingToNote(db: StudyDb, noteId: string, title: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ fromNoteId: noteLinks.fromNoteId })
    .from(noteLinks)
    .innerJoin(notes, eq(notes.id, noteLinks.fromNoteId))
    .where(
      and(
        isNull(notes.deletedAt),
        or(
          eq(noteLinks.toNoteId, noteId),
          and(
            isNull(noteLinks.toNoteId),
            isNull(noteLinks.toStartVid),
            eq(sql`lower(${noteLinks.label})`, title.toLowerCase()),
          ),
        ),
      ),
    );
  return rows.map((r) => r.fromNoteId).filter((id) => id !== noteId);
}

/** Ids of live notes with a `[[reference]]` link overlapping the range. */
export async function linkingToRange(db: StudyDb, range: VerseRange): Promise<string[]> {
  const rows = await db
    .selectDistinct({ fromNoteId: noteLinks.fromNoteId })
    .from(noteLinks)
    .innerJoin(notes, eq(notes.id, noteLinks.fromNoteId))
    .where(
      and(
        isNull(notes.deletedAt),
        isNotNull(noteLinks.toStartVid),
        lte(noteLinks.toStartVid, range.end),
        gte(noteLinks.toEndVid, range.start),
      ),
    );
  return rows.map((r) => r.fromNoteId);
}

export function byIds(db: StudyDb, ids: readonly string[]): Promise<NoteRow[]> {
  if (ids.length === 0) return Promise.resolve([]);
  return db
    .select()
    .from(notes)
    .where(inArray(notes.id, [...ids]))
    .orderBy(desc(notes.updatedAt));
}
