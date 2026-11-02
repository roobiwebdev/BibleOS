import type { StudyDb } from "@starter/local-db/drizzle";
import { settings } from "@starter/local-db/schema";
import { eq } from "drizzle-orm";

/**
 * SOURCE OF TRUTH KEYWORDS: settingsService, readSetting, writeSetting, settings key value JSON
 * WHAT:  Reads and writes one JSON value per settings key. Parsing and validation are the
 *        caller's job (commands/settings.ts owns the Preferences schema).
 * WHY:   Services hold reusable queries, commands hold decisions (CLAUDE.md routers/services).
 * WHERE: commands/settings.ts, commands/reading.ts (goal and streak rules).
 */
export async function read(db: StudyDb, key: string): Promise<unknown> {
  const row = (await db.select({ value: settings.value }).from(settings).where(eq(settings.key, key))).at(0);
  if (!row) return undefined;
  try {
    const value: unknown = JSON.parse(row.value);
    return value;
  } catch {
    return undefined;
  }
}

export async function write(db: StudyDb, key: string, value: unknown, now: number): Promise<void> {
  const json = JSON.stringify(value);
  await db
    .insert(settings)
    .values({ key, value: json, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({ target: settings.key, set: { value: json, updatedAt: now } });
}
