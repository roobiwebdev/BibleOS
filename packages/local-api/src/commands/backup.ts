import {
  bookmarks,
  chapterReads,
  collectionItems,
  collections,
  goals,
  highlights,
  noteAnchors,
  noteLinks,
  notes,
  noteTags,
  planProgress,
  plans,
  readingSessions,
  settings,
  tags,
} from "@starter/local-db/schema";
import { createSelectSchema } from "drizzle-orm/zod";
import { z } from "zod";

import { CommandError, defineCommand } from "../command";
import { dayKeySchema, highlightColorSchema, LIMITS, noteKindSchema } from "../schemas";
import * as backupService from "../services/backup";

export const BACKUP_FORMAT = "bibleos-study-backup";
export const BACKUP_VERSION = 1;

const rows = <T extends z.ZodType>(row: T) => z.array(row).max(LIMITS.backupRows).default([]);

/**
 * SOURCE OF TRUTH KEYWORDS: backupSchema, StudyBackup, BACKUP_FORMAT, BACKUP_VERSION, export file, import validation
 * WHAT:  The versioned JSON backup of all study data: every table's rows (soft-deleted rows
 *        included, so a restore keeps the trash and sync history). change_log is device-local
 *        and not exported.
 * WHY:   Row schemas are derived from the Drizzle tables (drizzle-orm/zod), so the file format
 *        follows the schema; text and enum columns get the same caps as the commands.
 * WHERE: backup.export / backup.import, desktop Settings → Backup.
 */
export const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.number().int(),
  data: z.object({
    highlights: rows(
      createSelectSchema(highlights, { color: highlightColorSchema, quote: (s) => s.max(LIMITS.noteBody) }),
    ),
    notes: rows(
      createSelectSchema(notes, {
        kind: noteKindSchema,
        title: (s) => s.max(LIMITS.title),
        bodyMd: (s) => s.max(LIMITS.noteBody),
        bodyNorm: (s) => s.max(LIMITS.noteBody * 2),
      }),
    ),
    noteAnchors: rows(createSelectSchema(noteAnchors)),
    tags: rows(createSelectSchema(tags, { name: (s) => s.min(1).max(LIMITS.tagName) })),
    noteTags: rows(createSelectSchema(noteTags)),
    noteLinks: rows(createSelectSchema(noteLinks, { label: (s) => s.max(200) })),
    collections: rows(createSelectSchema(collections, { name: (s) => s.min(1).max(LIMITS.collectionName) })),
    collectionItems: rows(createSelectSchema(collectionItems)),
    readingSessions: rows(createSelectSchema(readingSessions, { localDay: dayKeySchema })),
    chapterReads: rows(createSelectSchema(chapterReads)),
    goals: rows(createSelectSchema(goals)),
    settings: rows(createSelectSchema(settings, { key: (s) => s.max(64), value: (s) => s.max(100_000) })),
    // Added after the first release; older backups without them import as empty lists.
    plans: rows(
      createSelectSchema(plans, {
        planKey: (s) => s.max(64),
        title: (s) => s.max(LIMITS.title),
        definition: (s) => s.max(200_000),
        startedOn: dayKeySchema,
      }),
    ),
    planProgress: rows(createSelectSchema(planProgress)),
    bookmarks: rows(createSelectSchema(bookmarks, { label: (s) => s.max(LIMITS.title) })),
  }),
});
export type StudyBackup = z.output<typeof backupSchema>;
/** What backup.export returns (the same shape; enum columns are plain strings in the database). */
export interface StudyBackupFile {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: number;
  data: Awaited<ReturnType<typeof backupService.exportTables>>;
}

const backupJsonSchema = z
  .string()
  .max(LIMITS.backupChars, "The backup file is too large.")
  .transform((text, ctx) => {
    try {
      const value: unknown = JSON.parse(text);
      return value;
    } catch {
      ctx.addIssue({ code: "custom", message: "The backup file is not valid JSON." });
      return z.NEVER;
    }
  })
  .pipe(backupSchema);

export interface ImportReport {
  /** Rows inserted or replaced per table. */
  changed: Record<string, number>;
}

/** Every child row must point at a parent in the same file (a backup is always complete). */
function assertReferences(data: StudyBackup["data"]): void {
  const noteIds = new Set(data.notes.map((n) => n.id));
  const tagIds = new Set(data.tags.map((t) => t.id));
  const collectionIds = new Set(data.collections.map((c) => c.id));
  const planIds = new Set(data.plans.map((p) => p.id));
  const orphan =
    data.noteAnchors.some((a) => !noteIds.has(a.noteId)) ||
    data.noteTags.some((t) => !noteIds.has(t.noteId) || !tagIds.has(t.tagId)) ||
    data.noteLinks.some((l) => !noteIds.has(l.fromNoteId)) ||
    data.collectionItems.some((i) => !collectionIds.has(i.collectionId)) ||
    data.planProgress.some((p) => !planIds.has(p.planId));
  if (orphan)
    throw new CommandError(
      "INVALID_INPUT",
      "The backup file is incomplete: some rows point at missing notes, tags, collections or plans.",
    );
}

/**
 * SOURCE OF TRUTH KEYWORDS: backup.export, backup.import, restore, merge import, idempotent import
 * WHAT:  `export` returns the full versioned backup object. `import` takes the file's text,
 *        validates it (size, JSON, schema, references) before any write, then merges by id in
 *        one transaction: newer updated_at wins, note children follow their note, tags merge
 *        by name, chapter reads merge by chapter.
 * WHY:   A restore must never half-apply or clobber newer local work, and importing the same
 *        file twice must change nothing.
 * WHERE: desktop Settings → Backup (save file / open file).
 */
export const backupCommands = {
  export: defineCommand({
    entity: "backup",
    action: "export",
    kind: "query",
    input: z.object({}).default({}),
    run: async (ctx): Promise<StudyBackupFile> => ({
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: ctx.now,
      data: await backupService.exportTables(ctx.db),
    }),
  }),

  import: defineCommand({
    entity: "backup",
    action: "import",
    kind: "mutation",
    input: z.object({ json: backupJsonSchema }),
    run: async (ctx, { json }): Promise<ImportReport> => {
      const { data } = json;
      assertReferences(data);
      const changed: Record<string, number> = {};
      const upsert = async (
        name: string,
        table: Parameters<typeof backupService.upsertRows>[1],
        list: ReadonlyArray<Record<string, unknown>>,
        newerWins = true,
      ) => {
        changed[name] =
          (changed[name] ?? 0) + (await backupService.upsertRows(ctx.executor, table, list, { newerWins }));
      };

      // Tags merge by name: an imported tag whose name already exists maps onto the local tag.
      const tagIdMap = new Map<string, string>();
      const newTags = [];
      for (const tag of data.tags) {
        const local = await backupService.tagIdByName(ctx.db, tag.name);
        if (local && local !== tag.id) tagIdMap.set(tag.id, local);
        else newTags.push(tag);
      }
      await upsert("tags", tags, newTags);

      // Notes: last write wins; a note that wins brings its anchors, tags and links with it.
      const before = await backupService.existingNoteVersions(
        ctx.db,
        data.notes.map((n) => n.id),
      );
      const winners = new Set(
        data.notes.filter((n) => n.updatedAt > (before.get(n.id) ?? Number.NEGATIVE_INFINITY)).map((n) => n.id),
      );
      await upsert("notes", notes, data.notes);
      for (const id of winners) if (before.has(id)) await backupService.deleteNoteChildren(ctx.db, id);
      await upsert(
        "noteAnchors",
        noteAnchors,
        data.noteAnchors.filter((a) => winners.has(a.noteId)),
        false,
      );
      await upsert(
        "noteTags",
        noteTags,
        data.noteTags
          .filter((t) => winners.has(t.noteId))
          .map((t) => ({ ...t, tagId: tagIdMap.get(t.tagId) ?? t.tagId })),
        false,
      );
      await upsert(
        "noteLinks",
        noteLinks,
        data.noteLinks.filter((l) => winners.has(l.fromNoteId)),
        false,
      );

      await upsert("collections", collections, data.collections);
      await upsert("collectionItems", collectionItems, data.collectionItems);
      await upsert("highlights", highlights, data.highlights);
      await upsert("readingSessions", readingSessions, data.readingSessions);
      await upsert("goals", goals, data.goals);
      await upsert("plans", plans, data.plans);
      await upsert("planProgress", planProgress, data.planProgress);
      await upsert("bookmarks", bookmarks, data.bookmarks);
      changed.settings = await backupService.upsertRows(ctx.executor, settings, data.settings, {
        key: "key",
        newerWins: true,
      });
      let chapterChanges = 0;
      for (const row of data.chapterReads) chapterChanges += await backupService.mergeChapterRead(ctx.db, row);
      changed.chapterReads = chapterChanges;
      return { changed };
    },
  }),
};
