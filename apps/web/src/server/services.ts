/**
 * SOURCE OF TRUTH KEYWORDS: services, getServices, composition root, createDb, createAuthProvider, getAuth, settings service, singletons
 * WHAT:  The composition root. Reads env once and builds every server-side client and service.
 * WHY:   Packages never read env or create clients themselves (tarikcrafts-platform pattern); this
 *        is the only file that wires them together, so swapping a provider happens here.
 *        Cached on globalThis so dev hot-reloads don't open new database pools.
 * WHERE: server/trpc.ts, server/session.ts, route handlers, scripts/seed.ts.
 */
import "server-only";
import { createAuthProvider } from "@starter/auth";
import { createEmailService } from "@starter/core/email";
import { createPaymentsService } from "@starter/core/payments";
import { createSettingsService } from "@starter/core/settings";
import { createStorageService } from "@starter/core/storage";
import type { CoreEnv } from "@starter/core/types";
import { createDb } from "@starter/db";

import { serverEnv } from "./env";

function build() {
  const env = serverEnv();
  const coreEnv: CoreEnv = {
    NODE_ENV: env.NODE_ENV,
    APP_ENCRYPTION_KEY: env.APP_ENCRYPTION_KEY,
    APP_URL: env.BETTER_AUTH_URL,
    fallbacks: {
      storageAccountId: env.R2_ACCOUNT_ID,
      storageAccessKeyId: env.R2_ACCESS_KEY_ID,
      storageSecretAccessKey: env.R2_SECRET_ACCESS_KEY,
      storageBucket: env.R2_BUCKET,
      storagePublicUrl: env.R2_PUBLIC_URL,
      resendApiKey: env.RESEND_API_KEY,
      resendFromEmail: env.RESEND_FROM_EMAIL,
      googleClientId: env.GOOGLE_CLIENT_ID,
      googleClientSecret: env.GOOGLE_CLIENT_SECRET,
      githubClientId: env.GITHUB_CLIENT_ID,
      githubClientSecret: env.GITHUB_CLIENT_SECRET,
      polarAccessToken: env.POLAR_ACCESS_TOKEN,
      polarOrganizationId: env.POLAR_ORGANIZATION_ID,
      polarWebhookSecret: env.POLAR_WEBHOOK_SECRET,
    },
  };

  const db = createDb({ DATABASE_URL: env.DATABASE_URL });
  const settings = createSettingsService(db, coreEnv);
  const email = createEmailService(settings, coreEnv);
  const storage = createStorageService(settings);
  const payments = createPaymentsService(db, settings);
  const getAuth = createAuthProvider({
    env: {
      BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET,
      BETTER_AUTH_URL: env.BETTER_AUTH_URL,
      CORS_ORIGIN: env.CORS_ORIGIN,
      extraTrustedOrigins: [
        "project-starter://",
        ...(env.NODE_ENV === "development" ? ["exp://", "http://localhost:8081"] : []),
      ],
    },
    db,
    settings,
    email,
  });

  return { db, settings, email, storage, payments, getAuth, appUrl: env.BETTER_AUTH_URL };
}

export type Services = ReturnType<typeof build>;

const globalForServices = globalThis as typeof globalThis & { __starterServices?: Services };

export function getServices(): Services {
  globalForServices.__starterServices ??= build();
  return globalForServices.__starterServices;
}
