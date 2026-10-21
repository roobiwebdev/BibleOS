/**
 * SOURCE OF TRUTH KEYWORDS: createSettingsService, SettingsService, getSettings, updateSettings, getIntegrationKeys, setIntegrationKeys, invalidateSettings, settings cache
 * WHAT:  Reads and writes the single app_settings row with a short in-process cache, and
 *        encrypts/decrypts integration secrets.
 * WHY:   Admin-editable configuration is the backbone of the prebuilt features (toggles, site
 *        modes, branding, keys). Every reader goes through here so caching and decryption
 *        live in one place.
 * WHERE: created once in apps/web/src/server/services.ts; consumed by auth, api routers, root layout, route handlers.
 */
import "server-only";
import { eq } from "drizzle-orm";
import { schema, type DbExecutor, type Database } from "@starter/db";

import { decryptSecret, encryptSecret, isEncrypted } from "./secrets";
import {
  PLAIN_INTEGRATION_KEYS,
  SECRET_KEYS,
  type AppSettings,
  type CoreEnv,
  type IntegrationKeys,
  type IntegrationKeysInput,
  type SettingsPatch,
} from "./types";
import { createLogger } from "./logger";

const log = createLogger("settings");
const { appSettings, APP_SETTINGS_ID } = schema;

export function createSettingsService(db: Database, env: CoreEnv, ttlMs = 10_000) {
  let cache: { value: AppSettings; at: number } | null = null;

  async function load(executor: DbExecutor = db): Promise<AppSettings> {
    const rows = await executor.select().from(appSettings).where(eq(appSettings.id, APP_SETTINGS_ID)).limit(1);
    const row = rows[0];
    if (row) return row;
    // First boot: create the default row. Concurrent creators are harmless.
    await executor.insert(appSettings).values({ id: APP_SETTINGS_ID }).onConflictDoNothing();
    const created = await executor.select().from(appSettings).where(eq(appSettings.id, APP_SETTINGS_ID)).limit(1);
    const first = created[0];
    if (!first) throw new Error("app_settings row could not be created");
    return first;
  }

  async function get(): Promise<AppSettings> {
    if (cache && Date.now() - cache.at < ttlMs) return cache.value;
    const value = await load();
    cache = { value, at: Date.now() };
    return value;
  }

  /** Same as get() but never throws: used where the app must still render without a database. */
  async function getSafe(): Promise<AppSettings | null> {
    try {
      return await get();
    } catch (err) {
      log.error("could not load settings", undefined, err);
      return null;
    }
  }

  function invalidate() {
    cache = null;
  }

  async function update(patch: SettingsPatch, executor: DbExecutor = db): Promise<AppSettings> {
    await load(executor);
    const rows = await executor.update(appSettings).set(patch).where(eq(appSettings.id, APP_SETTINGS_ID)).returning();
    invalidate();
    const row = rows[0];
    if (!row) throw new Error("app_settings update returned no row");
    return row;
  }

  function decrypt(value: string | null): string | null {
    if (!value) return null;
    if (!isEncrypted(value)) return value;
    try {
      return decryptSecret(value, env.APP_ENCRYPTION_KEY);
    } catch (err) {
      log.error("could not decrypt a stored secret (was APP_ENCRYPTION_KEY rotated?)", undefined, err);
      return null;
    }
  }

  async function getIntegrationKeys(): Promise<IntegrationKeys> {
    const s = await getSafe();
    const pick = (key: (typeof SECRET_KEYS)[number] | (typeof PLAIN_INTEGRATION_KEYS)[number]) => {
      const stored = s ? s[key] : null;
      const value = SECRET_KEYS.some((k) => k === key) ? decrypt(stored) : stored;
      return value?.trim() || env.fallbacks[key]?.trim() || null;
    };
    return {
      storagePublicUrl: pick("storagePublicUrl"),
      storageBucket: pick("storageBucket"),
      storageAccountId: pick("storageAccountId"),
      storageAccessKeyId: pick("storageAccessKeyId"),
      storageSecretAccessKey: pick("storageSecretAccessKey"),
      resendApiKey: pick("resendApiKey"),
      resendFromEmail: pick("resendFromEmail"),
      googleClientId: pick("googleClientId"),
      googleClientSecret: pick("googleClientSecret"),
      githubClientId: pick("githubClientId"),
      githubClientSecret: pick("githubClientSecret"),
      polarAccessToken: pick("polarAccessToken"),
      polarOrganizationId: pick("polarOrganizationId"),
      polarWebhookSecret: pick("polarWebhookSecret"),
      polarSandboxMode: s?.polarSandboxMode ?? true,
    };
  }

  async function setIntegrationKeys(input: IntegrationKeysInput, executor: DbExecutor = db): Promise<void> {
    await load(executor);
    const patch: Partial<
      Record<(typeof SECRET_KEYS)[number] | (typeof PLAIN_INTEGRATION_KEYS)[number], string | null>
    > & { polarSandboxMode?: boolean } = {};
    for (const key of SECRET_KEYS) {
      const value = input[key];
      if (value === undefined) continue;
      patch[key] = value.trim() === "" ? null : encryptSecret(value.trim(), env.APP_ENCRYPTION_KEY);
    }
    for (const key of PLAIN_INTEGRATION_KEYS) {
      const value = input[key];
      if (value === undefined) continue;
      patch[key] = value.trim() === "" ? null : value.trim();
    }
    if (input.polarSandboxMode !== undefined) patch.polarSandboxMode = input.polarSandboxMode;
    await executor.update(appSettings).set(patch).where(eq(appSettings.id, APP_SETTINGS_ID));
    invalidate();
  }

  return { get, getSafe, update, invalidate, getIntegrationKeys, setIntegrationKeys };
}

export type SettingsService = ReturnType<typeof createSettingsService>;
