/**
 * SOURCE OF TRUTH KEYWORDS: settingsRouter, settings.public, settings.authConfig, settings.legal, settings.siteModes, settings.adminGet, settings.update, settings.apiKeys, settings.saveApiKeys, settings.testStorage, publicSettings, siteModes
 * WHAT:  Reads and writes app_settings for the public site, auth screens and the admin panel.
 * WHY:   Batman exposed the full settings row (including every secret) through an unauthenticated
 *        server action. Here public callers get a curated, secret-free subset; admins get every
 *        non-secret field; integration secrets are only ever returned masked.
 * WHERE: lib/actions/settings.ts (web), root layout, auth pages, admin General/Features/Site
 *        Settings/API Keys pages, landing page site modes.
 */
import { APP_THEME_IDS } from "@starter/config/themes";
import { maskSecret } from "@starter/core/secrets";
import { PLAIN_INTEGRATION_KEYS, SECRET_KEYS, type AppSettings, type IntegrationKeysInput } from "@starter/core/types";
import { z } from "zod";

import { adminProcedure, publicProcedure, router } from "../trpc";

/** Fields any visitor may see. Never add integration columns here. */
function toPublicSettings(s: AppSettings) {
  return {
    appName: s.appName,
    appDescription: s.appDescription,
    appUrl: s.appUrl,
    appTheme: s.appTheme,
    supportEmail: s.supportEmail,
    onboardingEnabled: s.onboardingEnabled,
    emailVerificationEnabled: s.emailVerificationEnabled,
    forgotPasswordEnabled: s.forgotPasswordEnabled,
    socialLoginEnabled: s.socialLoginEnabled,
    organizationsEnabled: s.organizationsEnabled,
    invitesEnabled: s.invitesEnabled,
    signupsEnabled: s.signupsEnabled,
    maintenanceMode: s.maintenanceMode,
    maintenanceMessage: s.maintenanceMessage,
  };
}
export type PublicSettings = ReturnType<typeof toPublicSettings>;

/** Every non-secret column, for admin forms. */
function toAdminSettings(s: AppSettings) {
  const {
    storageAccessKeyId: _a,
    storageSecretAccessKey: _b,
    resendApiKey: _c,
    googleClientSecret: _d,
    githubClientSecret: _e,
    polarAccessToken: _f,
    polarWebhookSecret: _g,
    ...rest
  } = s;
  return rest;
}

function toSiteModes(s: AppSettings) {
  const countdown =
    s.countdownMode && s.countdownTarget
      ? {
          target: s.countdownTarget.toISOString(),
          title: s.countdownTitle,
          headline: s.countdownHeadline,
          description: s.countdownDescription,
          endMessage: s.countdownEndMessage,
          appName: s.appName,
          supportEmail: s.supportEmail,
        }
      : null;
  const waitlist = s.waitlistMode
    ? {
        title: s.waitlistTitle,
        headline: s.waitlistHeadline,
        description: s.waitlistDescription,
        buttonText: s.waitlistButtonText,
        successMessage: s.waitlistSuccessMessage,
        showName: s.waitlistShowName,
        showCompany: s.waitlistShowCompany,
        appName: s.appName,
        supportEmail: s.supportEmail,
      }
    : null;
  return { countdown, waitlist };
}
export type SiteModes = ReturnType<typeof toSiteModes>;

const optionalText = (max: number) => z.string().trim().max(max);

export const settingsUpdateInput = z
  .object({
    // general / SEO
    appName: optionalText(80).min(1),
    appDescription: optionalText(500),
    appUrl: z.union([z.literal(""), z.url()]),
    metaTitle: optionalText(120).nullable(),
    metaDescription: optionalText(300).nullable(),
    ogImage: optionalText(500).nullable(),
    appTheme: z.enum(APP_THEME_IDS),
    supportEmail: z.union([z.literal(""), z.email()]),
    privacyContent: optionalText(100_000),
    termsContent: optionalText(100_000),
    // toggles
    onboardingEnabled: z.boolean(),
    emailVerificationEnabled: z.boolean(),
    forgotPasswordEnabled: z.boolean(),
    socialLoginEnabled: z.boolean(),
    organizationsEnabled: z.boolean(),
    invitesEnabled: z.boolean(),
    signupsEnabled: z.boolean(),
    defaultUserRole: z.enum(["user", "admin"]),
    maxUsersEnabled: z.boolean(),
    maxUsers: z.number().int().min(0).max(10_000_000),
    sessionTimeout: z.number().int().min(1).max(365),
    // maintenance
    maintenanceMode: z.boolean(),
    maintenanceMessage: optionalText(500),
    // waitlist
    waitlistMode: z.boolean(),
    waitlistTitle: optionalText(120),
    waitlistHeadline: optionalText(200),
    waitlistDescription: optionalText(1000),
    waitlistButtonText: optionalText(40),
    waitlistSuccessMessage: optionalText(300),
    waitlistShowName: z.boolean(),
    waitlistShowCompany: z.boolean(),
    // countdown
    countdownMode: z.boolean(),
    countdownTarget: z.coerce.date().nullable(),
    countdownTitle: optionalText(120),
    countdownHeadline: optionalText(200),
    countdownDescription: optionalText(1000),
    countdownEndMessage: optionalText(300),
  })
  .partial();
export type SettingsUpdateInput = z.infer<typeof settingsUpdateInput>;

const integrationKeyNames = [...SECRET_KEYS, ...PLAIN_INTEGRATION_KEYS] as const;
const keyField = z.string().trim().max(4000).optional();
export const apiKeysInput = z.object({
  storageAccountId: keyField,
  storageBucket: keyField,
  storagePublicUrl: keyField,
  storageAccessKeyId: keyField,
  storageSecretAccessKey: keyField,
  resendApiKey: keyField,
  resendFromEmail: keyField,
  googleClientId: keyField,
  googleClientSecret: keyField,
  githubClientId: keyField,
  githubClientSecret: keyField,
  polarAccessToken: keyField,
  polarOrganizationId: keyField,
  polarWebhookSecret: keyField,
  polarSandboxMode: z.boolean().optional(),
});
export type ApiKeysInput = z.infer<typeof apiKeysInput>;

const isMasked = (value: string) => value.includes("•");

export const settingsRouter = router({
  /** Non-secret settings for any visitor (branding, toggles needed by public UI). */
  public: publicProcedure().query(async ({ ctx }) => toPublicSettings(await ctx.services.settings.get())),

  /** What the sign-in / sign-up screens should show. */
  authConfig: publicProcedure().query(async ({ ctx }) => {
    const s = await ctx.services.settings.get();
    const keys = await ctx.services.settings.getIntegrationKeys();
    const googleConfigured = Boolean(keys.googleClientId && keys.googleClientSecret);
    const githubConfigured = Boolean(keys.githubClientId && keys.githubClientSecret);
    return {
      socialLoginEnabled: s.socialLoginEnabled && (googleConfigured || githubConfigured),
      googleEnabled: s.socialLoginEnabled && googleConfigured,
      githubEnabled: s.socialLoginEnabled && githubConfigured,
      forgotPasswordEnabled: s.forgotPasswordEnabled,
      emailVerificationEnabled: s.emailVerificationEnabled,
      organizationsEnabled: s.organizationsEnabled,
      invitesEnabled: s.invitesEnabled,
      signupsEnabled: s.signupsEnabled,
    };
  }),

  legal: publicProcedure()
    .input(z.object({ slug: z.enum(["privacy", "terms"]) }))
    .query(async ({ ctx, input }) => {
      const s = await ctx.services.settings.get();
      const content = input.slug === "privacy" ? s.privacyContent : s.termsContent;
      return { content: content || null, appName: s.appName, supportEmail: s.supportEmail };
    }),

  /** Countdown / waitlist landing modes (null when off). */
  siteModes: publicProcedure().query(async ({ ctx }) => toSiteModes(await ctx.services.settings.get())),

  adminGet: adminProcedure().query(async ({ ctx }) => toAdminSettings(await ctx.services.settings.get())),

  update: adminProcedure({ audit: { entity: "settings", action: "update" } })
    .input(settingsUpdateInput)
    .mutation(async ({ ctx, input }) => toAdminSettings(await ctx.services.settings.update(input, ctx.db))),

  /** Integration keys for Admin > API Keys. Secrets are masked; non-secrets shown in full. */
  apiKeys: adminProcedure().query(async ({ ctx }) => {
    const k = await ctx.services.settings.getIntegrationKeys();
    const configured = {
      storage: await ctx.services.storage.isConfigured(),
      email: Boolean(k.resendApiKey),
      google: Boolean(k.googleClientId && k.googleClientSecret),
      github: Boolean(k.githubClientId && k.githubClientSecret),
      payments: Boolean(k.polarAccessToken),
    };
    return {
      storageAccountId: k.storageAccountId ?? "",
      storageBucket: k.storageBucket ?? "",
      storagePublicUrl: k.storagePublicUrl ?? "",
      storageAccessKeyId: maskSecret(k.storageAccessKeyId),
      storageSecretAccessKey: maskSecret(k.storageSecretAccessKey),
      resendApiKey: maskSecret(k.resendApiKey),
      resendFromEmail: k.resendFromEmail ?? "",
      googleClientId: k.googleClientId ?? "",
      googleClientSecret: maskSecret(k.googleClientSecret),
      githubClientId: k.githubClientId ?? "",
      githubClientSecret: maskSecret(k.githubClientSecret),
      polarAccessToken: maskSecret(k.polarAccessToken),
      polarOrganizationId: k.polarOrganizationId ?? "",
      polarWebhookSecret: maskSecret(k.polarWebhookSecret),
      polarSandboxMode: k.polarSandboxMode,
      configured,
    };
  }),

  /** Saves keys. Masked values (unchanged fields) are ignored; empty string clears a key. */
  saveApiKeys: adminProcedure({ audit: { entity: "settings", action: "updateApiKeys" } })
    .input(apiKeysInput)
    .mutation(async ({ ctx, input }) => {
      const patch: IntegrationKeysInput = {};
      for (const key of integrationKeyNames) {
        const value = input[key];
        if (value !== undefined && !isMasked(value)) patch[key] = value;
      }
      if (input.polarSandboxMode !== undefined) patch.polarSandboxMode = input.polarSandboxMode;
      await ctx.services.settings.setIntegrationKeys(patch, ctx.db);
      return { success: true };
    }),

  testStorage: adminProcedure({ audit: false }).mutation(async ({ ctx }) => ctx.services.storage.testConnection()),
});
