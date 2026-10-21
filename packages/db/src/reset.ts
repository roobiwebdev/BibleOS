/**
 * SOURCE OF TRUTH KEYWORDS: db:reset, dropSchema, resetDatabase
 * WHAT:  Drops every table (public + drizzle migration journal) so migrations can replay from zero.
 * WHY:   Clean-room verification and local resets. Refuses to run when NODE_ENV=production.
 * WHERE: `pnpm db:reset` (followed by db:migrate and the web seed).
 */
import { Client } from "pg";

const url = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
if (process.env.NODE_ENV === "production") throw new Error("Refusing to reset a production database");

const client = new Client({ connectionString: url });
await client.connect();
await client.query("DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
await client.end();
console.log("Database reset: public and drizzle schemas dropped.");
