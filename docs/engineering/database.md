# Database

Postgres with Drizzle ORM `1.0.0-rc.4` (pinned in `pnpm-workspace.yaml`). Everything database-shaped lives in `packages/db`.

| Path                                     | Holds                                                                                                       |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `packages/db/src/schema/auth.ts`         | Better Auth tables (`user`, `session`, `account`, `verification`) and `rate_limit`                          |
| `packages/db/src/schema/organization.ts` | `organization`, `member`, `invitation`                                                                      |
| `packages/db/src/schema/app.ts`          | `app_settings` (single row)                                                                                 |
| `packages/db/src/schema/content.ts`      | `notification`, `notification_recipient`, `post`, `feedback`, `waitlist_entry`, `subscription`, `audit_log` |
| `packages/db/src/schema/index.ts`        | re-exports every schema file                                                                                |
| `packages/db/src/relations.ts`           | Drizzle v2 relations (`defineRelations`) for `db.query.<table>.findMany({ with })`                          |
| `packages/db/src/index.ts`               | `createDb()`, `Database`, `DbTransaction`, `DbExecutor`, `schema`                                           |
| `packages/db/migrations/`                | generated SQL migrations, one folder per migration                                                          |
| `packages/db/drizzle.config.ts`          | drizzle-kit config                                                                                          |
| `packages/db/.env.schema`                | imports `NODE_ENV`, `DATABASE_URL` and `DATABASE_URL_DIRECT` from `apps/web/.env.schema`                    |

Because `packages/db/.env.schema` imports from the web app, migrations always target the same database as the app. You keep one `.env` file: `apps/web/.env`.

## Commands

| Command            | What it does                                                                                                                            | When                                                                     |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `pnpm db:generate` | `drizzle-kit generate`: compares the schema with the last snapshot and writes `packages/db/migrations/<timestamp>_<name>/migration.sql` | after every schema change                                                |
| `pnpm db:migrate`  | `drizzle-kit migrate`: applies pending migrations, recorded in the `drizzle` schema                                                     | locally, in CI, and against production on deploy                         |
| `pnpm db:push`     | `drizzle-kit push`: makes the database match the schema with no migration file                                                          | throwaway prototypes only. Never on a shared or production database.     |
| `pnpm db:seed`     | runs `apps/web/scripts/seed.ts`                                                                                                         | after migrating a new database. Safe to repeat.                          |
| `pnpm db:reset`    | drops the `public` and `drizzle` schemas, re-runs every migration, then seeds                                                           | to start a local database from zero. Refuses when `NODE_ENV=production`. |
| `pnpm db:studio`   | opens Drizzle Studio                                                                                                                    | to browse and edit data                                                  |

## Changing the schema

1. Edit the table in `packages/db/src/schema/*.ts`. A new file must be re-exported from `schema/index.ts`.
2. Update `relations.ts` if you added a foreign key you want to query with `with`.
3. `pnpm db:generate`.
4. **Read the generated SQL.** Look for unintended `DROP` statements and for `NOT NULL` columns added without a default to tables that already have rows.
5. `pnpm db:migrate`.
6. Commit the schema change and the migration folder together.

Conventions used by the existing tables:

- App tables use `text` primary keys with `$defaultFn(() => crypto.randomUUID())`. Better Auth tables get their IDs from Better Auth.
- Column names are `snake_case` in SQL, `camelCase` in TypeScript (`text("user_id")` → `userId`).
- `createdAt` uses `.defaultNow()`. `updatedAt` adds `.$onUpdate(() => new Date())`.
- Foreign keys to `user` use `onDelete: "cascade"` for owned rows, or `"set null"` where history must survive (as in `audit_log`).
- Add an index for every column you filter or sort by.

## The seed

`apps/web/scripts/seed.ts` is idempotent:

1. Makes sure the `app_settings` row exists.
2. If `SEED_ADMIN_EMAIL` is set:
   - the user exists: promotes it to `admin` and marks the email verified;
   - the user does not exist and `SEED_ADMIN_PASSWORD` has at least 8 characters: creates it through Better Auth (so the password is hashed correctly), then makes it an admin, verified, with onboarding complete.

It runs through `varlock run`, so it reads `apps/web/.env`. It builds its clients with `getServices()`, the same composition root as the app.

This is the only script allowed for manual data changes (see CLAUDE.md section 7). Keep it idempotent.

## Neon: pooled and direct URLs

Neon gives two connection strings for each branch:

| Variable                         | Which Neon URL                       | Used by                                                                            |
| -------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------- |
| `DATABASE_URL`                   | **pooled** (host contains `-pooler`) | the app at runtime, and the seed                                                   |
| `DATABASE_URL_DIRECT` (optional) | **direct** (no `-pooler`)            | `drizzle-kit` (`db:migrate`, `db:generate`, `db:push`, `db:studio`) and `db:reset` |

`drizzle.config.ts` uses `DATABASE_URL_DIRECT` when it is set, and falls back to `DATABASE_URL`. Migrations are safer over a direct connection, because a connection pooler in transaction mode can interfere with long DDL statements and session-level locks.

In the Neon console: open your project, click **Connect**, pick the branch and database, and copy the string with **Connection pooling** on (for `DATABASE_URL`) and off (for `DATABASE_URL_DIRECT`). Both must keep `sslmode=require`.

Use a separate Neon **branch** for development and preview deployments, so you never test migrations on production data.

For local Docker Postgres there is no pooler. Set only `DATABASE_URL`.

## The driver: `pg` everywhere

`createDb()` uses `drizzle-orm/node-postgres` over a standard `pg` connection pool (`max` 10 connections per server process). The same driver works with Neon, Docker, a local Postgres and CI.

Why not Neon's HTTP driver (`drizzle-orm/neon-http`)?

- **Interactive transactions.** The procedure builder runs each mutation and its audit row inside one transaction (`db.transaction(async (tx) => ...)`). The HTTP driver cannot do interactive transactions.
- **One driver for every host.** The HTTP driver only talks to Neon, so local Docker and CI would need a second code path.

On Vercel, each serverless instance opens its own small pool. Point `DATABASE_URL` at Neon's **pooled** URL so many instances share Neon's pooler instead of exhausting Postgres connections.

`pg` is listed in `serverExternalPackages` in `apps/web/next.config.ts`, so Next.js does not bundle it.

## Better Auth tables

Better Auth's tables are written by hand in `packages/db/src/schema/auth.ts` and `organization.ts`, plus the app's extra user fields (`bio`, `onboardingCompleted`), the admin plugin's fields (`user.role`, `user.banned`, `user.banReason`, `user.banExpires`, `session.impersonatedBy`) and the organization plugin's `session.activeOrganizationId`.

After you change auth plugins or `additionalFields` in `packages/auth/src/index.ts`, run:

```bash
pnpm auth:check
```

It runs `packages/auth/src/schema-compat.test.ts`. The test builds the auth config, asks Better Auth which tables and columns it expects, and fails with a list of anything missing from `packages/db/src/schema`. Add the missing columns, then generate and apply a migration.

(The Better Auth CLI generator is not used, because it cannot load a config that imports `server-only`.)

## Integration tests against a database

Tests that need a real database run only when `TEST_DATABASE_URL` is set:

```bash
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:54329/project_starter pnpm test:integration
```

The database must be migrated first. CI (`.github/workflows/ci.yml`) starts a Postgres service, runs `pnpm db:migrate`, then `pnpm test` with `TEST_DATABASE_URL` set.
