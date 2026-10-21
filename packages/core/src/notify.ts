/**
 * SOURCE OF TRUTH KEYWORDS: notifyUser, notifyAdmins, createNotification, auto notifications, system sender
 * WHAT:  Creates in-app notifications for one user or for every admin.
 * WHY:   Batman's "automatic notifications" (sign-up, profile change, uploads, password change...)
 *        are fire-and-forget: they must never break the user's action, so errors are logged and swallowed.
 * WHERE: packages/auth hooks, packages/api routers, upload route.
 */
import "server-only";
import { eq, inArray } from "drizzle-orm";
import { schema, type DbExecutor } from "@starter/db";

import { createLogger } from "./logger";
import type { NotificationTag } from "./types";

const log = createLogger("notify");

export type NotificationInput = {
  title: string;
  description: string;
  tag: NotificationTag;
  senderId?: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
};

/** Inserts one notification addressed to the given users. Throws on failure (use inside transactions). */
export async function createNotification(db: DbExecutor, userIds: readonly string[], input: NotificationInput) {
  if (userIds.length === 0) return null;
  const [row] = await db
    .insert(schema.notification)
    .values({
      title: input.title,
      description: input.description,
      tag: input.tag,
      senderId: input.senderId ?? "system",
      attachmentUrl: input.attachmentUrl ?? null,
      attachmentName: input.attachmentName ?? null,
    })
    .returning();
  if (!row) return null;
  await db
    .insert(schema.notificationRecipient)
    .values(userIds.map((userId) => ({ notificationId: row.id, userId })))
    .onConflictDoNothing();
  return row;
}

export async function notifyUser(db: DbExecutor, userId: string, input: NotificationInput): Promise<void> {
  try {
    await createNotification(db, [userId], input);
  } catch (err) {
    log.warn("notifyUser failed", { title: input.title }, err);
  }
}

export async function notifyAdmins(db: DbExecutor, input: NotificationInput): Promise<void> {
  try {
    const admins = await db.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.role, "admin"));
    await createNotification(
      db,
      admins.map((a) => a.id),
      input,
    );
  } catch (err) {
    log.warn("notifyAdmins failed", { title: input.title }, err);
  }
}

export async function notifyUsers(db: DbExecutor, userIds: readonly string[], input: NotificationInput): Promise<void> {
  try {
    const existing = await db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(inArray(schema.user.id, [...userIds]));
    await createNotification(
      db,
      existing.map((u) => u.id),
      input,
    );
  } catch (err) {
    log.warn("notifyUsers failed", { title: input.title }, err);
  }
}
