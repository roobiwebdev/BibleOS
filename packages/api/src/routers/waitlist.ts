/**
 * SOURCE OF TRUTH KEYWORDS: waitlistRouter, waitlist.join, joinWaitlist, waitlistEntry, waitlist mode, public form
 * WHAT:  Public "join the waitlist" form endpoint.
 * WHY:   Port of Batman's lib/actions/waitlist.ts. Anonymous, so it uses the tight publicForm rate
 *        limit and only accepts entries while waitlist mode is on. Re-joining with the same email
 *        updates the entry and reports success, so the form never reveals who is already listed.
 *        Waitlist UI settings come from settings.siteModes; the admin list lives in the admin router.
 * WHERE: apps/web/src/lib/actions/waitlist.ts -> waitlist-page.tsx, countdown-waitlist-page.tsx.
 */
import { TRPCError } from "@trpc/server";
import { schema } from "@starter/db";
import { z } from "zod";

import { RATE_LIMITS } from "../lib/rate-limit";
import { publicProcedure, router } from "../trpc";

export const waitlistJoinInput = z.object({
  email: z.email().trim().max(254),
  name: z.string().trim().max(120).optional(),
  company: z.string().trim().max(120).optional(),
});

export const waitlistRouter = router({
  join: publicProcedure({ rateLimit: RATE_LIMITS.publicForm, audit: { entity: "waitlist", action: "join" } })
    .input(waitlistJoinInput)
    .mutation(async ({ ctx, input }) => {
      const s = await ctx.services.settings.get();
      if (!s.waitlistMode) throw new TRPCError({ code: "FORBIDDEN", message: "Waitlist is not open" });

      // Only store the optional fields the form actually shows.
      const values = {
        email: input.email.toLowerCase(),
        name: s.waitlistShowName ? input.name || null : null,
        company: s.waitlistShowCompany ? input.company || null : null,
      };
      await ctx.db
        .insert(schema.waitlistEntry)
        .values(values)
        .onConflictDoUpdate({
          target: schema.waitlistEntry.email,
          set: { name: values.name, company: values.company },
        });
      return { success: true as const };
    }),
});
