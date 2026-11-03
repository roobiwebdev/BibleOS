import { verseIdFromCode } from "@starter/bible-core/verse-id";
import type { SqliteExecutor } from "@starter/local-db/executor";
import { runMigrations } from "@starter/local-db/migrate";
import { createNodeExecutor } from "@starter/local-db/node-executor";
import { beforeEach, describe, expect, it } from "vitest";

import { commands, createLocalApi, type LocalApi } from "./api";
import type { Command, CommandResult } from "./command";

const v = (code: string, chapter: number, verse = 0): number => verseIdFromCode(code, chapter, verse) ?? 0;
const range = (code: string, chapter: number, start: number, end = start) => ({
  start: v(code, chapter, start),
  end: v(code, chapter, end),
});

function ok<T>(result: CommandResult<T>): T {
  if (!result.ok) throw new Error(`Expected ok, got ${result.error.code}: ${result.error.message}`);
  return result.data;
}

let executor: SqliteExecutor;
let api: LocalApi;
let clock: number;
const run = <I, O>(command: Command<I, O>, input: I) => {
  clock += 1000;
  return api.run(command, input);
};

beforeEach(async () => {
  executor = createNodeExecutor();
  await runMigrations(executor);
  clock = 1_760_000_000_000;
  api = createLocalApi({ executor, clock: () => clock });
});

const changeLog = () => executor.all("SELECT entity, entity_id, action FROM change_log ORDER BY at, id");

describe("bookmarks", () => {
  it("toggles an exact range on and off, leaving other ranges alone", async () => {
    const chapter = { start: v("JHN", 3), end: v("JHN", 3) + 999 };
    const added = ok(await run(commands.bookmarks.toggle, { range: range("JHN", 3, 16) }));
    expect(added.bookmarked).toBe(true);
    ok(await run(commands.bookmarks.toggle, { range: chapter, label: "  Nicodemus  " }));

    let list = ok(await run(commands.bookmarks.list, {}));
    expect(list.map((b) => [b.start, b.end, b.label])).toEqual([
      [chapter.start, chapter.end, "Nicodemus"],
      [v("JHN", 3, 16), v("JHN", 3, 16), ""],
    ]);

    const removed = ok(await run(commands.bookmarks.toggle, { range: range("JHN", 3, 16) }));
    expect(removed).toMatchObject({ bookmarked: false, bookmark: { id: added.bookmark.id } });
    list = ok(await run(commands.bookmarks.list, {}));
    expect(list.map((b) => b.start)).toEqual([chapter.start]);

    // Toggling again creates a fresh bookmark rather than reviving the old row.
    const again = ok(await run(commands.bookmarks.toggle, { range: range("JHN", 3, 16) }));
    expect(again.bookmark.id).not.toBe(added.bookmark.id);
  });

  it("renames, removes and restores the same row, with a change_log row each", async () => {
    const { bookmark } = ok(await run(commands.bookmarks.toggle, { range: range("PSA", 23, 1, 6) }));
    const renamed = ok(await run(commands.bookmarks.rename, { id: bookmark.id, label: "Shepherd" }));
    expect(renamed.label).toBe("Shepherd");

    ok(await run(commands.bookmarks.remove, { id: bookmark.id }));
    expect(ok(await run(commands.bookmarks.list, {}))).toEqual([]);
    const renameDeleted = await run(commands.bookmarks.rename, { id: bookmark.id, label: "x" });
    expect(renameDeleted.ok ? undefined : renameDeleted.error.code).toBe("CONFLICT");

    const restored = ok(await run(commands.bookmarks.restore, { id: bookmark.id }));
    expect(restored).toMatchObject({ id: bookmark.id, label: "Shepherd", ...range("PSA", 23, 1, 6) });
    expect(ok(await run(commands.bookmarks.list, {})).map((b) => b.id)).toEqual([bookmark.id]);

    expect(await changeLog()).toEqual(
      ["toggle", "rename", "remove", "restore"].map((action) => ({
        entity: "bookmarks",
        entity_id: bookmark.id,
        action,
      })),
    );
  });

  it("restoring after the passage was bookmarked again keeps a single bookmark", async () => {
    const first = ok(await run(commands.bookmarks.toggle, { range: range("ROM", 8, 28) })).bookmark;
    ok(await run(commands.bookmarks.remove, { id: first.id }));
    const second = ok(await run(commands.bookmarks.toggle, { range: range("ROM", 8, 28) })).bookmark;
    const restored = ok(await run(commands.bookmarks.restore, { id: first.id }));
    expect(restored.id).toBe(second.id);
    expect(ok(await run(commands.bookmarks.list, {})).length).toBe(1);
  });

  it("rejects bad input and unknown ids", async () => {
    const bad = await run(commands.bookmarks.toggle, { range: { start: 5, end: 1 } });
    expect(bad.ok ? undefined : bad.error.code).toBe("INVALID_INPUT");
    const long = await run(commands.bookmarks.toggle, { range: range("JHN", 1, 1), label: "x".repeat(201) });
    expect(long.ok ? undefined : long.error.code).toBe("INVALID_INPUT");
    const missing = await run(commands.bookmarks.remove, { id: "nope" });
    expect(missing.ok ? undefined : missing.error.code).toBe("NOT_FOUND");
    expect(await changeLog()).toEqual([]);
  });
});

describe("reading.history", () => {
  const session = (day: string, minutes: number, vid: number, furthest = vid, translationId = "en-bsb") => {
    const endedAt = clock + 60_000;
    return run(commands.reading.recordSession, {
      startedAt: endedAt - minutes * 60_000,
      endedAt,
      focusedSeconds: minutes * 60,
      localDay: day,
      translationId,
      vid,
      vidFurthest: furthest,
    });
  };

  it("groups sessions by day, newest first, with chapters touched and minutes", async () => {
    ok(await session("2026-10-30", 10, v("GEN", 1, 1)));
    ok(await session("2026-11-01", 12, v("JHN", 3, 1), v("JHN", 4, 10)));
    ok(await session("2026-11-01", 5, v("PSA", 23, 1), v("PSA", 23, 6), "am-1962-nt"));

    const history = ok(await run(commands.reading.history, {}));
    expect(history.days.map((d) => d.day)).toEqual(["2026-11-01", "2026-10-30"]);
    const [nov1] = history.days;
    expect(nov1?.minutes).toBe(17);
    expect(nov1?.chapters).toEqual([
      { chapterVid: v("JHN", 3), translationId: "en-bsb", minutes: 6 },
      { chapterVid: v("JHN", 4), translationId: "en-bsb", minutes: 6 },
      { chapterVid: v("PSA", 23), translationId: "am-1962-nt", minutes: 5 },
    ]);
    expect(nov1?.translations).toEqual(["en-bsb", "am-1962-nt"]);
    expect(history.nextBefore).toBeNull();
    expect(history.resume).toMatchObject({ vid: v("PSA", 23, 6), translationId: "am-1962-nt" });
  });

  it("pages through days with a before cursor and an empty end", async () => {
    for (let d = 1; d <= 5; d++) ok(await session(`2026-10-0${d}`, d, v("MRK", d, 1)));
    const first = ok(await run(commands.reading.history, { limit: 2 }));
    expect(first.days.map((d) => d.day)).toEqual(["2026-10-05", "2026-10-04"]);
    expect(first.nextBefore).toBe("2026-10-04");
    const second = ok(await run(commands.reading.history, { limit: 2, before: first.nextBefore ?? undefined }));
    expect(second.days.map((d) => d.day)).toEqual(["2026-10-03", "2026-10-02"]);
    expect(second.resume).toBeNull();
    const third = ok(await run(commands.reading.history, { limit: 2, before: second.nextBefore ?? undefined }));
    expect(third.days.map((d) => d.day)).toEqual(["2026-10-01"]);
    expect(third.nextBefore).toBeNull();
  });

  it("is empty for a new reader and leaves reading.summary unchanged", async () => {
    expect(ok(await run(commands.reading.history, {}))).toEqual({ days: [], nextBefore: null, resume: null });
    ok(await session("2026-11-01", 20, v("JHN", 1, 1)));
    const summary = ok(await run(commands.reading.summary, { today: "2026-11-01" }));
    expect(summary.todayMinutes).toBe(20);
  });
});

describe("reading.recentChapters", () => {
  it("lists distinct chapters newest first, paged by cursor even when timestamps tie", async () => {
    const chapters = [1, 2, 3, 4, 5].map((c) => v("JHN", c));
    for (const chapterVid of chapters) ok(await run(commands.reading.markChapterRead, { chapterVid }));
    // Reading John 2 again moves it to the front instead of listing it twice.
    ok(await run(commands.reading.markChapterRead, { chapterVid: v("JHN", 2) }));
    // Two more chapters marked within the same millisecond.
    const tied = createLocalApi({ executor, clock: () => clock + 5_000 });
    ok(await tied.run(commands.reading.markChapterRead, { chapterVid: v("ROM", 1) }));
    ok(await tied.run(commands.reading.markChapterRead, { chapterVid: v("ROM", 2) }));

    const seen: number[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 10; page++) {
      const res = ok(await run(commands.reading.recentChapters, { limit: 2, cursor }));
      seen.push(...res.items.map((i) => i.chapterVid));
      if (!res.nextCursor) break;
      cursor = res.nextCursor;
    }
    expect(seen.length).toBe(7);
    expect(new Set(seen).size).toBe(7);
    expect(seen.slice(2)).toEqual([v("JHN", 2), v("JHN", 5), v("JHN", 4), v("JHN", 3), v("JHN", 1)]);

    const bad = await run(commands.reading.recentChapters, { cursor: "drop table" });
    expect(bad.ok ? undefined : bad.error.code).toBe("INVALID_INPUT");
  });
});
