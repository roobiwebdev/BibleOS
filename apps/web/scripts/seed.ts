/**
 * SOURCE OF TRUTH KEYWORDS: seed, db:seed, seedAdmin, default settings, idempotent seed
 * WHAT:  Idempotent seed: ensures the app_settings row exists and, when SEED_ADMIN_EMAIL is set,
 *        creates that account (or promotes the existing one) as admin.
 * WHY:   A fresh database becomes usable with one command and no manual SQL. Safe to run any
 *        number of times. Allowed exception to the "no scripts" rule (see CLAUDE.md).
 * WHERE: `pnpm db:seed`, `pnpm db:reset`, `pnpm bootstrap`.
 */
import { schema } from "@starter/db";
import { eq } from "drizzle-orm";

import { getServices } from "../src/server/services";

const { db, settings, getAuth } = getServices();

await settings.get(); // creates the default row on first run
console.log("✓ app settings ready");

const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.SEED_ADMIN_PASSWORD?.trim();
const name = process.env.SEED_ADMIN_NAME?.trim() || "Admin";

if (!email) {
  console.log("• SEED_ADMIN_EMAIL not set; skipping admin account (the first user to sign up becomes admin)");
} else {
  const [existing] = await db.select().from(schema.user).where(eq(schema.user.email, email)).limit(1);
  if (existing) {
    await db.update(schema.user).set({ role: "admin", emailVerified: true }).where(eq(schema.user.id, existing.id));
    console.log(`✓ promoted existing user ${email} to admin`);
  } else if (!password || password.length < 8) {
    console.log("• SEED_ADMIN_PASSWORD missing or shorter than 8 characters; skipping admin creation");
  } else {
    const auth = await getAuth();
    const created = await auth.api.signUpEmail({ body: { email, password, name } });
    await db
      .update(schema.user)
      .set({ role: "admin", emailVerified: true, onboardingCompleted: true })
      .where(eq(schema.user.id, created.user.id));
    console.log(`✓ created admin ${email}`);
  }
}

await db.$client.end();
