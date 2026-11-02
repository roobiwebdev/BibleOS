import type { StudyDb } from "@starter/local-db/drizzle";
import { z } from "zod";

import { defineCommand } from "../command";
import { DEFAULT_PREFERENCES, preferencesPatchSchema, preferencesSchema, type Preferences } from "../schemas";
import * as settingsService from "../services/settings";

export const PREFERENCES_KEY = "app";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * SOURCE OF TRUTH KEYWORDS: loadPreferences, stored preferences, repair settings, defaults merge
 * WHAT:  Reads Preferences from the settings table: missing fields take defaults, and any
 *        stored field that no longer validates falls back to its default on its own.
 * WHY:   An older or hand-edited value must never lock the reader out of the app, and one bad
 *        field should not reset every other preference.
 * WHERE: settings.get/set, reading.summary.
 */
export async function loadPreferences(db: StudyDb): Promise<Preferences> {
  const stored = await settingsService.read(db, PREFERENCES_KEY);
  const merged = { ...DEFAULT_PREFERENCES, ...(isRecord(stored) ? stored : {}) };
  const result = preferencesSchema.safeParse(merged);
  if (result.success) return result.data;
  const bad = new Set(result.error.issues.map((i) => String(i.path[0])));
  const kept = Object.fromEntries(Object.entries(merged).filter(([key]) => !bad.has(key)));
  return preferencesSchema.parse({ ...DEFAULT_PREFERENCES, ...kept });
}

/**
 * SOURCE OF TRUTH KEYWORDS: settings.get, settings.set, preferences commands
 * WHAT:  `get` returns the full Preferences; `set` merges a validated partial patch and
 *        stores the complete object.
 * WHY:   The settings screen changes one field at a time; storing the whole validated object
 *        keeps the row self-describing for backup and sync.
 * WHERE: desktop PreferencesProvider (after wiring), settings page.
 */
export const settingsCommands = {
  get: defineCommand({
    entity: "settings",
    action: "get",
    kind: "query",
    input: z.object({}).default({}),
    run: (ctx) => loadPreferences(ctx.db),
  }),

  set: defineCommand({
    entity: "settings",
    action: "set",
    kind: "mutation",
    input: preferencesPatchSchema,
    run: async (ctx, patch) => {
      const next = preferencesSchema.parse({ ...(await loadPreferences(ctx.db)), ...patch });
      await settingsService.write(ctx.db, PREFERENCES_KEY, next, ctx.now);
      return next;
    },
    entityId: () => PREFERENCES_KEY,
  }),
};
