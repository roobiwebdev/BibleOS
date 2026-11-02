# @starter/local-db

The study database (`study.sqlite`) for BibleOS: Drizzle SQLite schema, migrations, and the
executor interface every query goes through.

| File                   | What                                                                                    |
| ---------------------- | --------------------------------------------------------------------------------------- |
| `src/schema.ts`        | Tables. VerseIds for passages, UUIDv7 ids, epoch-ms timestamps, soft delete             |
| `src/executor.ts`      | `SqliteDriver` (per platform) → `createExecutor` → `SqliteExecutor` (queue, savepoints) |
| `src/node-executor.ts` | `node:sqlite` driver for tests and Node tooling. Never import it in the app bundle      |
| `src/drizzle.ts`       | `createStudyDb(executor)`: Drizzle `sqlite-proxy` on top of an executor                 |
| `src/migrate.ts`       | `runMigrations(executor)`: applies bundled migrations, tracked in `__study_migrations`  |
| `src/migrations.ts`    | Generated bundle of `migrations/*/migration.sql`. Do not edit                           |
| `src/ids.ts`           | `uuidv7()`                                                                              |

## Changing the schema

1. Edit `src/schema.ts`.
2. `pnpm --filter @starter/local-db db:generate` (drizzle-kit generate, then re-bundle).
3. Review the SQL and commit the migration folder together with `src/migrations.ts`.
   A test fails if the bundle and the SQL files disagree.

## Drizzle version

Pinned to `1.0.0-rc.4` through the workspace catalog. rc.5 reworked `sqlite-proxy`, so upgrade
on purpose and re-check `src/drizzle.ts`. Known limits of the rc.4 proxy driver:

- `.get()` with no matching row cannot be expressed by the callback type, so `createStudyDb`
  throws. Use `.all()` and take the first row.
- Relational queries (`db.query.*`) use object mode, which the proxy does not support.
- Rows are mapped by column position. A single SELECT must not return two columns with the
  same name; alias them.

## Wiring a platform (Tauri)

A platform supplies a `SqliteDriver`: `run(sql, params)` and `all(sql, params)` on **one
connection**. For `tauri-plugin-sql`:

```ts
const db = await Database.load("sqlite:study.sqlite");
const executor = createExecutor({
  run: async (sql, params) => {
    const r = await db.execute(sql, [...params]);
    return { changes: r.rowsAffected, lastInsertRowid: r.lastInsertId ?? null };
  },
  all: (sql, params) => db.select(sql, [...params]), // validate/narrow rows to SqlRow
  close: async () => void (await db.close()),
});
await runMigrations(executor);
```

`?` placeholders work with sqlx's SQLite driver; if numbered ones are needed, wrap `sql` in
`toNumberedPlaceholders`. Transactions are `BEGIN IMMEDIATE … COMMIT` statements, so the
plugin must send every statement over the same SQLite connection (pool of one), otherwise a
transaction can be split across connections.
