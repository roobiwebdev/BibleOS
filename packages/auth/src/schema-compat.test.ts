/**
 * Verifies the hand-written Drizzle tables contain every table and column Better Auth
 * (with our plugins and additional fields) expects. Run after changing auth plugins.
 * Replaces the Better Auth CLI generator, which cannot load configs that use `server-only`.
 */
import { createDb, schema } from "@starter/db";
import { getAuthTables } from "better-auth/db";
import { getColumns, isTable } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { buildAuth } from "./index";

describe("Better Auth schema compatibility", () => {
  const auth = buildAuth(
    {
      env: {
        BETTER_AUTH_SECRET: "x".repeat(32),
        BETTER_AUTH_URL: "http://localhost:3001",
        CORS_ORIGIN: "http://localhost:3001",
      },
      db: createDb({ DATABASE_URL: "postgresql://unused:unused@localhost:1/unused" }),
      // Test doubles: callbacks that use these never run during this test.
      settings: {} as never,
      email: {} as never,
    },
    {
      settings: null,
      keys: { googleClientId: null, googleClientSecret: null, githubClientId: null, githubClientSecret: null },
    },
  );
  const tables = getAuthTables(auth.options);
  const drizzleTables = new Map(Object.entries(schema).filter(([, value]) => isTable(value)));

  for (const [key, table] of Object.entries(tables)) {
    it(`has table "${table.modelName}" with all ${key} fields`, () => {
      const dt = drizzleTables.get(table.modelName);
      expect(dt, `missing Drizzle table export "${table.modelName}"`).toBeDefined();
      if (!dt || !isTable(dt)) return;
      const columns = Object.keys(getColumns(dt));
      const expected = ["id", ...Object.entries(table.fields).map(([name, field]) => field.fieldName ?? name)];
      const missing = expected.filter((c) => !columns.includes(c));
      expect(missing, `table ${table.modelName} is missing columns`).toEqual([]);
    });
  }
});
