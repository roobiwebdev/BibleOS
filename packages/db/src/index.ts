/**
 * SOURCE OF TRUTH KEYWORDS: createDb, Database, DbTransaction, DbExecutor, pg Pool, Neon, connection
 * WHAT:  Builds the Drizzle client over a standard `pg` connection pool.
 * WHY:   One driver for every Postgres host: Neon (default in production), Docker or local
 *        Postgres in development and CI. Interactive transactions work everywhere, which the
 *        audit-in-transaction guarantee in packages/api depends on.
 * WHERE: apps/web/src/server/services.ts (the only place a Database is created), seed script.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import type { DatabaseConfig } from "./config";
import { relations } from "./relations";
import * as schema from "./schema";

export function createDb(env: DatabaseConfig) {
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: env.DATABASE_POOL_MAX ?? 10,
  });
  return drizzle({ client: pool, relations });
}

export type Database = ReturnType<typeof createDb>;
export type DbTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
/** Anything that can run a query: the root client or an open transaction. */
export type DbExecutor = Database | DbTransaction;

export { schema };
export type { DatabaseConfig } from "./config";
