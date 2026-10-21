/**
 * SOURCE OF TRUTH KEYWORDS: appRouter, AppRouter, createCaller, root router, mount router
 * WHAT:  Mounts every feature router. Adding a feature = one line here.
 * WHERE: apps/web tRPC route + server caller, apps/native client (type only).
 */
import { adminRouter } from "./routers/admin";
import { billingRouter } from "./routers/billing";
import { blogRouter } from "./routers/blog";
import { feedbackRouter } from "./routers/feedback";
import { notificationsRouter } from "./routers/notifications";
import { settingsRouter } from "./routers/settings";
import { userRouter } from "./routers/user";
import { waitlistRouter } from "./routers/waitlist";
import { createCallerFactory, publicProcedure, router } from "./trpc";

export const appRouter = router({
  health: publicProcedure().query(() => ({ ok: true, time: new Date() })),
  settings: settingsRouter,
  admin: adminRouter,
  user: userRouter,
  notifications: notificationsRouter,
  feedback: feedbackRouter,
  blog: blogRouter,
  waitlist: waitlistRouter,
  billing: billingRouter,
});

export type AppRouter = typeof appRouter;
export const createCaller = createCallerFactory(appRouter);
