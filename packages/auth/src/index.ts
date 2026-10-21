/**
 * SOURCE OF TRUTH KEYWORDS: createAuth, createAuthProvider, getAuth, Auth, Session, AuthUser, betterAuth, auth config, social providers, signup rules
 * WHAT:  Builds the Better Auth instance from env + live admin settings, and caches it.
 * WHY:   Batman read toggles and OAuth keys once at boot, so keys saved in Admin > API Keys and
 *        the GitHub provider never took effect. Here the instance is rebuilt automatically when
 *        settings change (checked at most every few seconds), so admin changes apply without a
 *        redeploy. Env and clients are passed in by the app (tarikcrafts-platform pattern).
 * WHERE: apps/web/src/server/services.ts creates the provider; everything else calls getAuth().
 */
import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { expo } from "@better-auth/expo";
import { schema, type Database } from "@starter/db";
import { emailTemplate, escapeHtml, type EmailService } from "@starter/core/email";
import { createLogger } from "@starter/core/logger";
import { notifyAdmins, notifyUser } from "@starter/core/notify";
import type { SettingsService } from "@starter/core/settings";
import type { AppSettings, IntegrationKeys } from "@starter/core/types";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { admin as adminPlugin, organization } from "better-auth/plugins";
import { count, eq } from "drizzle-orm";

import { ac, roles } from "./permissions";

export * from "./permissions";

const log = createLogger("auth");

export type AuthEnv = {
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  CORS_ORIGIN: string;
  /** Extra origins allowed to call auth (native app schemes, preview URLs). */
  extraTrustedOrigins?: readonly string[];
};

export type AuthDeps = {
  env: AuthEnv;
  db: Database;
  settings: SettingsService;
  email: EmailService;
};

/** The settings values that shape the auth config. */
export type AuthSnapshot = {
  settings: AppSettings | null;
  keys: Pick<IntegrationKeys, "googleClientId" | "googleClientSecret" | "githubClientId" | "githubClientSecret">;
};

const DAY = 60 * 60 * 24;

export function buildAuth(deps: AuthDeps, snapshot: AuthSnapshot) {
  const { env, db, settings: settingsService, email } = deps;
  const s = snapshot.settings;
  const appName = s?.appName ?? "Project Starter";
  const sessionDays = Math.max(1, Math.min(365, s?.sessionTimeout ?? 30));
  const k = snapshot.keys;

  const socialProviders = {
    ...(k.googleClientId && k.googleClientSecret
      ? { google: { clientId: k.googleClientId, clientSecret: k.googleClientSecret } }
      : {}),
    ...(k.githubClientId && k.githubClientSecret
      ? { github: { clientId: k.githubClientId, clientSecret: k.githubClientSecret } }
      : {}),
  };

  return betterAuth({
    appName,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: [env.CORS_ORIGIN, ...(env.extraTrustedOrigins ?? [])],
    database: drizzleAdapter(db, { provider: "pg", schema }),

    session: {
      expiresIn: sessionDays * DAY,
      updateAge: Math.min((sessionDays * DAY) / 2, DAY),
    },

    rateLimit: {
      enabled: true,
      storage: "database",
      modelName: "rateLimit",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 10 },
        "/sign-up/email": { window: 60, max: 5 },
        "/forget-password": { window: 300, max: 5 },
        "/request-password-reset": { window: 300, max: 5 },
        "/send-verification-email": { window: 300, max: 5 },
      },
    },

    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      requireEmailVerification: s?.emailVerificationEnabled ?? false,
      async sendResetPassword({ user, url }) {
        const current = await settingsService.getSafe();
        if (current && !current.forgotPasswordEnabled)
          throw new APIError("FORBIDDEN", { message: "Password reset is disabled." });
        await email.send({
          to: user.email,
          subject: `Reset your ${appName} password`,
          html: emailTemplate({
            appName,
            heading: "Reset your password",
            body: `<p>Hi ${escapeHtml(user.name || "there")},</p><p>Use the button below to choose a new password. If you didn't request this, you can ignore this email.</p>`,
            actionUrl: url,
            actionLabel: "Reset password",
          }),
          text: `Reset your password: ${url}`,
        });
      },
    },

    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      async sendVerificationEmail({ user, url }) {
        const current = await settingsService.getSafe();
        if (!current?.emailVerificationEnabled) return;
        let link = url;
        try {
          const u = new URL(url);
          u.searchParams.set("callbackURL", "/onboarding");
          link = u.toString();
        } catch {
          // relative URL: keep as-is
        }
        await email.send({
          to: user.email,
          subject: `Verify your ${appName} email`,
          html: emailTemplate({
            appName,
            heading: "Confirm your email",
            body: `<p>Hi ${escapeHtml(user.name || "there")},</p><p>Confirm your email address to finish setting up your account.</p>`,
            actionUrl: link,
            actionLabel: "Verify email",
          }),
          text: `Verify your email: ${link}`,
        });
      },
    },

    socialProviders,

    user: {
      additionalFields: {
        bio: { type: "string", required: false, input: true },
        onboardingCompleted: { type: "boolean", required: false, defaultValue: false, input: false },
      },
      deleteUser: { enabled: true },
      changeEmail: { enabled: false },
    },

    databaseHooks: {
      user: {
        create: {
          before: async (newUser, ctx) => {
            // Admin-created users bypass public sign-up rules.
            if (ctx?.context.session?.user.role === "admin") return { data: newUser };
            const current = await settingsService.get();
            if (!current.signupsEnabled)
              throw new APIError("BAD_REQUEST", { message: "Signups are currently disabled." });
            if (current.maxUsersEnabled && current.maxUsers > 0) {
              const [row] = await db.select({ n: count() }).from(schema.user);
              if ((row?.n ?? 0) >= current.maxUsers) {
                throw new APIError("BAD_REQUEST", { message: "Registration is closed. Maximum user limit reached." });
              }
            }
            return { data: newUser };
          },
          after: async (created) => {
            // First user becomes admin; everyone else gets the configured default role.
            const [row] = await db.select({ n: count() }).from(schema.user);
            const isFirstUser = (row?.n ?? 0) === 1;
            const current = await settingsService.getSafe();
            const role = isFirstUser ? "admin" : current?.defaultUserRole === "admin" ? "admin" : "user";
            await db.update(schema.user).set({ role }).where(eq(schema.user.id, created.id));
            await notifyUser(db, created.id, {
              title: isFirstUser ? "You're the admin" : "Welcome",
              description: isFirstUser
                ? "As the first user, you have full admin access. Manage users, settings and everything else from the admin panel."
                : "Your account is ready. Get started by exploring the dashboard.",
              tag: "general",
            });
            if (!isFirstUser) {
              await notifyAdmins(db, {
                title: "New user signed up",
                description: `${created.name || created.email} just created an account.`,
                tag: "general",
              });
            }
          },
        },
      },
    },

    hooks: {
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/change-password") return;
        const userId = ctx.context.session?.user.id ?? ctx.context.newSession?.user.id;
        if (!userId) return;
        await notifyUser(db, userId, {
          title: "Password changed",
          description: "Your password was updated successfully. If this wasn't you, reset your password now.",
          tag: "security",
        });
      }),
    },

    plugins: [
      expo(),
      adminPlugin({ ac, roles, defaultRole: "user", adminRoles: ["admin"] }),
      organization({
        allowUserToCreateOrganization: async () => (await settingsService.getSafe())?.organizationsEnabled ?? false,
        async sendInvitationEmail({ email: to, organization: org, inviter, id }) {
          const current = await settingsService.getSafe();
          if (!current?.invitesEnabled) throw new APIError("FORBIDDEN", { message: "Invitations are disabled." });
          const acceptUrl = `${env.BETTER_AUTH_URL}/dashboard/invitations?id=${encodeURIComponent(id)}`;
          await email.send({
            to,
            subject: `You're invited to ${org.name} on ${appName}`,
            html: emailTemplate({
              appName,
              heading: `Join ${escapeHtml(org.name)}`,
              body: `<p>${escapeHtml(inviter.user.name || "Someone")} invited you to join <strong>${escapeHtml(org.name)}</strong> on ${escapeHtml(appName)}.</p>`,
              actionUrl: acceptUrl,
              actionLabel: "View invitation",
            }),
            text: `You're invited to ${org.name}: ${acceptUrl}`,
          });
        },
      }),
      nextCookies(),
    ],
  });
}

export type Auth = ReturnType<typeof buildAuth>;
export type Session = Auth["$Infer"]["Session"];
export type AuthUser = Session["user"];

function fingerprintOf(snap: AuthSnapshot): string {
  const s = snap.settings;
  return JSON.stringify([
    s?.appName,
    s?.sessionTimeout,
    s?.emailVerificationEnabled,
    snap.keys.googleClientId,
    snap.keys.googleClientSecret,
    snap.keys.githubClientId,
    snap.keys.githubClientSecret,
  ]);
}

/**
 * Returns a getter that always yields an auth instance matching the current settings.
 * Rebuilds only when a setting or key that affects auth has changed.
 */
export function createAuthProvider(deps: AuthDeps) {
  let current: { auth: Auth; fingerprint: string } | null = null;

  async function snapshot(): Promise<AuthSnapshot> {
    const settings = await deps.settings.getSafe();
    const keys = await deps.settings.getIntegrationKeys();
    return {
      settings,
      keys: {
        googleClientId: keys.googleClientId,
        googleClientSecret: keys.googleClientSecret,
        githubClientId: keys.githubClientId,
        githubClientSecret: keys.githubClientSecret,
      },
    };
  }

  return async function getAuth(): Promise<Auth> {
    const snap = await snapshot();
    const fingerprint = fingerprintOf(snap);
    if (!current || current.fingerprint !== fingerprint) {
      if (current) log.info("settings changed, rebuilding auth instance");
      current = { auth: buildAuth(deps, snap), fingerprint };
    }
    return current.auth;
  };
}

export type GetAuth = ReturnType<typeof createAuthProvider>;
