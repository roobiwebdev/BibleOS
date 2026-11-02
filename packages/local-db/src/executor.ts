/**
 * SOURCE OF TRUTH KEYWORDS: SqliteExecutor, SqliteDriver, createExecutor, SqlValue, SqlRow, transaction, savepoint, executor interface
 * WHAT:  The only way queries reach a study database. A platform supplies a tiny SqliteDriver
 *        (run + all on one connection); createExecutor adds get, transactions with nested
 *        savepoints, and a queue so one transaction never interleaves with other statements.
 * WHY:   The same schema, migrations and commands must run on Node (tests), Tauri
 *        (the desktop's Rust bridge, sql.js in the browser preview) and later tablet/web. Keeping the per-platform part to two methods
 *        makes each adapter a few lines, and putting transaction ordering here means every
 *        platform gets the same guarantees.
 *        Rows are plain objects keyed by column name (what the Rust bridge, sql.js and node:sqlite return).
 *        Rule: a single SELECT must not return two columns with the same name (alias them),
 *        because object rows cannot hold both.
 *        Inside `transaction(fn)` use only the `tx` passed to fn; calling the outer executor
 *        there waits for the transaction to finish and deadlocks.
 * WHERE: node-executor.ts (tests), the desktop Tauri adapter, drizzle.ts, migrate.ts, local-api.
 */
export type SqlValue = string | number | bigint | Uint8Array | null;
export type SqlRow = Record<string, SqlValue>;

export interface RunResult {
  changes: number;
  lastInsertRowid: number | bigint | null;
}

/** What each platform implements: two calls on one connection, `?` placeholders. */
export interface SqliteDriver {
  run(sql: string, params: readonly SqlValue[]): Promise<RunResult>;
  all(sql: string, params: readonly SqlValue[]): Promise<SqlRow[]>;
  close?(): Promise<void>;
}

export interface SqliteExecutor {
  run(sql: string, params?: readonly SqlValue[]): Promise<RunResult>;
  all(sql: string, params?: readonly SqlValue[]): Promise<SqlRow[]>;
  get(sql: string, params?: readonly SqlValue[]): Promise<SqlRow | undefined>;
  /** Runs fn atomically. Nested calls (on the tx) become savepoints. */
  transaction<T>(fn: (tx: SqliteExecutor) => Promise<T>): Promise<T>;
  /** True for the executor handed to a transaction callback. */
  readonly inTransaction: boolean;
  close(): Promise<void>;
}

/**
 * SOURCE OF TRUTH KEYWORDS: createExecutor, executor queue, BEGIN IMMEDIATE, savepoint, mutex
 * WHAT:  Wraps a platform driver into a SqliteExecutor.
 * WHY:   See SqliteExecutor. Top-level calls run one at a time in arrival order.
 * WHERE: createNodeExecutor, the Tauri adapter.
 */
export function createExecutor(driver: SqliteDriver): SqliteExecutor {
  let queue: Promise<void> = Promise.resolve();
  const exclusive = <T>(task: () => Promise<T>): Promise<T> => {
    const result = queue.then(task);
    queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };

  const scoped = (depth: number): SqliteExecutor => {
    const guard = <T>(task: () => Promise<T>): Promise<T> => (depth === 0 ? exclusive(task) : task());
    const self: SqliteExecutor = {
      inTransaction: depth > 0,
      run: (sql, params = []) => guard(() => driver.run(sql, params)),
      all: (sql, params = []) => guard(() => driver.all(sql, params)),
      get: (sql, params = []) => guard(async () => (await driver.all(sql, params))[0]),
      transaction: (fn) =>
        guard(async () => {
          const inner = scoped(depth + 1);
          const savepoint = `sp${depth}`;
          await driver.run(depth === 0 ? "BEGIN IMMEDIATE" : `SAVEPOINT ${savepoint}`, []);
          try {
            const value = await fn(inner);
            await driver.run(depth === 0 ? "COMMIT" : `RELEASE SAVEPOINT ${savepoint}`, []);
            return value;
          } catch (err) {
            if (depth === 0) await driver.run("ROLLBACK", []);
            else {
              await driver.run(`ROLLBACK TO SAVEPOINT ${savepoint}`, []);
              await driver.run(`RELEASE SAVEPOINT ${savepoint}`, []);
            }
            throw err;
          }
        }),
      close: () => guard(async () => driver.close?.()),
    };
    return self;
  };
  return scoped(0);
}

/**
 * SOURCE OF TRUTH KEYWORDS: toNumberedPlaceholders, placeholder style, $1, plugin-sql params
 * WHAT:  Rewrites `?` placeholders to `$1, $2, …`, skipping quoted strings, identifiers and comments.
 * WHY:   Drizzle emits `?`; tauri-plugin-sql documents `$n`. Adapters that need numbered
 *        placeholders call this instead of writing their own scanner.
 * WHERE: the desktop Tauri driver (optional: sqlx's SQLite driver also accepts `?`).
 */
export function toNumberedPlaceholders(sql: string): string {
  let out = "";
  let n = 0;
  let i = 0;
  while (i < sql.length) {
    const ch = sql.charAt(i);
    if (ch === "'" || ch === '"' || ch === "`") {
      const end = closingQuote(sql, i, ch);
      out += sql.slice(i, end);
      i = end;
    } else if (ch === "-" && sql.charAt(i + 1) === "-") {
      const nl = sql.indexOf("\n", i);
      const end = nl === -1 ? sql.length : nl;
      out += sql.slice(i, end);
      i = end;
    } else if (ch === "/" && sql.charAt(i + 1) === "*") {
      const close = sql.indexOf("*/", i + 2);
      const end = close === -1 ? sql.length : close + 2;
      out += sql.slice(i, end);
      i = end;
    } else if (ch === "?") {
      n++;
      out += `$${n}`;
      i++;
    } else {
      out += ch;
      i++;
    }
  }
  return out;
}

/** Index just past the quote that closes the one at `start` (doubled quotes are escapes). */
function closingQuote(sql: string, start: number, quote: string): number {
  let i = start + 1;
  while (i < sql.length) {
    if (sql.charAt(i) === quote) {
      if (sql.charAt(i + 1) === quote) i += 2;
      else return i + 1;
    } else i++;
  }
  return sql.length;
}
