import "varlock/auto-load";
import { defineConfig } from "drizzle-kit";

// Migrations run over the direct (non-pooled) URL when one is provided.
const url = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL || "";

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  schemaFilter: ["public"],
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
