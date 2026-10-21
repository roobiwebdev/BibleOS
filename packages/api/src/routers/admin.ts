// oxlint-disable-next-line typescript/triple-slash-reference -- geoip-country ships no types; this pulls the local typing into every program (api and web) that type-checks this router.
/// <reference path="../services/admin-geoip-country.d.ts" />
/**
 * SOURCE OF TRUTH KEYWORDS: adminRouter, admin.overview, admin.analytics, admin.waitlistEntries, admin.auditLog, admin dashboard metrics, user countries, audit log viewer
 * WHAT:  Admin-only read endpoints: the overview snapshot, the analytics charts, the waitlist
 *        list and the paginated audit log.
 * WHY:   Port of Batman's getOverview / getAnalytics / getWaitlistEntries (same metrics and
 *        shapes, so the pages are unchanged) plus the audit log viewer this starter adds.
 *        Settings reads and writes live in the settings router, not here.
 *        Countries come from session IP addresses resolved with geoip-country, as in Batman.
 * WHERE: apps/web/src/lib/actions/admin.ts -> admin overview, analytics, site settings and
 *        audit log pages.
 */
import geoip from "geoip-country";
import { z } from "zod";

import * as adminService from "../services/admin";
import {
  buildDailySeries,
  buildSparkline,
  countUserCountries,
  daysAgo,
  formatAuthProvider,
  percentOf,
  type GeoLookup,
} from "../services/admin-utils";
import { adminProcedure, router } from "../trpc";

const lookupCountry: GeoLookup = (ip) => {
  const hit = geoip.lookup(ip);
  return hit ? { country: hit.country, name: hit.name } : null;
};

export const auditLogInput = z.object({
  page: z.number().int().min(1).max(100_000).default(1),
  limit: z.number().int().min(1).max(100).default(25),
  entity: z.string().trim().min(1).max(64).optional(),
  userId: z.string().trim().min(1).max(128).optional(),
});

export const adminRouter = router({
  /** Snapshot for the admin home page. */
  overview: adminProcedure().query(async ({ ctx }) => {
    const db = ctx.db;
    const now = new Date();
    const oneDayAgo = daysAgo(now, 1);
    const sevenDaysAgo = daysAgo(now, 7);
    const thirtyDaysAgo = daysAgo(now, 30);

    const [
      totalUsers,
      usersLast7d,
      usersLast30d,
      onboardedUsers,
      dailyActiveUsers,
      weeklyActiveUsers,
      recentUsers,
      orgs,
      totalNotifications,
      recipients,
      recentNotifications,
      feedbackCounts,
      recentFeedback,
      signupDates,
      sessions,
    ] = await Promise.all([
      adminService.countUsers(db),
      adminService.countUsers(db, sevenDaysAgo),
      adminService.countUsers(db, thirtyDaysAgo),
      adminService.countOnboardedUsers(db),
      adminService.countActiveUsersSince(db, oneDayAgo),
      adminService.countActiveUsersSince(db, sevenDaysAgo),
      adminService.listRecentUsers(db, 5),
      adminService.countOrganizationsAndMembers(db),
      adminService.countNotifications(db),
      adminService.countNotificationRecipients(db),
      adminService.listRecentNotifications(db, 5),
      adminService.countFeedback(db),
      adminService.listRecentFeedback(db, 5),
      adminService.listSignupDatesSince(db, thirtyDaysAgo),
      adminService.listSessionsSince(db, thirtyDaysAgo),
    ]);

    return {
      stats: {
        totalUsers,
        usersLast7d,
        usersLast30d,
        dailyActiveUsers,
        weeklyActiveUsers,
        onboardingRate: percentOf(onboardedUsers, totalUsers),
        onboardedUsers,
        notificationReadRate: percentOf(recipients.total - recipients.unread, recipients.total),
        totalOrgs: orgs.totalOrgs,
        totalMembers: orgs.totalMembers,
        totalNotifications,
        totalFeedback: feedbackCounts.total,
        openFeedback: feedbackCounts.open,
      },
      sparkline: buildSparkline(now, signupDates, sessions),
      recentUsers,
      recentNotifications,
      recentFeedback,
      countries: countUserCountries(sessions, lookupCountry),
    };
  }),

  /** Growth, engagement, sign-up methods and countries for the analytics page (last 30 days). */
  analytics: adminProcedure().query(async ({ ctx }) => {
    const db = ctx.db;
    const now = new Date();
    const oneDayAgo = daysAgo(now, 1);
    const sevenDaysAgo = daysAgo(now, 7);
    const thirtyDaysAgo = daysAgo(now, 30);

    const [
      totalUsers,
      onboardedUsers,
      usersLast7d,
      usersLast30d,
      signupDates,
      sessions,
      dailyActiveUsers,
      weeklyActiveUsers,
      providers,
      orgs,
      recipients,
    ] = await Promise.all([
      adminService.countUsers(db),
      adminService.countOnboardedUsers(db),
      adminService.countUsers(db, sevenDaysAgo),
      adminService.countUsers(db, thirtyDaysAgo),
      adminService.listSignupDatesSince(db, thirtyDaysAgo),
      adminService.listSessionsSince(db, thirtyDaysAgo),
      adminService.countActiveUsersSince(db, oneDayAgo),
      adminService.countActiveUsersSince(db, sevenDaysAgo),
      adminService.accountProviderCounts(db),
      adminService.countOrganizationsAndMembers(db),
      adminService.countNotificationRecipients(db),
    ]);

    const series = buildDailySeries({ now, totalUsers, usersLast30d, signupDates, sessions });

    return {
      overview: {
        totalUsers,
        usersLast7d,
        usersLast30d,
        dailyActiveUsers,
        weeklyActiveUsers,
        onboardedUsers,
        onboardingRate: percentOf(onboardedUsers, totalUsers),
        notificationReadRate: percentOf(recipients.total - recipients.unread, recipients.total),
      },
      dailyData: series.dailyData,
      weeklySignups: series.weeklySignups,
      weeklyActive: series.weeklyActive,
      authProviders: providers.map((p) => ({ provider: formatAuthProvider(p.providerId), count: p.count })),
      countries: countUserCountries(sessions, lookupCountry),
      organizations: {
        totalOrgs: orgs.totalOrgs,
        avgMembersPerOrg: orgs.totalOrgs > 0 ? Number.parseFloat((orgs.totalMembers / orgs.totalOrgs).toFixed(1)) : 0,
      },
    };
  }),

  /** Latest waitlist sign-ups (Admin > Site Settings). */
  waitlistEntries: adminProcedure()
    .input(z.object({ limit: z.number().int().min(1).max(500).default(50) }).default({ limit: 50 }))
    .query(({ ctx, input }) => adminService.listWaitlistEntries(ctx.db, input.limit)),

  /** Paginated audit trail, filterable by entity and acting user. */
  auditLog: adminProcedure()
    .input(auditLogInput)
    .query(async ({ ctx, input }) => {
      const [{ rows, total }, entities] = await Promise.all([
        adminService.listAuditLog(
          ctx.db,
          { entity: input.entity, userId: input.userId },
          { limit: input.limit, offset: (input.page - 1) * input.limit },
        ),
        adminService.listAuditEntities(ctx.db),
      ]);
      return {
        rows,
        total,
        page: input.page,
        limit: input.limit,
        totalPages: Math.ceil(total / input.limit),
        entities,
      };
    }),
});
