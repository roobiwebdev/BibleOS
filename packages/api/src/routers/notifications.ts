/**
 * SOURCE OF TRUTH KEYWORDS: notificationsRouter, notifications.send, notifications.sendToAll, notifications.list, notifications.markRead, notifications.markAllRead, notifications.unreadCount, notifications.history, notifications.users, notifications.searchUsers
 * WHAT:  The in-app inbox (list, filter, mark read, unread badge) and the admin broadcast screen
 *        (compose to everyone or picked users, sent history with delivery/read stats).
 * WHY:   Port of Batman's lib/actions/notifications.ts onto the procedure builder. Tags are
 *        validated against NOTIFICATION_TAGS; attachments are full storage URLs produced by the
 *        upload route, so the router only stores them. Mark-read calls are not audited (noise).
 * WHERE: lib/actions/notifications.ts (web), dashboard layout (unread badge), dashboard and admin
 *        notifications pages.
 */
import { createNotification } from "@starter/core/notify";
import { NOTIFICATION_TAGS } from "@starter/core/types";
import { schema } from "@starter/db";
import { TRPCError } from "@trpc/server";
import { inArray } from "drizzle-orm";
import { z } from "zod";

import * as notificationsService from "../services/notifications";
import { pageCount, toPageWindow } from "../services/notifications-utils";
import { adminProcedure, protectedProcedure, router } from "../trpc";

/** Admin compose form fields shared by "specific users" and "everyone". */
export const notificationComposeInput = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().min(1, "Description is required").max(5000),
  tag: z.enum(NOTIFICATION_TAGS),
  attachmentUrl: z.url().max(2000).optional(),
  attachmentName: z.string().trim().max(255).optional(),
});

const pageInput = {
  page: z.number().int().min(1).max(10_000).optional(),
  limit: z.number().int().min(1).max(100).optional(),
};

export const notificationsRouter = router({
  /** Sends one notification to the chosen users (unknown ids are skipped). */
  send: adminProcedure({ audit: { entity: "notification", action: "send" } })
    .input(notificationComposeInput.extend({ recipientIds: z.array(z.string().min(1)).min(1).max(10_000) }))
    .mutation(async ({ ctx, input }) => {
      const { recipientIds, ...message } = input;
      const existing = await ctx.db
        .select({ id: schema.user.id })
        .from(schema.user)
        .where(inArray(schema.user.id, [...new Set(recipientIds)]));
      if (existing.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Select at least one recipient" });
      const row = await createNotification(
        ctx.db,
        existing.map((u) => u.id),
        { ...message, senderId: ctx.session.user.id },
      );
      if (!row) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to send notification" });
      return { id: row.id, recipientCount: existing.length };
    }),

  /** Sends one notification to every user. */
  sendToAll: adminProcedure({ audit: { entity: "notification", action: "sendToAll" } })
    .input(notificationComposeInput)
    .mutation(async ({ ctx, input }) => {
      const userIds = await notificationsService.allUserIds(ctx.db);
      const row = await createNotification(ctx.db, userIds, { ...input, senderId: ctx.session.user.id });
      if (!row) throw new TRPCError({ code: "BAD_REQUEST", message: "There are no users to notify" });
      return { id: row.id, recipientCount: userIds.length };
    }),

  /** The signed-in user's inbox with tag / unread filters and pagination. */
  list: protectedProcedure()
    .input(
      z
        .object({
          tag: z.union([z.enum(NOTIFICATION_TAGS), z.literal("all")]).optional(),
          unreadOnly: z.boolean().optional(),
          ...pageInput,
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const win = toPageWindow(input?.page, input?.limit);
      const tag = input?.tag && input.tag !== "all" ? input.tag : null;
      const { rows, total } = await notificationsService.listUserNotifications(
        ctx.db,
        { userId: ctx.session.user.id, tag, unreadOnly: input?.unreadOnly ?? false },
        win,
      );
      return { notifications: rows, total, pages: pageCount(total, win.limit), currentPage: win.page };
    }),

  markRead: protectedProcedure({ audit: false })
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const updated = await notificationsService.markRecipientRead(ctx.db, ctx.session.user.id, input.id);
      return { success: updated > 0 };
    }),

  markAllRead: protectedProcedure({ audit: false }).mutation(async ({ ctx }) => {
    const updated = await notificationsService.markAllRead(ctx.db, ctx.session.user.id);
    return { success: true, updated };
  }),

  unreadCount: protectedProcedure().query(({ ctx }) => notificationsService.countUnread(ctx.db, ctx.session.user.id)),

  /** Notifications sent by admins, with recipient and read counts. */
  history: adminProcedure()
    .input(z.object(pageInput).optional())
    .query(async ({ ctx, input }) => {
      const win = toPageWindow(input?.page, input?.limit);
      const { rows, total } = await notificationsService.listSentHistory(ctx.db, win);
      return { notifications: rows, total, pages: pageCount(total, win.limit) };
    }),

  /** Every user (id, name, email) for recipient pickers. */
  users: adminProcedure().query(({ ctx }) => notificationsService.listUserOptions(ctx.db)),

  /** Recipient search by name or email; empty query returns the newest users. */
  searchUsers: adminProcedure()
    .input(z.object({ query: z.string().max(200), limit: z.number().int().min(1).max(100).optional() }))
    .query(({ ctx, input }) => notificationsService.searchUserOptions(ctx.db, input.query, input.limit ?? 20)),
});
