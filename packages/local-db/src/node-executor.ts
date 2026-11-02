import { DatabaseSync } from "node:sqlite";

import { createExecutor, type SqlRow, type SqliteExecutor } from "./executor";

/**
 * SOURCE OF TRUTH KEYWORDS: createNodeExecutor, node:sqlite, DatabaseSync, test database, in-memory SQLite
 * WHAT:  A SqliteExecutor over Node's built-in SQLite (Node 22.5+, stable API in Node 24).
 * WHY:   Commands and migrations are tested against real SQLite with the same schema the app
 *        uses, with no native addon to build. ":memory:" gives each test a fresh database.
 *        Node-only: never import this file from the desktop bundle.
 * WHERE: local-db and local-api tests, future Node scripts (backup tooling).
 */
export function createNodeExecutor(path = ":memory:"): SqliteExecutor {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON");
  if (path !== ":memory:") db.exec("PRAGMA journal_mode = WAL");

  return createExecutor({
    run: async (sql, params) => {
      const result = db.prepare(sql).run(...params);
      return { changes: Number(result.changes), lastInsertRowid: result.lastInsertRowid };
    },
    all: async (sql, params) => {
      const rows: SqlRow[] = db.prepare(sql).all(...params);
      return rows;
    },
    close: async () => db.close(),
  });
}
