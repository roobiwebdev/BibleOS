import { normalizeForSearch } from "@starter/bible-core/normalize";
import type { VerseRange } from "@starter/bible-core/range";
import type { NoteRow } from "@starter/local-db/schema";
import { z } from "zod";

import { CommandError, defineCommand, type CommandContext } from "../command";
import { parseNoteLinks } from "../links";
import { isNoteKind, LIMITS, noteKindSchema, rangeOf, verseRangeSchema, type NoteKind } from "../schemas";
import * as notesService from "../services/notes";

/**
 * SOURCE OF TRUTH KEYWORDS: Note, NoteKind, toNotes, note shape, tags, anchors
 * WHAT:  A note as the UI sees it: title, Markdown body, tags, anchored verse ranges.
 * WHY:   Matches the desktop store's Note (plus deletedAt for the trash/undo state).
 * WHERE: notes commands, desktop notes rail, Study page, Today.
 */
export interface Note {
  id: string;
  kind: NoteKind;
  title: string;
  body: string;
  tags: string[];
  anchors: VerseRange[];
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

async function toNotes(ctx: CommandContext, rows: readonly NoteRow[]): Promise<Note[]> {
  const ids = rows.map((r) => r.id);
  const anchors = Map.groupBy(await notesService.anchorsOf(ctx.db, ids), (a) => a.noteId);
  const tagNames = Map.groupBy(await notesService.tagNamesOf(ctx.db, ids), (t) => t.noteId);
  return rows.map((r) => ({
    id: r.id,
    kind: isNoteKind(r.kind) ? r.kind : "note",
    title: r.title,
    body: r.bodyMd,
    tags: (tagNames.get(r.id) ?? []).map((t) => t.name),
    anchors: (anchors.get(r.id) ?? []).map(rangeOf),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    deletedAt: r.deletedAt,
  }));
}

async function noteOrThrow(ctx: CommandContext, id: string): Promise<NoteRow> {
  const row = await notesService.getById(ctx.db, id);
  if (!row) throw new CommandError("NOT_FOUND", "That note no longer exists.");
  return row;
}

/** Tags are trimmed, single-spaced and lowercased, and each appears once. */
export function cleanTags(input: readonly string[]): string[] {
  const out = input.map((t) => t.trim().replace(/\s+/gu, " ").toLowerCase()).filter((t) => t.length > 0);
  return [...new Set(out)];
}

const idSchema = z.string().min(1).max(64);

const saveInput = z.object({
  id: idSchema.optional(),
  kind: noteKindSchema,
  title: z.string().max(LIMITS.title),
  body: z.string().max(LIMITS.noteBody),
  tags: z.array(z.string().max(LIMITS.tagName)).max(LIMITS.tags).default([]),
  anchors: z.array(verseRangeSchema).max(LIMITS.anchors).default([]),
});

const listInput = z
  .object({
    kind: noteKindSchema.optional(),
    tag: z.string().max(LIMITS.tagName).optional(),
    query: z.string().max(LIMITS.title).optional(),
    anchoredIn: verseRangeSchema.optional(),
    includeDeleted: z.boolean().default(false),
    limit: z.number().int().min(1).max(LIMITS.listLimit).default(200),
  })
  .default({ includeDeleted: false, limit: 200 });

/**
 * SOURCE OF TRUTH KEYWORDS: notes.save, notes.delete, notes.restore, notes.list, notes.get, notes.backlinks, undo, note links
 * WHAT:  Note commands. `save` creates or updates a note and rebuilds its anchors, tags and
 *        `[[links]]`; `delete` soft-deletes and `restore` undoes it; `list` filters by kind, tag,
 *        text and anchored range; `backlinks` finds notes linking to a note or a passage.
 * WHY:   Undo is a restore of the same row (not a re-insert), so ids, links and sync history
 *        stay intact. Search matches the normalized copy, so Amharic spelling variants match.
 * WHERE: desktop notes rail, note editor, Study page, verse panel.
 */
export const noteCommands = {
  save: defineCommand({
    entity: "notes",
    action: "save",
    kind: "mutation",
    input: saveInput,
    run: async (ctx, input) => {
      const existing = input.id ? await noteOrThrow(ctx, input.id) : undefined;
      if (existing?.deletedAt != null) throw new CommandError("CONFLICT", "Restore the note before editing it.");
      const id = existing?.id ?? ctx.newId();
      const fields = {
        kind: input.kind,
        title: input.title.trim(),
        bodyMd: input.body,
        bodyNorm: normalizeForSearch(`${input.title} ${input.body}`),
        updatedAt: ctx.now,
      };
      if (existing) await notesService.update(ctx.db, id, fields);
      else await notesService.insert(ctx.db, { id, ...fields, createdAt: ctx.now });

      const parsed = parseNoteLinks(input.body);
      const titles = await notesService.idsByTitle(
        ctx.db,
        parsed.flatMap((l) => (l.kind === "note" ? [l.title] : [])),
        id,
      );
      await notesService.replaceChildren(
        ctx.db,
        id,
        {
          anchors: input.anchors,
          tagIds: await notesService.ensureTags(ctx.db, cleanTags(input.tags), ctx.now, ctx.newId),
          links: parsed.map((l) =>
            l.kind === "verse"
              ? { label: l.label, toNoteId: null, range: l.range }
              : { label: l.label, toNoteId: titles.get(l.title.toLowerCase()) ?? null, range: null },
          ),
        },
        ctx.now,
        ctx.newId,
      );
      const [note] = await toNotes(ctx, [await noteOrThrow(ctx, id)]);
      if (!note) throw new CommandError("INTERNAL", "The note could not be read back.");
      return note;
    },
    entityId: (note) => note.id,
  }),

  delete: defineCommand({
    entity: "notes",
    action: "delete",
    kind: "mutation",
    input: z.object({ id: idSchema }),
    run: async (ctx, { id }) => {
      const row = await noteOrThrow(ctx, id);
      if (row.deletedAt == null) await notesService.setDeleted(ctx.db, id, ctx.now, ctx.now);
      return { id };
    },
    entityId: (_out, input) => input.id,
  }),

  restore: defineCommand({
    entity: "notes",
    action: "restore",
    kind: "mutation",
    input: z.object({ id: idSchema }),
    run: async (ctx, { id }) => {
      const row = await noteOrThrow(ctx, id);
      if (row.deletedAt != null) await notesService.setDeleted(ctx.db, id, null, ctx.now);
      return { id };
    },
    entityId: (_out, input) => input.id,
  }),

  get: defineCommand({
    entity: "notes",
    action: "get",
    kind: "query",
    input: z.object({ id: idSchema }),
    run: async (ctx, { id }) => {
      const [note] = await toNotes(ctx, [await noteOrThrow(ctx, id)]);
      if (!note) throw new CommandError("NOT_FOUND", "That note no longer exists.");
      return note;
    },
  }),

  list: defineCommand({
    entity: "notes",
    action: "list",
    kind: "query",
    input: listInput,
    run: async (ctx, input) => {
      const query = input.query ? normalizeForSearch(input.query) : "";
      const rows = await notesService.list(ctx.db, {
        kind: input.kind,
        tag: input.tag ? cleanTags([input.tag])[0] : undefined,
        words: query ? query.split(" ") : undefined,
        anchoredIn: input.anchoredIn,
        includeDeleted: input.includeDeleted,
        limit: input.limit,
      });
      return toNotes(ctx, rows);
    },
  }),

  backlinks: defineCommand({
    entity: "notes",
    action: "backlinks",
    kind: "query",
    input: z.union([z.object({ noteId: idSchema }), z.object({ range: verseRangeSchema })]),
    run: async (ctx, input) => {
      let ids: string[];
      if ("noteId" in input) {
        const target = await noteOrThrow(ctx, input.noteId);
        ids = await notesService.linkingToNote(ctx.db, target.id, target.title);
      } else {
        ids = await notesService.linkingToRange(ctx.db, input.range);
      }
      return toNotes(ctx, await notesService.byIds(ctx.db, ids));
    },
  }),
};
