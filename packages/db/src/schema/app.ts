/**
 * SOURCE OF TRUTH KEYWORDS: appSettings, AppSettings, featureToggles, siteModes, apiKeys, maintenance, waitlistMode, countdownMode, branding
 * WHAT:  The single-row runtime configuration table (id = "default") edited from the admin panel.
 * WHY:   Lets an admin change branding, SEO, feature toggles, site modes and third-party keys
 *        without a redeploy. Secret columns (marked "encrypted") hold AES-GCM ciphertext written *        by packages/core/src/secrets.ts; never read them directly, use getIntegrationKeys().
 * WHERE: packages/api settings service, packages/auth (toggles), apps/web proxy + layouts.
 */
import { boolean, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const APP_SETTINGS_ID = "default";

export const appSettings = pgTable("app_settings", {
  id: text("id").primaryKey().default(APP_SETTINGS_ID),

  // General / branding / SEO
  appName: text("app_name").default("Project Starter").notNull(),
  appDescription: text("app_description").default("").notNull(),
  appUrl: text("app_url").default("").notNull(),
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),
  ogImage: text("og_image"),
  appTheme: text("app_theme").default("default").notNull(),
  supportEmail: text("support_email").default("").notNull(),
  privacyContent: text("privacy_content").default("").notNull(),
  termsContent: text("terms_content").default("").notNull(),

  // Feature toggles
  onboardingEnabled: boolean("onboarding_enabled").default(true).notNull(),
  emailVerificationEnabled: boolean("email_verification_enabled").default(false).notNull(),
  forgotPasswordEnabled: boolean("forgot_password_enabled").default(true).notNull(),
  socialLoginEnabled: boolean("social_login_enabled").default(false).notNull(),
  organizationsEnabled: boolean("organizations_enabled").default(false).notNull(),
  invitesEnabled: boolean("invites_enabled").default(false).notNull(),
  signupsEnabled: boolean("signups_enabled").default(true).notNull(),
  defaultUserRole: text("default_user_role").default("user").notNull(),
  maxUsersEnabled: boolean("max_users_enabled").default(false).notNull(),
  maxUsers: integer("max_users").default(0).notNull(),
  sessionTimeout: integer("session_timeout").default(30).notNull(),

  // Maintenance mode
  maintenanceMode: boolean("maintenance_mode").default(false).notNull(),
  maintenanceMessage: text("maintenance_message")
    .default("We're performing scheduled maintenance. We'll be back shortly.")
    .notNull(),

  // Waitlist mode
  waitlistMode: boolean("waitlist_mode").default(false).notNull(),
  waitlistTitle: text("waitlist_title").default("Join the waitlist").notNull(),
  waitlistHeadline: text("waitlist_headline").default("Be the first to know when we launch").notNull(),
  waitlistDescription: text("waitlist_description").default("").notNull(),
  waitlistButtonText: text("waitlist_button_text").default("Join waitlist").notNull(),
  waitlistSuccessMessage: text("waitlist_success_message")
    .default("You're on the list! We'll notify you when we launch.")
    .notNull(),
  waitlistShowName: boolean("waitlist_show_name").default(false).notNull(),
  waitlistShowCompany: boolean("waitlist_show_company").default(false).notNull(),

  // Countdown mode
  countdownMode: boolean("countdown_mode").default(false).notNull(),
  countdownTarget: timestamp("countdown_target"),
  countdownTitle: text("countdown_title").default("Coming soon").notNull(),
  countdownHeadline: text("countdown_headline").default("We're launching soon").notNull(),
  countdownDescription: text("countdown_description").default("").notNull(),
  countdownEndMessage: text("countdown_end_message").default("We're live! Check back soon.").notNull(),

  // Integration keys (encrypted columns hold ciphertext; plain columns are non-secret)
  storagePublicUrl: text("storage_public_url"),
  storageBucket: text("storage_bucket"),
  storageAccountId: text("storage_account_id"),
  storageAccessKeyId: text("storage_access_key_id"), // encrypted
  storageSecretAccessKey: text("storage_secret_access_key"), // encrypted
  resendApiKey: text("resend_api_key"), // encrypted
  resendFromEmail: text("resend_from_email"),
  googleClientId: text("google_client_id"),
  googleClientSecret: text("google_client_secret"), // encrypted
  githubClientId: text("github_client_id"),
  githubClientSecret: text("github_client_secret"), // encrypted
  polarAccessToken: text("polar_access_token"), // encrypted
  polarOrganizationId: text("polar_organization_id"),
  polarWebhookSecret: text("polar_webhook_secret"), // encrypted
  polarSandboxMode: boolean("polar_sandbox_mode").default(true).notNull(),

  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
