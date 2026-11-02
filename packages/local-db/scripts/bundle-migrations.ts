/**
 * Bundles migrations/<id>/migration.sql into src/migrations.ts so Node tests and the
 * Vite/Tauri app import the same SQL without file-system access at runtime.
 * Run after `drizzle-kit generate` (the package's db:generate script does both).
 * The migrations test fails when the bundle is stale.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { readMigrationFolder, renderMigrationsModule } from "../src/migration-files.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrations = readMigrationFolder(join(root, "migrations"));
const out = join(root, "src", "migrations.ts");
writeFileSync(out, renderMigrationsModule(migrations));
// Match the repo formatter so `oxfmt --check` stays clean; the test compares values, not text.
execFileSync("npx", ["oxfmt", out], { stdio: "inherit" });
console.log(`Bundled ${migrations.length} migration(s) into src/migrations.ts`);
