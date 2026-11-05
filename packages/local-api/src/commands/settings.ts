import type { StudyDb } from "@starter/local-db/drizzle";
import { z } from "zod";

import { defineCommand } from "../command";
import {
  DEFAULT_PREFERENCES,
  DEFAULT_TRANSLATIONS,
  PREFERENCES_DEFAULTS_VERSION,
  preferencesPatchSchema,
  preferencesSchema,
  type Preferences,
} from "../schemas";
import * as settingsService from "../services/settings";

export const PREFERENCES_KEY = "app";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The main translation version 0 rows had when the field was never saved. */
const V0_MAIN_TRANSLATION = "en-bsb";

/**
 * SOURCE OF TRUTH KEYWORDS: migratePreferences, defaultsVersion, preference migration, one-time default switch, am-2005
 * WHAT:  Brings a stored preferences row up to PREFERENCES_DEFAULTS_VERSION, one step at a time.
 *        Version 1: the Amharic 2005 becomes the main translation, and the translation the
 *        reader had as main moves to the side-by-side column (so the default English main with
 *        the 1962 beside it becomes 2005 with BSB beside it).
 * WHY:   New defaults only reach new installs; readers who already saved a choice would never
 *        see the new main text. Each step runs once: the result carries the current version,
 *        and the next settings.set stores it, so later choices are never overridden. The step
 *        is a pure function of the stored row, so reading it again before a save gives the
 *        same answer.
 * WHERE: loadPreferences (settings.get/set, reading.summary, and rows restored from a backup).
 */
export function migratePreferences(stored: Record<string, unknown>): Record<string, unknown> {
  const version = typeof stored.defaultsVersion === "number" ? stored.defaultsVersion : 0;
  let next = stored;
  if (version < 1) {
    const oldMain = typeof stored.mainTranslation === "string" ? stored.mainTranslation : V0_MAIN_TRANSLATION;
    if (oldMain !== DEFAULT_TRANSLATIONS.am) {
      next = { ...next, mainTranslation: DEFAULT_TRANSLATIONS.am, parallelTranslation: oldMain };
    }
  }
  return { ...next, defaultsVersion: Math.max(version, PREFERENCES_DEFAULTS_VERSION) };
}

/**
 * SOURCE OF TRUTH KEYWORDS: loadPreferences, stored preferences, repair settings, defaults merge
 * WHAT:  Reads Preferences from the settings table: older rows are migrated (migratePreferences),
 *        missing fields take defaults, and any stored field that no longer validates falls back
 *        to its default on its own.
 * WHY:   An older or hand-edited value must never lock the reader out of the app, and one bad
 *        field should not reset every other preference.
 * WHERE: settings.get/set, reading.summary.
 */
export async function loadPreferences(db: StudyDb): Promise<Preferences> {
  const stored = await settingsService.read(db, PREFERENCES_KEY);
  // No row yet means a new reader, who already has the current defaults.
  const merged = { ...DEFAULT_PREFERENCES, ...(isRecord(stored) ? migratePreferences(stored) : {}) };
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
