import type { RunResult, SqlRow, SqlValue, SqliteDriver } from "@starter/local-db/executor";
import { invoke } from "@tauri-apps/api/core";

/**
 * SOURCE OF TRUTH KEYWORDS: tauriStudyDriver, browserStudyDriver, SqliteDriver, study database driver, sql.js
 * WHAT:  The two ways the study database is reached: the app's Rust bridge (one connection to
 *        study.sqlite in the app data folder) or, in the browser preview, an in-memory sql.js.
 * WHY:   local-db's executor needs run/all on one connection. Everything above this file
 *        (migrations, commands, screens) is identical on both.
 * WHERE: lib/data/local-api.ts only. Screens never import this.
 */
const toWire = (params: readonly SqlValue[]) =>
  params.map((p) => (typeof p === "bigint" ? Number(p) : p instanceof Uint8Array ? Array.from(p) : p));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function toSqlValue(value: unknown): SqlValue {
  if (value === null || typeof value === "string" || typeof value === "number") return value;
  if (Array.isArray(value)) return Uint8Array.from(value.filter((b): b is number => typeof b === "number"));
  throw new Error("Unexpected value type from the database");
}

/** Rows arrive as JSON from Rust; each value is checked before it reaches Drizzle. */
function toRows(raw: unknown): SqlRow[] {
  if (!Array.isArray(raw)) throw new Error("Unexpected database response");
  return raw.map((row) => {
    if (!isRecord(row)) throw new Error("Unexpected database row");
    return Object.fromEntries(Object.entries(row).map(([k, v]) => [k, toSqlValue(v)]));
  });
}

function toRunResult(raw: unknown): RunResult {
  if (!isRecord(raw) || typeof raw.changes !== "number") throw new Error("Unexpected database response");
  return {
    changes: raw.changes,
    lastInsertRowid: typeof raw.lastInsertRowid === "number" ? raw.lastInsertRowid : null,
  };
}

export const tauriStudyDriver: SqliteDriver = {
  run: async (sql, params) => toRunResult(await invoke("study_run", { sql, params: toWire(params) })),
  all: async (sql, params) => toRows(await invoke("study_all", { sql, params: toWire(params) })),
};

const bind = (params: readonly SqlValue[]) => params.map((p) => (typeof p === "bigint" ? Number(p) : p));

/** In-memory SQLite (WebAssembly) for the browser preview. Nothing persists past a reload. */
export async function browserStudyDriver(): Promise<SqliteDriver> {
  const [{ default: initSqlJs }, { default: wasmUrl }] = await Promise.all([
    import("sql.js"),
    import("sql.js/dist/sql-wasm.wasm?url"),
  ]);
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const db = new SQL.Database();
  db.run("PRAGMA foreign_keys = ON");
  return {
    run: async (sql, params) => {
      db.run(sql, bind(params));
      const id = db.exec("SELECT last_insert_rowid() AS id")[0]?.values[0]?.[0];
      return { changes: db.getRowsModified(), lastInsertRowid: typeof id === "number" ? id : null };
    },
    all: async (sql, params) => {
      const stmt = db.prepare(sql);
      try {
        stmt.bind(bind(params));
        const rows: SqlRow[] = [];
        while (stmt.step()) {
          rows.push(Object.fromEntries(Object.entries(stmt.getAsObject()).map(([k, v]) => [k, toSqlValue(v)])));
        }
        return rows;
      } finally {
        stmt.free();
      }
    },
    close: async () => db.close(),
  };
}
