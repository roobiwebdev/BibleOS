import { drizzle, type SqliteRemoteDatabase } from "drizzle-orm/sqlite-proxy";

import type { SqlValue, SqliteExecutor } from "./executor";

/**
 * SOURCE OF TRUTH KEYWORDS: createStudyDb, StudyDb, drizzle sqlite-proxy, ORM bridge, query builder
 * WHAT:  A Drizzle database (sqlite-proxy driver, drizzle-orm 1.0.0-rc.4) that sends every
 *        query through a SqliteExecutor. Build one per executor; inside a transaction build
 *        one on the `tx` executor.
 * WHY:   Typed queries on the shared schema without tying the ORM to a platform driver.
 *        rc.5 reworked sqlite-proxy, so drizzle is pinned to rc.4 (catalog) and this file is
 *        the only place that knows the proxy callback contract:
 *        - rows come back as positional arrays, in SELECT column order (Object.values of the
 *          executor's object rows; see the duplicate-column rule in executor.ts);
 *        - `.get()` with no matching row cannot be expressed in the rc.4 callback type, so it
 *          throws. Use `.all()` and take the first row instead (all local-api code does).
 *        - Relational `db.query.*` uses object mode, which the proxy driver does not support.
 * WHERE: packages/local-api (services and commands), migrate.ts does not need it.
 */
export type StudyDb = SqliteRemoteDatabase;

export function createStudyDb(executor: SqliteExecutor): StudyDb {
  return drizzle(async (sql, params, method) => {
    const values = params.map(toSqlValue);
    if (method === "run") {
      await executor.run(sql, values);
      return { rows: [] };
    }
    const rows = (await executor.all(sql, values)).map((row) => Object.values(row));
    if (method === "get") {
      const first = rows[0];
      if (!first) throw new Error("StudyDb: .get() found no row; use .all() and take the first row");
      return { rows: first };
    }
    return { rows };
  });
}

/** Narrows a Drizzle parameter to a value SQLite can bind. Booleans become 0/1. */
export function toSqlValue(value: unknown): SqlValue {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "bigint") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value instanceof Uint8Array) return value;
  if (value instanceof Date) return value.getTime();
  throw new TypeError(`Unsupported SQL parameter of type ${typeof value}`);
}
