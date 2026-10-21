/**
 * SOURCE OF TRUTH KEYWORDS: AppSettings, IntegrationKeys, IntegrationKeysInput, CoreEnv, SettingsPatch, NotificationTag
 * WHAT:  Shared server-side types for the core package. Database row shapes come from Drizzle
 *        ($inferSelect); only shapes the database does not describe are declared here.
 * WHERE: packages/core, packages/auth, packages/api.
 */
import type { schema } from "@starter/db";

export type AppSettings = typeof schema.appSettings.$inferSelect;
export type AppSettingsInsert = typeof schema.appSettings.$inferInsert;

/** Columns that hold encrypted ciphertext in app_settings. */
export const SECRET_KEYS = [
  "storageAccessKeyId",
  "storageSecretAccessKey",
  "resendApiKey",
  "googleClientSecret",
  "githubClientSecret",
  "polarAccessToken",
  "polarWebhookSecret",
] as const;
export type SecretKey = (typeof SECRET_KEYS)[number];

/** Non-secret integration columns. */
export const PLAIN_INTEGRATION_KEYS = [
  "storagePublicUrl",
  "storageBucket",
  "storageAccountId",
  "resendFromEmail",
  "googleClientId",
  "githubClientId",
  "polarOrganizationId",
] as const;
export type PlainIntegrationKey = (typeof PLAIN_INTEGRATION_KEYS)[number];

export type IntegrationKeyName = SecretKey | PlainIntegrationKey;

/** Decrypted, env-merged credentials. Server-only; never serialize to the client. */
export type IntegrationKeys = Record<IntegrationKeyName, string | null> & { polarSandboxMode: boolean };

/** Admin form input: empty string clears a key, undefined leaves it unchanged. */
export type IntegrationKeysInput = Partial<Record<IntegrationKeyName, string>> & { polarSandboxMode?: boolean };

/** Everything in app_settings except id, timestamps and integration columns. */
export type SettingsPatch = Partial<
  Omit<AppSettingsInsert, "id" | "updatedAt" | IntegrationKeyName | "polarSandboxMode">
>;

/** Env values the app passes into core services (env is owned by the app, not packages). */
export type CoreEnv = {
  NODE_ENV: "development" | "production" | "test";
  APP_ENCRYPTION_KEY: string;
  APP_URL: string;
  /** Optional .env fallbacks; values saved in Admin > API Keys win. */
  fallbacks: Partial<Record<IntegrationKeyName, string | undefined>>;
};

export const NOTIFICATION_TAGS = [
  "general",
  "announcement",
  "update",
  "maintenance",
  "security",
  "billing",
  "feature",
  "urgent",
] as const;
export type NotificationTag = (typeof NOTIFICATION_TAGS)[number];
