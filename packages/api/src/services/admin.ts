/**
 * SOURCE OF TRUTH KEYWORDS: adminService, admin queries, countUsers, countActiveUsersSince, listRecentUsers, listSessionsSince, accountProviderCounts, listAuditLog, auditEntities, listWaitlistEntries
 * WHAT:  Reusable read queries behind the admin overview, analytics, waitlist and audit log
 *        (no auth, no business rules).
 * WHY:   Batman ran these as Prisma calls inside server actions. Here each is one small typed
 *        query so the admin router only orchestrates and shapes the result.
 * WHERE: packages/api/src/routers/admin.ts.
 */
import "server-only";
import { and, count, countDistinct, desc, eq, gte, type SQL } from "drizzle-orm";
import { schema, type DbExecutor } from "@starter/db";

const { user, session, account, organization, member, notification, notificationRecipient, feedback, auditLog } =
  schema;

/** All users, or users created on/after `since`. */
export function countUsers(db: DbExecutor, since?: Date) {
  return since ? db.$count(user, gte(user.createdAt, since)) : db.$count(user);
}

export function countOnboardedUsers(db: DbExecutor) {
  return db.$count(user, eq(user.onboardingCompleted, true));
}

/** Distinct users who started a session on/after `since` (Batman's DAU / WAU). */
export async function countActiveUsersSince(db: DbExecutor, since: Date): Promise<number> {
  const [row] = await db
    .select({ value: countDistinct(session.userId) })
    .from(session)
    .where(gte(session.createdAt, since));
  return row?.value ?? 0;
}

export function listRecentUsers(db: DbExecutor, limit: number) {
  return db.query.user.findMany({
    columns: { id: true, name: true, email: true, image: true, createdAt: true, role: true },
    orderBy: { createdAt: "desc" },
    limit,
  });
}

/** Sign-up timestamps since a date, oldest first. */
export async function listSignupDatesSince(db: DbExecutor, since: Date): Promise<Date[]> {
  const rows = await db
    .select({ createdAt: user.createdAt })
    .from(user)
    .where(gte(user.createdAt, since))
    .orderBy(user.createdAt);
  return rows.map((r) => r.createdAt);
}

/** Sessions started since a date, oldest first (used for activity and IP geolocation). */
export function listSessionsSince(db: DbExecutor, since: Date) {
  return db
    .select({ createdAt: session.createdAt, userId: session.userId, ipAddress: session.ipAddress })
    .from(session)
    .where(gte(session.createdAt, since))
    .orderBy(session.createdAt);
}

export async function countOrganizationsAndMembers(db: DbExecutor) {
  const [totalOrgs, totalMembers] = await Promise.all([db.$count(organization), db.$count(member)]);
  return { totalOrgs, totalMembers };
}

export async function countNotificationRecipients(db: DbExecutor) {
  const [total, unread] = await Promise.all([
    db.$count(notificationRecipient),
    db.$count(notificationRecipient, eq(notificationRecipient.read, false)),
  ]);
  return { total, unread };
}

export function countNotifications(db: DbExecutor) {
  return db.$count(notification);
}

export function listRecentNotifications(db: DbExecutor, limit: number) {
  return db
    .select({
      id: notification.id,
      title: notification.title,
      tag: notification.tag,
      createdAt: notification.createdAt,
      recipientCount: count(notificationRecipient.id),
    })
    .from(notification)
    .leftJoin(notificationRecipient, eq(notificationRecipient.notificationId, notification.id))
    .groupBy(notification.id)
    .orderBy(desc(notification.createdAt))
    .limit(limit);
}

export async function countFeedback(db: DbExecutor) {
  const [total, open] = await Promise.all([db.$count(feedback), db.$count(feedback, eq(feedback.status, "open"))]);
  return { total, open };
}

export function listRecentFeedback(db: DbExecutor, limit: number) {
  return db.query.feedback.findMany({
    columns: { id: true, category: true, message: true, status: true, createdAt: true },
    with: { user: { columns: { id: true, name: true, email: true, image: true } } },
    orderBy: { createdAt: "desc" },
    limit,
  });
}

/** Linked accounts per auth provider ("credential", "google", "github", ...). */
export function accountProviderCounts(db: DbExecutor) {
  return db
    .select({ providerId: account.providerId, count: count() })
    .from(account)
    .groupBy(account.providerId)
    .orderBy(desc(count()));
}

export function listWaitlistEntries(db: DbExecutor, limit: number) {
  return db.query.waitlistEntry.findMany({ orderBy: { createdAt: "desc" }, limit });
}

export type AuditLogFilter = { entity?: string; userId?: string };

/** One page of audit rows, newest first, with the acting user's name and email. */
export async function listAuditLog(db: DbExecutor, filter: AuditLogFilter, page: { limit: number; offset: number }) {
  const conditions: SQL[] = [];
  if (filter.entity) conditions.push(eq(auditLog.entity, filter.entity));
  if (filter.userId) conditions.push(eq(auditLog.userId, filter.userId));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, total] = await Promise.all([
    db.query.auditLog.findMany({
      where: {
        ...(filter.entity ? { entity: filter.entity } : {}),
        ...(filter.userId ? { userId: filter.userId } : {}),
      },
      columns: {
        id: true,
        createdAt: true,
        action: true,
        entity: true,
        entityId: true,
        description: true,
        ipAddress: true,
        userAgent: true,
      },
      with: { user: { columns: { id: true, name: true, email: true, image: true } } },
      orderBy: { createdAt: "desc" },
      limit: page.limit,
      offset: page.offset,
    }),
    where ? db.$count(auditLog, where) : db.$count(auditLog),
  ]);
  return { rows, total };
}

/** Every entity name that has audit rows (for the filter dropdown). */
export async function listAuditEntities(db: DbExecutor): Promise<string[]> {
  const rows = await db.selectDistinct({ entity: auditLog.entity }).from(auditLog).orderBy(auditLog.entity);
  return rows.map((r) => r.entity);
}
