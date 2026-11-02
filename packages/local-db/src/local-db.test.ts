import { join } from "node:path";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { createStudyDb } from "./drizzle";
import { toNumberedPlaceholders } from "./executor";
import { uuidv7, uuidv7Time } from "./ids";
import { MIGRATIONS_TABLE, runMigrations } from "./migrate";
import { readMigrationFolder } from "./migration-files";
import { MIGRATIONS } from "./migrations";
import { createNodeExecutor } from "./node-executor";
import { highlights } from "./schema";

const STUDY_TABLES = [
  "change_log",
  "chapter_reads",
  "collection_items",
  "collections",
  "goals",
  "highlights",
  "note_anchors",
  "note_links",
  "note_tags",
  "notes",
  "reading_sessions",
  "settings",
  "tags",
];

describe("migrations", () => {
  it("bundle matches the drizzle-kit SQL files (run db:bundle if this fails)", () => {
    const folder = join(import.meta.dirname, "..", "migrations");
    expect(MIGRATIONS).toEqual(readMigrationFolder(folder));
  });

  it("apply cleanly to an empty database and are idempotent", async () => {
    const db = createNodeExecutor();
    const first = await runMigrations(db);
    expect(first).toEqual(MIGRATIONS.map((m) => m.id));
    const tables = await db.all("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name");
    expect(tables.map((t) => t.name)).toEqual(expect.arrayContaining([...STUDY_TABLES, MIGRATIONS_TABLE]));
    expect(await runMigrations(db)).toEqual([]);
    const applied = await db.all(`SELECT id FROM ${MIGRATIONS_TABLE}`);
    expect(applied).toHaveLength(MIGRATIONS.length);
  });

  it("rolls back a failing migration completely", async () => {
    const db = createNodeExecutor();
    await expect(
      runMigrations(db, [{ id: "0001_bad", sql: "CREATE TABLE a (x int);--> statement-breakpoint\nNOT SQL" }]),
    ).rejects.toThrow();
    expect(await db.all("SELECT name FROM sqlite_master WHERE name = 'a'")).toEqual([]);
    expect(await db.all(`SELECT id FROM ${MIGRATIONS_TABLE}`)).toEqual([]);
  });
});

describe("executor", () => {
  it("commits, rolls back and nests savepoints", async () => {
    const db = createNodeExecutor();
    await db.run("CREATE TABLE t (v INTEGER)");
    await db.transaction(async (tx) => {
      await tx.run("INSERT INTO t VALUES (1)");
      await tx
        .transaction(async (inner) => {
          await inner.run("INSERT INTO t VALUES (2)");
          throw new Error("inner fails");
        })
        .catch(() => undefined);
    });
    await db
      .transaction(async (tx) => {
        await tx.run("INSERT INTO t VALUES (3)");
        throw new Error("outer fails");
      })
      .catch(() => undefined);
    expect((await db.all("SELECT v FROM t")).map((r) => r.v)).toEqual([1]);
  });

  it("keeps concurrent statements out of an open transaction", async () => {
    const db = createNodeExecutor();
    await db.run("CREATE TABLE t (v INTEGER)");
    const tx = db.transaction(async (t) => {
      await t.run("INSERT INTO t VALUES (1)");
      await new Promise((resolve) => setTimeout(resolve, 5));
      throw new Error("rollback");
    });
    const outside = db.run("INSERT INTO t VALUES (2)");
    await expect(tx).rejects.toThrow("rollback");
    await outside;
    expect((await db.all("SELECT v FROM t")).map((r) => r.v)).toEqual([2]);
  });

  it("rewrites placeholders outside quotes and comments", () => {
    expect(toNumberedPlaceholders("select ? , '?' , \"a?\" -- ?\n, ? /* ? */")).toBe(
      "select $1 , '?' , \"a?\" -- ?\n, $2 /* ? */",
    );
  });
});

describe("drizzle bridge", () => {
  it("inserts and selects typed rows through the executor", async () => {
    const executor = createNodeExecutor();
    await runMigrations(executor);
    const db = createStudyDb(executor);
    const id = uuidv7();
    await db
      .insert(highlights)
      .values({ id, startVid: 43003016, endVid: 43003016, color: "promise", createdAt: 1, updatedAt: 1 });
    const rows = await db.select().from(highlights).where(eq(highlights.id, id));
    expect(rows).toEqual([
      {
        id,
        startVid: 43003016,
        endVid: 43003016,
        color: "promise",
        createdAt: 1,
        updatedAt: 1,
        deletedAt: null,
        charStart: null,
        charEnd: null,
        quote: null,
      },
    ]);
  });
});

describe("uuidv7", () => {
  it("is a v7 UUID that sorts by creation order and encodes the time", () => {
    // Ahead of any id made earlier in this process, since ids never go back in time.
    const now = Date.now() + 60_000;
    const ids = Array.from({ length: 50 }, () => uuidv7(now));
    expect(ids[0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(ids.toSorted()).toEqual(ids);
    expect(new Set(ids).size).toBe(50);
    expect(uuidv7Time(ids[0] ?? "")).toBe(now);
  });
});
