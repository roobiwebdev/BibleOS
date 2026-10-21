/**
 * SOURCE OF TRUTH KEYWORDS: userRouter, user.me, user.updateProfile, user.completeOnboarding, profile, onboarding, avatar
 * WHAT:  The signed-in user's own profile: read it, edit name/bio/avatar, finish onboarding.
 * WHY:   Port of Batman's lib/actions/user.ts. The avatar is a full storage URL returned by the
 *        upload route, so only http(s) URLs are accepted. Each change drops a notification in
 *        the user's own inbox, as Batman did. App settings moved to the settings router.
 * WHERE: lib/actions/user.ts (web), dashboard layout guards, profile settings, onboarding wizard.
 */
import { notifyUser } from "@starter/core/notify";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import * as userService from "../services/user";
import { describeProfileChanges } from "../services/user-utils";
import { protectedProcedure, router } from "../trpc";

const imageUrl = z.url({ protocol: /^https?$/ }).max(2000);

export const updateProfileInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(100).optional(),
  bio: z.string().trim().max(1000).optional(),
  image: z.union([imageUrl, z.literal("")]).optional(),
});

export const userRouter = router({
  /** Pending organization invitations addressed to the signed-in user. */
  myInvitations: protectedProcedure().query(({ ctx }) =>
    userService.listPendingInvitationsForEmail(ctx.db, ctx.session.user.email),
  ),

  /** Fresh profile row (bio, onboarding and verification flags) for guards and forms. */
  me: protectedProcedure().query(async ({ ctx }) => {
    const profile = await userService.findProfile(ctx.db, ctx.session.user.id);
    if (!profile) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    return profile;
  }),

  updateProfile: protectedProcedure({ audit: { entity: "user", action: "updateProfile" } })
    .input(updateProfileInput)
    .mutation(async ({ ctx, input }) => {
      const patch = {
        name: input.name,
        bio: input.bio,
        // An empty string removes the avatar.
        image: input.image === undefined ? undefined : input.image || null,
      };
      const row = await userService.updateUserProfile(ctx.db, ctx.session.user.id, patch);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

      const changes = describeProfileChanges(patch);
      if (changes.length > 0) {
        await notifyUser(ctx.db, ctx.session.user.id, {
          title: "Profile updated",
          description: `You updated your ${changes.join(", ")}.`,
          tag: "update",
          senderId: ctx.session.user.id,
        });
      }
      return { success: true, id: row.id };
    }),

  completeOnboarding: protectedProcedure({ audit: { entity: "user", action: "completeOnboarding" } }).mutation(
    async ({ ctx }) => {
      const row = await userService.markOnboardingCompleted(ctx.db, ctx.session.user.id);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      await notifyUser(ctx.db, ctx.session.user.id, {
        title: "Onboarding completed",
        description: "You've completed the onboarding flow. Welcome to the dashboard!",
        tag: "general",
        senderId: ctx.session.user.id,
      });
      return { success: true, id: row.id };
    },
  ),
});
