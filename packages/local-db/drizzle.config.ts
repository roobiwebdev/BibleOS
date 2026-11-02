import { defineConfig } from "drizzle-kit";

// Generation only: the study database lives on the reader's Mac and is migrated at runtime
// by src/migrate.ts through the executor, so no credentials are needed here.
export default defineConfig({
  schema: "./src/schema.ts",
  out: "./migrations",
  dialect: "sqlite",
  strict: true,
  verbose: true,
});
