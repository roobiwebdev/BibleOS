import type { SqliteExecutor } from "./executor";
import { MIGRATIONS } from "./migrations";

export interface Migration {
  /** drizzle-kit folder name, e.g. "20261102151928_initial". Sorts in apply order. */
  id: string;
  sql: string;
}

export const MIGRATIONS_TABLE = "__study_migrations";

/**
 * SOURCE OF TRUTH KEYWORDS: runMigrations, migrator, schema upgrade, __study_migrations, idempotent migrations
 * WHAT:  Applies pending migrations through a SqliteExecutor. Each migration runs in its own
 *        transaction together with its bookkeeping row, so a failure leaves nothing half-done.
 * WHY:   The study database lives on the reader's machine and must upgrade itself on launch on
 *        every platform. Using the executor (not a platform migrator) keeps one code path;
 *        applied ids are tracked in a table, so running it again is a no-op.
 * WHERE: desktop startup (after opening study.sqlite), every test that needs a database.
 */
export async function runMigrations(
  executor: SqliteExecutor,
  migrations: readonly Migration[] = MIGRATIONS,
): Promise<string[]> {
  await executor.run(
    `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (id TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)`,
  );
  const rows = await executor.all(`SELECT id FROM ${MIGRATIONS_TABLE}`);
  const applied = new Set(rows.map((r) => String(r.id)));
  const ran: string[] = [];

  for (const migration of [...migrations].toSorted((a, b) => a.id.localeCompare(b.id))) {
    if (applied.has(migration.id)) continue;
    await executor.transaction(async (tx) => {
      for (const statement of splitStatements(migration.sql)) await tx.run(statement);
      await tx.run(`INSERT INTO ${MIGRATIONS_TABLE} (id, applied_at) VALUES (?, ?)`, [migration.id, Date.now()]);
    });
    ran.push(migration.id);
  }
  return ran;
}

/** drizzle-kit separates statements with `--> statement-breakpoint`. */
export function splitStatements(sql: string): string[] {
  return sql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
