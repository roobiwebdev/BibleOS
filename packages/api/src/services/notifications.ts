/**
 * SOURCE OF TRUTH KEYWORDS: notificationsService, listUserNotifications, countUnread, markRecipientRead, markAllRead, listSentHistory, listUserOptions, searchUserOptions, allUserIds
 * WHAT:  Reusable database queries for the notification inbox and the admin broadcast screen
 *        (no auth, no business rules).
 * WHY:   Keeps the inbox join, unread counts and delivery/read statistics in one place so the
 *        router, dashboard layout and admin history all agree on the numbers.
 * WHERE: packages/api/src/routers/notifications.ts.
 */
import "server-only";
import { and, asc, count, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { schema, type DbExecutor } from "@starter/db";

const r = schema.notificationRecipient;
const n = schema.notification;
const u = schema.user;

export type InboxFilter = { userId: string; tag: string | null; unreadOnly: boolean };

function inboxWhere(f: InboxFilter): SQL | undefined {
  const parts: SQL[] = [eq(r.userId, f.userId)];
  if (f.unreadOnly) parts.push(eq(r.read, false));
  if (f.tag) parts.push(eq(n.tag, f.tag));
  return and(...parts);
}

export async function listUserNotifications(db: DbExecutor, f: InboxFilter, page: { limit: number; offset: number }) {
  const where = inboxWhere(f);
  const [rows, totals] = await Promise.all([
    db
      .select({
        id: r.id,
        notificationId: r.notificationId,
        title: n.title,
        description: n.description,
        tag: n.tag,
        attachmentUrl: n.attachmentUrl,
        attachmentName: n.attachmentName,
        read: r.read,
        readAt: r.readAt,
        createdAt: n.createdAt,
      })
      .from(r)
      .innerJoin(n, eq(r.notificationId, n.id))
      .where(where)
      .orderBy(desc(r.createdAt))
      .limit(page.limit)
      .offset(page.offset),
    db.select({ total: count() }).from(r).innerJoin(n, eq(r.notificationId, n.id)).where(where),
  ]);
  return { rows, total: totals[0]?.total ?? 0 };
}

export function countUnread(db: DbExecutor, userId: string) {
  return db.$count(r, and(eq(r.userId, userId), eq(r.read, false)));
}

/** Marks one inbox row read; scoped to the owner so users can't touch other inboxes. */
export async function markRecipientRead(db: DbExecutor, userId: string, recipientId: string) {
  const rows = await db
    .update(r)
    .set({ read: true, readAt: new Date() })
    .where(and(eq(r.id, recipientId), eq(r.userId, userId)))
    .returning({ id: r.id });
  return rows.length;
}

export async function markAllRead(db: DbExecutor, userId: string) {
  const rows = await db
    .update(r)
    .set({ read: true, readAt: new Date() })
    .where(and(eq(r.userId, userId), eq(r.read, false)))
    .returning({ id: r.id });
  return rows.length;
}

/** Notifications sent by admins (Batman's "history"), newest first, with delivery/read stats. */
export async function listSentHistory(db: DbExecutor, page: { limit: number; offset: number }) {
  const adminIds = db.select({ id: u.id }).from(u).where(eq(u.role, "admin"));
  const where = inArray(n.senderId, adminIds);
  const [rows, totals] = await Promise.all([
    db
      .select({
        id: n.id,
        title: n.title,
        description: n.description,
        tag: n.tag,
        attachmentUrl: n.attachmentUrl,
        attachmentName: n.attachmentName,
        senderId: n.senderId,
        createdAt: n.createdAt,
        recipientCount: sql<number>`count(${r.id})::int`,
        readCount: sql<number>`count(${r.id}) filter (where ${r.read})::int`,
      })
      .from(n)
      .leftJoin(r, eq(r.notificationId, n.id))
      .where(where)
      .groupBy(n.id)
      .orderBy(desc(n.createdAt))
      .limit(page.limit)
      .offset(page.offset),
    db.$count(n, where),
  ]);
  return { rows, total: totals };
}

const userOption = { id: u.id, name: u.name, email: u.email } as const;

export function listUserOptions(db: DbExecutor) {
  return db.select(userOption).from(u).orderBy(asc(u.name));
}

export function searchUserOptions(db: DbExecutor, query: string, limit: number) {
  const q = query.trim();
  if (!q) return db.select(userOption).from(u).orderBy(desc(u.createdAt)).limit(limit);
  // Escape LIKE wildcards so a search for "%" or "_" is literal.
  const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  return db
    .select(userOption)
    .from(u)
    .where(or(ilike(u.name, pattern), ilike(u.email, pattern)))
    .orderBy(asc(u.name))
    .limit(limit);
}

export async function allUserIds(db: DbExecutor) {
  const rows = await db.select({ id: u.id }).from(u);
  return rows.map((row) => row.id);
}
