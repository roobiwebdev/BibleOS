/**
 * SOURCE OF TRUTH KEYWORDS: userService, findProfile, updateUserProfile, markOnboardingCompleted, profile columns
 * WHAT:  Reusable database queries for the signed-in user's own profile (no auth, no business rules).
 * WHY:   Keeps the "own profile" column selection in one place so pages never see auth-internal
 *        columns (ban reason, role changes) through this path.
 * WHERE: packages/api/src/routers/user.ts.
 */
import "server-only";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { schema, type DbExecutor } from "@starter/db";

const u = schema.user;

export const profileColumns = {
  id: u.id,
  name: u.name,
  email: u.email,
  image: u.image,
  bio: u.bio,
  emailVerified: u.emailVerified,
  onboardingCompleted: u.onboardingCompleted,
  role: u.role,
  createdAt: u.createdAt,
} as const;

export async function findProfile(db: DbExecutor, userId: string) {
  const [row] = await db.select(profileColumns).from(u).where(eq(u.id, userId)).limit(1);
  return row ?? null;
}

export async function updateUserProfile(
  db: DbExecutor,
  userId: string,
  patch: { name?: string; bio?: string | null; image?: string | null },
) {
  const [row] = await db.update(u).set(patch).where(eq(u.id, userId)).returning(profileColumns);
  return row ?? null;
}

export async function markOnboardingCompleted(db: DbExecutor, userId: string) {
  const [row] = await db.update(u).set({ onboardingCompleted: true }).where(eq(u.id, userId)).returning({ id: u.id });
  return row ?? null;
}

/**
 * SOURCE OF TRUTH KEYWORDS: listPendingInvitationsForEmail, myInvitations, pending invitations
 * WHAT:  Pending, unexpired organization invitations addressed to an email, with org and inviter names.
 * WHY:   Better Auth's listUserInvitations refuses users whose email is unverified, which is
 *        every user while email verification is off (the default). Matching on the session
 *        email is equivalent to what Better Auth checks when accepting.
 * WHERE: user.myInvitations -> dashboard/invitations.
 */
export async function listPendingInvitationsForEmail(db: DbExecutor, email: string) {
  const rows = await db
    .select({
      id: schema.invitation.id,
      role: schema.invitation.role,
      expiresAt: schema.invitation.expiresAt,
      organizationName: schema.organization.name,
      inviterEmail: schema.user.email,
    })
    .from(schema.invitation)
    .innerJoin(schema.organization, eq(schema.organization.id, schema.invitation.organizationId))
    .leftJoin(schema.user, eq(schema.user.id, schema.invitation.inviterId))
    .where(
      and(
        eq(sql`lower(${schema.invitation.email})`, email.toLowerCase()),
        eq(schema.invitation.status, "pending"),
        gt(schema.invitation.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(schema.invitation.createdAt));
  return rows;
}
