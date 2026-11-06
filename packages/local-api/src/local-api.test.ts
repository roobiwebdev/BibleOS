import { verseIdFromCode } from "@starter/bible-core/verse-id";
import type { SqliteExecutor } from "@starter/local-db/executor";
import { runMigrations } from "@starter/local-db/migrate";
import { createNodeExecutor } from "@starter/local-db/node-executor";
import { beforeEach, describe, expect, it } from "vitest";

import { commands, createLocalApi, type LocalApi } from "./api";
import type { Command, CommandLogger, CommandResult, LogFields } from "./command";
import { parseNoteLinks } from "./links";
import { DEFAULT_PREFERENCES } from "./schemas";

const v = (code: string, chapter: number, verse = 0): number => verseIdFromCode(code, chapter, verse) ?? 0;
const range = (code: string, chapter: number, start: number, end = start) => ({
  start: v(code, chapter, start),
  end: v(code, chapter, end),
});

/** Unwraps a successful result, failing the test with the error otherwise. */
function ok<T>(result: CommandResult<T>): T {
  if (!result.ok) throw new Error(`Expected ok, got ${result.error.code}: ${result.error.message}`);
  return result.data;
}

async function freshDb(): Promise<SqliteExecutor> {
  const executor = createNodeExecutor();
  await runMigrations(executor);
  return executor;
}

let executor: SqliteExecutor;
let api: LocalApi;
let clock: number;
const logged: Array<{ message: string; fields?: LogFields }> = [];
const logger: CommandLogger = {
  info: (message, fields) => logged.push({ message, fields }),
  error: (message, fields) => logged.push({ message, fields }),
};
const run = <I, O>(command: Command<I, O>, input: I) => {
  clock += 1000;
  return api.run(command, input);
};

beforeEach(async () => {
  executor = await freshDb();
  clock = 1_760_000_000_000;
  logged.length = 0;
  api = createLocalApi({ executor, clock: () => clock, logger });
});

const changeLog = () => executor.all("SELECT entity, entity_id, action FROM change_log ORDER BY at, id");

/** Stores a preferences row as an older app saved it, before defaultsVersion existed (version 0). */
const storeOld = (value: Record<string, unknown>) =>
  executor.run("INSERT INTO settings (key, value, created_at, updated_at) VALUES ('app', ?, 1, 1)", [
    JSON.stringify(value),
  ]);

describe("defineCommand", () => {
  it("rejects invalid input with typed issues and writes nothing", async () => {
    const result = await run(commands.highlights.set, { range: { start: 5, end: 1 }, color: "promise" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_INPUT");
      expect(result.error.issues?.length).toBeGreaterThan(0);
    }
    expect(await changeLog()).toEqual([]);
  });

  it("writes change_log for mutations only", async () => {
    const h = ok(await run(commands.highlights.set, { range: range("JHN", 3, 16), color: "promise" }));
    ok(await run(commands.highlights.list, { range: range("JHN", 3, 1, 36) }));
    ok(await run(commands.settings.get, {}));
    expect(await changeLog()).toEqual([{ entity: "highlights", entity_id: h.id, action: "set" }]);
  });

  it("rolls back a failed mutation, including its change_log row", async () => {
    const result = await run(commands.collections.addItem, { collectionId: "missing", range: range("PSA", 23, 1) });
    expect(result.ok ? undefined : result.error.code).toBe("NOT_FOUND");
    expect(await changeLog()).toEqual([]);
    expect(await executor.all("SELECT id FROM collection_items")).toEqual([]);
  });

  it("never logs note contents", async () => {
    ok(await run(commands.notes.save, { kind: "note", title: "Secret title", body: "very private words", tags: [] }));
    await run(commands.notes.save, { kind: "note", title: "x".repeat(500), body: "also private", tags: [] });
    const text = JSON.stringify(logged);
    expect(text).not.toContain("private");
    expect(text).not.toContain("Secret");
    expect(logged.map((l) => l.message)).toEqual(["command ok", "command rejected"]);
  });
});

describe("highlights", () => {
  it("recolouring one verse splits a longer highlight (1 Cor 13:4-7, recolour 5)", async () => {
    const original = ok(await run(commands.highlights.set, { range: range("1CO", 13, 4, 7), color: "command" }));
    const recoloured = ok(await run(commands.highlights.set, { range: range("1CO", 13, 5), color: "promise" }));
    const list = ok(await run(commands.highlights.list, { range: range("1CO", 13, 1, 13) }));
    expect(list.map((h) => ({ start: h.start, end: h.end, color: h.color }))).toEqual([
      { ...range("1CO", 13, 4), color: "command" },
      { ...range("1CO", 13, 5), color: "promise" },
      { ...range("1CO", 13, 6, 7), color: "command" },
    ]);
    expect(list[0]?.id).toBe(original.id);
    expect(list[1]?.id).toBe(recoloured.id);
    expect(new Set(list.map((h) => h.id)).size).toBe(3);
  });

  it("remove clears a range and soft-deletes fully covered highlights", async () => {
    ok(await run(commands.highlights.set, { range: range("PSA", 91, 1, 2), color: "prayer" }));
    ok(await run(commands.highlights.set, { range: range("PSA", 91, 4), color: "prayer" }));
    ok(await run(commands.highlights.remove, { range: range("PSA", 91, 2, 4) }));
    const list = ok(await run(commands.highlights.list, { range: range("PSA", 91, 1, 16) }));
    expect(list.map((h) => [h.start, h.end])).toEqual([[v("PSA", 91, 1), v("PSA", 91, 1)]]);
    const deleted = await executor.all("SELECT id FROM highlights WHERE deleted_at IS NOT NULL");
    expect(deleted).toHaveLength(1);
  });
});

describe("notes", () => {
  it("parses [[reference]] and [[note title]] links", () => {
    const links = parseNoteLinks("See [[Romans 5:8]], [[ዮሐ 10፥11]], [[Love goes first]] and [[Romans 5:8]] again.");
    expect(links).toEqual([
      { label: "Romans 5:8", kind: "verse", range: range("ROM", 5, 8) },
      { label: "ዮሐ 10፥11", kind: "verse", range: range("JHN", 10, 11) },
      { label: "Love goes first", kind: "note", title: "Love goes first" },
    ]);
  });

  it("saves, updates and finds backlinks by passage and by note", async () => {
    const love = ok(
      await run(commands.notes.save, {
        kind: "note",
        title: "Love goes first",
        body: "Compare [[Romans 5:8]] and [[1 John 4:19]].",
        tags: ["Love", "gospel", "love "],
        anchors: [range("JHN", 3, 16)],
      }),
    );
    expect(love.tags).toEqual(["gospel", "love"]);
    expect(love.anchors).toEqual([range("JHN", 3, 16)]);

    // Links to a note by title resolve even when the target existed first or comes later.
    const hope = ok(
      await run(commands.notes.save, {
        kind: "note",
        title: "Hope",
        body: "Builds on [[love goes first]] and [[Later note]].",
      }),
    );
    const later = ok(await run(commands.notes.save, { kind: "journal", title: "Later note", body: "Written after." }));

    const toRomans = ok(await run(commands.notes.backlinks, { range: range("ROM", 5, 1, 11) }));
    expect(toRomans.map((n) => n.id)).toEqual([love.id]);
    expect(ok(await run(commands.notes.backlinks, { noteId: love.id })).map((n) => n.id)).toEqual([hope.id]);
    expect(ok(await run(commands.notes.backlinks, { noteId: later.id })).map((n) => n.id)).toEqual([hope.id]);

    // Editing replaces the links: Romans is gone, so the backlink disappears.
    const edited = ok(
      await run(commands.notes.save, {
        id: love.id,
        kind: "note",
        title: "Love goes first",
        body: "Only [[1 John 4:19]] now.",
      }),
    );
    expect(edited.createdAt).toBe(love.createdAt);
    expect(edited.updatedAt).toBeGreaterThan(love.updatedAt);
    expect(ok(await run(commands.notes.backlinks, { range: range("ROM", 5, 8) }))).toEqual([]);
    expect(ok(await run(commands.notes.backlinks, { range: range("1JN", 4, 19) })).map((n) => n.id)).toEqual([love.id]);
  });

  it("lists with kind, tag, normalized text and anchored-range filters", async () => {
    const shepherd = ok(
      await run(commands.notes.save, {
        kind: "note",
        title: "እረኛዬ",
        body: "እግዚአብሔር እረኛዬ ነው። ኃጢአት",
        tags: ["trust"],
        anchors: [range("PSA", 23, 1, 4)],
      }),
    );
    const journal = ok(
      await run(commands.notes.save, {
        kind: "journal",
        title: "Psalm 91 before the exam",
        body: '"Under his wings" stayed with me.',
        tags: ["journal"],
        anchors: [range("PSA", 91, 4)],
      }),
    );
    const ids = async (input: Parameters<typeof commands.notes.list.call>[1]) =>
      ok(await run(commands.notes.list, input)).map((n) => n.id);

    expect(await ids({ kind: "journal" })).toEqual([journal.id]);
    expect(await ids({ tag: "Trust" })).toEqual([shepherd.id]);
    // Homophone folding: ሀጢአት finds ኃጢአት.
    expect(await ids({ query: "ሀጢአት" })).toEqual([shepherd.id]);
    expect(await ids({ query: "UNDER his" })).toEqual([journal.id]);
    expect(await ids({ anchoredIn: range("PSA", 23, 3) })).toEqual([shepherd.id]);
    expect(await ids({ anchoredIn: range("PSA", 24, 1) })).toEqual([]);
    expect(await ids({})).toEqual([journal.id, shepherd.id]);
  });

  it("soft-deletes and restores a note (undo)", async () => {
    const note = ok(await run(commands.notes.save, { kind: "note", title: "Undo me", body: "[[Genesis 1:1]]" }));
    ok(await run(commands.notes.delete, { id: note.id }));
    expect(ok(await run(commands.notes.list, {}))).toEqual([]);
    expect(ok(await run(commands.notes.backlinks, { range: range("GEN", 1, 1) }))).toEqual([]);
    const trashed = ok(await run(commands.notes.list, { includeDeleted: true }));
    expect(trashed[0]?.deletedAt).not.toBeNull();

    const edit = await run(commands.notes.save, { id: note.id, kind: "note", title: "x", body: "" });
    expect(edit.ok ? undefined : edit.error.code).toBe("CONFLICT");

    ok(await run(commands.notes.restore, { id: note.id }));
    const back = ok(await run(commands.notes.get, { id: note.id }));
    expect(back.deletedAt).toBeNull();
    expect(back.title).toBe("Undo me");
    expect(ok(await run(commands.notes.backlinks, { range: range("GEN", 1, 1) })).map((n) => n.id)).toEqual([note.id]);
  });

  it("rejects oversize input and unknown ids", async () => {
    const big = await run(commands.notes.save, { kind: "note", title: "t", body: "x".repeat(100_001) });
    expect(big.ok ? undefined : big.error.code).toBe("INVALID_INPUT");
    const missing = await run(commands.notes.delete, { id: "nope" });
    expect(missing.ok ? undefined : missing.error.code).toBe("NOT_FOUND");
  });
});

describe("collections", () => {
  it("creates, adds once, removes and lists", async () => {
    const comfort = ok(await run(commands.collections.create, { name: " Comfort ", first: range("PSA", 23, 1, 6) }));
    expect(comfort.name).toBe("Comfort");
    const first = ok(
      await run(commands.collections.addItem, { collectionId: comfort.id, range: range("ROM", 8, 38, 39) }),
    );
    const again = ok(
      await run(commands.collections.addItem, { collectionId: comfort.id, range: range("ROM", 8, 38, 39) }),
    );
    expect(again.id).toBe(first.id);
    ok(await run(commands.collections.create, { name: "Memorize" }));
    expect(
      ok(await run(commands.collections.removeItem, { collectionId: comfort.id, range: range("PSA", 23, 1, 6) })),
    ).toEqual({
      removed: true,
    });
    // Re-adding a removed passage works despite the soft-deleted row (partial unique index).
    ok(await run(commands.collections.addItem, { collectionId: comfort.id, range: range("PSA", 23, 1, 6) }));

    const list = ok(await run(commands.collections.list, {}));
    expect(list.map((c) => c.name)).toEqual(["Comfort", "Memorize"]);
    expect(list[0]?.items.map((i) => [i.start, i.end])).toEqual([
      [v("ROM", 8, 38), v("ROM", 8, 39)],
      [v("PSA", 23, 1), v("PSA", 23, 6)],
    ]);
    const blank = await run(commands.collections.create, { name: "   " });
    expect(blank.ok ? undefined : blank.error.code).toBe("INVALID_INPUT");
  });
});

const session = (localDay: string, minutes: number) => ({
  startedAt: clock,
  endedAt: clock + minutes * 60_000,
  focusedSeconds: minutes * 60,
  localDay,
  translationId: "en-bsb",
  vid: v("JHN", 3, 1),
});

describe("reading", () => {
  it("records sessions and summarizes minutes, streak and chapters", async () => {
    ok(await run(commands.reading.recordSession, session("2026-10-30", 10)));
    ok(await run(commands.reading.recordSession, session("2026-10-31", 5)));
    ok(await run(commands.reading.recordSession, session("2026-10-31", 7)));
    ok(await run(commands.reading.recordSession, session("2026-11-02", 20)));
    ok(await run(commands.reading.markChapterRead, { chapterVid: v("JHN", 3) }));
    const again = ok(await run(commands.reading.markChapterRead, { chapterVid: v("ROM", 8) }));
    expect(again.times).toBe(1);
    expect(ok(await run(commands.reading.markChapterRead, { chapterVid: v("JHN", 3) })).times).toBe(2);

    const summary = ok(await run(commands.reading.summary, { today: "2026-11-02" }));
    expect(summary.minutesByDay).toEqual({ "2026-10-30": 10, "2026-10-31": 12, "2026-11-02": 20 });
    expect(summary.todayMinutes).toBe(20);
    // Nov 1 is missed but covered by the weekly grace day.
    expect(summary.streak).toBe(3);
    expect(summary.weekDots.at(-1)).toEqual({ day: "2026-11-02", state: "read" });
    expect(summary.goalMinutes).toBe(DEFAULT_PREFERENCES.goalMinutes);
    expect(summary.chaptersRead).toEqual([v("JHN", 3), v("ROM", 8)]);
    expect(summary.lastRead).toBe(v("JHN", 3));
  });

  it("rejects a bad day key, a verse that is not a chapter, and reversed times", async () => {
    const day = await run(commands.reading.recordSession, session("2/11/2026", 5));
    expect(day.ok).toBe(false);
    const chapter = await run(commands.reading.markChapterRead, { chapterVid: v("JHN", 3, 16) });
    expect(chapter.ok).toBe(false);
    const reversed = await run(commands.reading.recordSession, { ...session("2026-11-02", 5), endedAt: 0 });
    expect(reversed.ok).toBe(false);
  });
});

describe("settings", () => {
  it("returns defaults, merges patches and rejects invalid ones", async () => {
    expect(ok(await run(commands.settings.get, {}))).toEqual(DEFAULT_PREFERENCES);
    const next = ok(await run(commands.settings.set, { theme: "sepia", locale: "am", goalMinutes: 20 }));
    expect(next).toEqual({ ...DEFAULT_PREFERENCES, theme: "sepia", locale: "am", goalMinutes: 20 });
    expect(ok(await run(commands.settings.get, {}))).toEqual(next);

    expect((await run(commands.settings.set, { textSize: 99 })).ok).toBe(false);
    const unknownKey = await api.run(commands.settings.set, JSON.parse('{"colour":"red"}'));
    expect(unknownKey.ok).toBe(false);
    expect(await changeLog()).toEqual([{ entity: "settings", entity_id: "app", action: "set" }]);
  });

  it("repairs a corrupted stored field without losing the others", async () => {
    ok(await run(commands.settings.set, { accent: "teal" }));
    await executor.run("UPDATE settings SET value = json_set(value, '$.textSize', 'huge') WHERE key = 'app'");
    const prefs = ok(await run(commands.settings.get, {}));
    expect(prefs.accent).toBe("teal");
    expect(prefs.textSize).toBe(DEFAULT_PREFERENCES.textSize);
  });

  it("gives new readers the Amharic 2005 with the BSB beside it", async () => {
    const prefs = ok(await run(commands.settings.get, {}));
    expect(prefs).toMatchObject({ mainTranslation: "am-2005", parallelTranslation: "en-bsb", defaultsVersion: 1 });
  });

  it("switches an existing reader's main text to the 2005 once, keeping their old main beside it", async () => {
    await storeOld({ mainTranslation: "en-bsb", parallelTranslation: "am-1962-nt", accent: "plum", textSize: 22 });
    const migrated = ok(await run(commands.settings.get, {}));
    expect(migrated).toMatchObject({
      mainTranslation: "am-2005",
      parallelTranslation: "en-bsb",
      accent: "plum",
      textSize: 22,
      defaultsVersion: 1,
    });

    // Any later choice is saved with the current version and sticks.
    ok(await run(commands.settings.set, { mainTranslation: "en-kjv", parallelTranslation: "am-ulb" }));
    expect(ok(await run(commands.settings.get, {}))).toMatchObject({
      mainTranslation: "en-kjv",
      parallelTranslation: "am-ulb",
      defaultsVersion: 1,
    });
    // An unrelated change does not re-run the switch either.
    ok(await run(commands.settings.set, { accent: "teal" }));
    expect(ok(await run(commands.settings.get, {})).mainTranslation).toBe("en-kjv");
  });

  it("migrates a row that never saved a translation from the old default", async () => {
    await storeOld({ theme: "night" });
    expect(ok(await run(commands.settings.get, {}))).toMatchObject({
      theme: "night",
      mainTranslation: "am-2005",
      parallelTranslation: "en-bsb",
    });
  });

  it("never puts the 2005 on both sides", async () => {
    await storeOld({ mainTranslation: "am-ulb", parallelTranslation: "am-2005" });
    expect(ok(await run(commands.settings.get, {}))).toMatchObject({
      mainTranslation: "am-2005",
      parallelTranslation: "am-ulb",
    });
  });

  it("leaves rows already on the current version alone", async () => {
    await storeOld({ mainTranslation: "en-web", parallelTranslation: "am-ulb", defaultsVersion: 1 });
    expect(ok(await run(commands.settings.get, {}))).toMatchObject({
      mainTranslation: "en-web",
      parallelTranslation: "am-ulb",
    });
  });

  it("does not let a patch change the defaults version", async () => {
    const result = await api.run(commands.settings.set, JSON.parse('{"defaultsVersion":0}'));
    expect(result.ok).toBe(false);
  });
});

async function seed() {
  const love = ok(
    await run(commands.notes.save, {
      kind: "note",
      title: "Love goes first",
      body: "Compare [[Romans 5:8]].",
      tags: ["love", "gospel"],
      anchors: [range("JHN", 3, 16)],
    }),
  );
  ok(await run(commands.notes.save, { kind: "journal", title: "Gone", body: "[[Love goes first]]", tags: ["love"] }));
  const gone = ok(await run(commands.notes.list, { kind: "journal" }))[0];
  if (gone) ok(await run(commands.notes.delete, { id: gone.id }));
  ok(await run(commands.highlights.set, { range: range("1CO", 13, 4, 7), color: "command" }));
  ok(await run(commands.highlights.set, { range: range("1CO", 13, 5), color: "promise" }));
  const c = ok(await run(commands.collections.create, { name: "Comfort", first: range("PSA", 23, 1, 6) }));
  ok(await run(commands.collections.addItem, { collectionId: c.id, range: range("ROM", 8, 28) }));
  ok(await run(commands.collections.removeItem, { collectionId: c.id, range: range("ROM", 8, 28) }));
  ok(
    await run(commands.reading.recordSession, {
      startedAt: 1,
      endedAt: 2,
      focusedSeconds: 600,
      localDay: "2026-11-01",
      translationId: "en-bsb",
      vid: v("JHN", 3, 1),
    }),
  );
  ok(await run(commands.reading.markChapterRead, { chapterVid: v("JHN", 3) }));
  ok(await run(commands.settings.set, { theme: "night" }));
  return love;
}

describe("backup", () => {
  it("export → import into an empty database reproduces the data, and re-import changes nothing", async () => {
    await seed();
    const original = ok(await run(commands.backup.export, {}));
    const json = JSON.stringify(original);

    const target = createLocalApi({ executor: await freshDb(), clock: () => clock });
    const report = ok(await target.run(commands.backup.import, { json }));
    expect(report.changed.notes).toBe(2);
    const copy = ok(await target.run(commands.backup.export, {}));
    expect(copy.data).toEqual(original.data);

    const again = ok(await target.run(commands.backup.import, { json }));
    expect(Object.values(again.changed).every((n) => n === 0)).toBe(true);
    expect(ok(await target.run(commands.backup.export, {})).data).toEqual(original.data);
  });

  it("keeps newer local edits and merges tags by name", async () => {
    const love = await seed();
    const json = JSON.stringify(ok(await run(commands.backup.export, {})));
    ok(await run(commands.notes.save, { id: love.id, kind: "note", title: "Edited later", body: "", tags: ["love"] }));
    ok(await run(commands.backup.import, { json }));
    expect(ok(await run(commands.notes.get, { id: love.id })).title).toBe("Edited later");

    // A different device made the same tag name with another id: it maps onto the local tag.
    const other = createLocalApi({ executor: await freshDb(), clock: () => clock + 10_000 });
    ok(await other.run(commands.notes.save, { kind: "note", title: "Elsewhere", body: "", tags: ["love"] }));
    ok(await run(commands.backup.import, { json: JSON.stringify(ok(await other.run(commands.backup.export, {}))) }));
    expect(ok(await run(commands.notes.list, { tag: "love" })).map((n) => n.title)).toEqual([
      "Elsewhere",
      "Edited later",
    ]);
    expect(await executor.all("SELECT name FROM tags WHERE name = 'love'")).toHaveLength(1);
  });

  it("rejects malformed files before writing anything", async () => {
    const notJson = await run(commands.backup.import, { json: "{not json" });
    expect(notJson.ok ? undefined : notJson.error.code).toBe("INVALID_INPUT");
    const wrongShape = await run(commands.backup.import, {
      json: JSON.stringify({ format: "bibleos-study-backup", version: 1, exportedAt: 1, data: { notes: [{ id: 1 }] } }),
    });
    expect(wrongShape.ok).toBe(false);
    const orphan = await run(commands.backup.import, {
      json: JSON.stringify({
        format: "bibleos-study-backup",
        version: 1,
        exportedAt: 1,
        data: {
          noteAnchors: [
            { id: "a", noteId: "missing", startVid: v("JHN", 3, 16), endVid: v("JHN", 3, 16), sort: 0, createdAt: 1 },
          ],
        },
      }),
    });
    expect(orphan.ok ? undefined : orphan.error.code).toBe("INVALID_INPUT");
    expect(await changeLog()).toEqual([]);
  });
});
