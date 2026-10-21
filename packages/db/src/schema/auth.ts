/**
 * SOURCE OF TRUTH KEYWORDS: user, session, account, verification, authTables, betterAuthSchema
 * WHAT:  Better Auth core tables plus the admin-plugin and app-specific user columns.
 * WHY:   Better Auth reads and writes these through the Drizzle adapter; column names must
 *        match the auth config in packages/auth. Regenerate a reference copy with
 *        `pnpm auth:generate` after changing auth plugins, then reconcile here.
 * WHERE: packages/auth (adapter), packages/api services, migrations.
 */
import { bigint, boolean, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
};

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    // admin plugin
    role: text("role").default("user"),
    banned: boolean("banned").default(false),
    banReason: text("ban_reason"),
    banExpires: timestamp("ban_expires"),
    // app fields
    bio: text("bio"),
    onboardingCompleted: boolean("onboarding_completed").default(false).notNull(),
    ...timestamps,
  },
  (t) => [index("user_created_at_idx").on(t.createdAt)],
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // admin plugin
    impersonatedBy: text("impersonated_by"),
    // organization plugin
    activeOrganizationId: text("active_organization_id"),
    ...timestamps,
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    ...timestamps,
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    ...timestamps,
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

/**
 * SOURCE OF TRUTH KEYWORDS: rateLimit, rate_limit, throttling, fixed window
 * WHAT:  Shared rate-limit counters. Better Auth writes its auth-endpoint limits here
 *        (rateLimit.storage = "database") and packages/api/src/lib/rate-limit.ts reuses the same
 *        table for tRPC and public-form limits, so limits hold across serverless instances.
 */
export const rateLimit = pgTable("rate_limit", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});
