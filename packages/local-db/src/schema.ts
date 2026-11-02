import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * SOURCE OF TRUTH KEYWORDS: study schema, highlights, notes, noteAnchors, tags, noteLinks, collections, readingSessions, chapterReads, changeLog
 * WHAT:  The Drizzle SQLite schema of the reader's study database (study.sqlite).
 * WHY:   One schema for every platform (Tauri desktop, Node tests, later tablet/web), so
 *        commands and migrations are written once. Rules:
 *        - Verses are canonical integer VerseIds (bible-core verse-id.ts), never per translation,
 *          so annotations follow the reader across translations. Ranges are (start_vid, end_vid).
 *        - Every user-owned row has a UUIDv7 `id` plus created_at / updated_at / deleted_at
 *          (epoch ms, soft delete) so sync can be added without reshaping tables.
 *        - Note children (anchors, tags, links) are owned by their note: they are replaced
 *          whole on every save and the note's updated_at is their sync clock. They keep an id
 *          and created_at, but no soft delete of their own.
 *        - Highlight colours are a fixed key list in v1 (local-api HIGHLIGHT_COLORS); a
 *          `highlight_colors` table is deferred until custom colours exist, keeping the key.
 *        - Tags are a table + join (not JSON) so tag filters use an index and a rename is one row.
 * WHERE: packages/local-api services, migrations (drizzle-kit generate), backup export/import.
 */

/** Columns every syncable user row carries. Timestamps are epoch milliseconds. */
const syncColumns = () => ({
  id: text("id").primaryKey(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  deletedAt: integer("deleted_at"),
});

export const highlights = sqliteTable(
  "highlights",
  {
    ...syncColumns(),
    startVid: integer("start_vid").notNull(),
    endVid: integer("end_vid").notNull(),
    color: text("color").notNull(),
    // Optional sub-verse selection and the quoted words, for word-level highlights later.
    charStart: integer("char_start"),
    charEnd: integer("char_end"),
    quote: text("quote"),
  },
  (t) => [index("highlights_range_idx").on(t.startVid, t.endVid)],
);

export const notes = sqliteTable(
  "notes",
  {
    ...syncColumns(),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    bodyMd: text("body_md").notNull(),
    // normalizeForSearch(title + body): the search copy, never shown.
    bodyNorm: text("body_norm").notNull(),
  },
  (t) => [index("notes_kind_updated_idx").on(t.kind, t.updatedAt)],
);

export const noteAnchors = sqliteTable(
  "note_anchors",
  {
    id: text("id").primaryKey(),
    noteId: text("note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    startVid: integer("start_vid").notNull(),
    endVid: integer("end_vid").notNull(),
    sort: integer("sort").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("note_anchors_range_idx").on(t.startVid, t.endVid), index("note_anchors_note_idx").on(t.noteId)],
);

export const tags = sqliteTable(
  "tags",
  {
    ...syncColumns(),
    name: text("name").notNull(),
  },
  (t) => [uniqueIndex("tags_name_idx").on(t.name)],
);

export const noteTags = sqliteTable(
  "note_tags",
  {
    noteId: text("note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.noteId, t.tagId] }), index("note_tags_tag_idx").on(t.tagId)],
);

/** Derived from `[[…]]` in a note body on save: either a verse range or another note. */
export const noteLinks = sqliteTable(
  "note_links",
  {
    id: text("id").primaryKey(),
    fromNoteId: text("from_note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    toNoteId: text("to_note_id"),
    toStartVid: integer("to_start_vid"),
    toEndVid: integer("to_end_vid"),
    // The text inside the brackets, so the link can be re-resolved or shown as written.
    label: text("label").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    index("note_links_from_idx").on(t.fromNoteId),
    index("note_links_to_note_idx").on(t.toNoteId),
    index("note_links_to_range_idx").on(t.toStartVid, t.toEndVid),
  ],
);

export const collections = sqliteTable("collections", {
  ...syncColumns(),
  name: text("name").notNull(),
  sort: integer("sort").notNull(),
});

export const collectionItems = sqliteTable(
  "collection_items",
  {
    ...syncColumns(),
    collectionId: text("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    startVid: integer("start_vid").notNull(),
    endVid: integer("end_vid").notNull(),
    sort: integer("sort").notNull(),
  },
  (t) => [
    index("collection_items_collection_idx").on(t.collectionId, t.sort),
    // A passage appears once per collection among live items.
    uniqueIndex("collection_items_live_unique_idx")
      .on(t.collectionId, t.startVid, t.endVid)
      .where(sql`${t.deletedAt} is null`),
  ],
);

export const readingSessions = sqliteTable(
  "reading_sessions",
  {
    ...syncColumns(),
    startedAt: integer("started_at").notNull(),
    endedAt: integer("ended_at").notNull(),
    focusedSeconds: integer("focused_seconds").notNull(),
    translationId: text("translation_id").notNull(),
    vidStart: integer("vid_start").notNull(),
    vidFurthest: integer("vid_furthest").notNull(),
    // The reader's local calendar day ("YYYY-MM-DD"), fixed when the session is recorded.
    localDay: text("local_day").notNull(),
  },
  (t) => [index("reading_sessions_local_day_idx").on(t.localDay)],
);

/** One row per chapter ever read; chapter_vid is the chapter's VerseId (verse 0). */
export const chapterReads = sqliteTable(
  "chapter_reads",
  {
    ...syncColumns(),
    chapterVid: integer("chapter_vid").notNull(),
    firstReadAt: integer("first_read_at").notNull(),
    lastReadAt: integer("last_read_at").notNull(),
    times: integer("times").notNull(),
  },
  (t) => [uniqueIndex("chapter_reads_chapter_idx").on(t.chapterVid), index("chapter_reads_last_idx").on(t.lastReadAt)],
);

export const goals = sqliteTable("goals", {
  ...syncColumns(),
  kind: text("kind").notNull(),
  target: integer("target").notNull(),
  startsOn: text("starts_on").notNull(),
  endsOn: text("ends_on"),
});

/** Key → JSON value. The "app" key holds Preferences, validated by local-api's settings schema. */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

/** One row per mutation (the audit trail), later the sync outbox. Never holds note contents. */
export const changeLog = sqliteTable(
  "change_log",
  {
    id: text("id").primaryKey(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    action: text("action").notNull(),
    at: integer("at").notNull(),
  },
  (t) => [index("change_log_at_idx").on(t.at)],
);

export type HighlightRow = typeof highlights.$inferSelect;
export type NoteRow = typeof notes.$inferSelect;
export type NoteAnchorRow = typeof noteAnchors.$inferSelect;
export type TagRow = typeof tags.$inferSelect;
export type NoteTagRow = typeof noteTags.$inferSelect;
export type NoteLinkRow = typeof noteLinks.$inferSelect;
export type CollectionRow = typeof collections.$inferSelect;
export type CollectionItemRow = typeof collectionItems.$inferSelect;
export type ReadingSessionRow = typeof readingSessions.$inferSelect;
export type ChapterReadRow = typeof chapterReads.$inferSelect;
export type GoalRow = typeof goals.$inferSelect;
export type SettingRow = typeof settings.$inferSelect;
export type ChangeLogRow = typeof changeLog.$inferSelect;
