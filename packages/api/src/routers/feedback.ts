/**
 * SOURCE OF TRUTH KEYWORDS: feedbackRouter, feedback.submit, feedback.mine, feedback.adminList, feedback.updateStatus, feedback.stats, feedback triage
 * WHAT:  Users send feedback from the dashboard; admins triage it (filter, status, internal note).
 * WHY:   Port of Batman's lib/actions/feedback.ts. Categories and statuses come from
 *        @starter/config/content so the dialog, admin page and validation share one list.
 *        Submissions are rate limited like a public form to stop spam from a single account.
 * WHERE: lib/actions/feedback.ts (web), FeedbackDialog, admin feedback page.
 */
import { FEEDBACK_CATEGORY_VALUES, FEEDBACK_STATUSES } from "@starter/config/content";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { RATE_LIMITS } from "../lib/rate-limit";
import * as feedbackService from "../services/feedback";
import { pageCount, toPageWindow } from "../services/notifications-utils";
import { adminProcedure, protectedProcedure, router } from "../trpc";

export const feedbackSubmitInput = z.object({
  category: z.enum(FEEDBACK_CATEGORY_VALUES),
  message: z.string().trim().min(1, "Message is required").max(2000),
});

export const feedbackRouter = router({
  submit: protectedProcedure({ rateLimit: RATE_LIMITS.publicForm, audit: { entity: "feedback", action: "submit" } })
    .input(feedbackSubmitInput)
    .mutation(async ({ ctx, input }) => {
      const row = await feedbackService.insertFeedback(ctx.db, { userId: ctx.session.user.id, ...input });
      if (!row) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to send feedback" });
      return row;
    }),

  /** The signed-in user's latest 20 submissions. */
  mine: protectedProcedure().query(({ ctx }) => feedbackService.listUserFeedback(ctx.db, ctx.session.user.id, 20)),

  adminList: adminProcedure()
    .input(
      z
        .object({
          page: z.number().int().min(1).max(10_000).optional(),
          limit: z.number().int().min(1).max(100).optional(),
          category: z.union([z.enum(FEEDBACK_CATEGORY_VALUES), z.literal("all")]).optional(),
          status: z.union([z.enum(FEEDBACK_STATUSES), z.literal("all")]).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const win = toPageWindow(input?.page, input?.limit);
      const category = input?.category && input.category !== "all" ? input.category : null;
      const status = input?.status && input.status !== "all" ? input.status : null;
      const { items, total } = await feedbackService.listFeedback(ctx.db, { category, status }, win);
      return { feedback: items, total, pages: pageCount(total, win.limit), currentPage: win.page };
    }),

  updateStatus: adminProcedure({ audit: { entity: "feedback", action: "updateStatus" } })
    .input(
      z.object({
        id: z.string().min(1),
        status: z.enum(FEEDBACK_STATUSES),
        adminNote: z.string().trim().max(2000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...patch } = input;
      const row = await feedbackService.updateFeedback(ctx.db, id, patch);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Feedback not found" });
      return row;
    }),

  stats: adminProcedure().query(({ ctx }) => feedbackService.feedbackStats(ctx.db)),
});
