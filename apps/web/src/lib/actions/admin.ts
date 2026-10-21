"use server";
/**
 * SOURCE OF TRUTH KEYWORDS: admin actions, getOverview, getAnalytics, getWaitlistEntries, getAuditLog
 * WHAT:  Server-action adapters over the admin router (no logic here).
 * WHY:   Keeps Batman's function names so the admin pages call the same functions. Settings
 *        reads/writes (updateAppSettings, getApiKeys, saveApiKeys, getLegalContent) moved to
 *        lib/actions/settings.ts.
 * WHERE: admin overview, analytics, site settings and audit log pages.
 */
import type { RouterInputs } from "@starter/api";

import { api } from "@/server/trpc";

export async function getOverview() {
  return (await api()).admin.overview();
}

export async function getAnalytics() {
  return (await api()).admin.analytics();
}

export async function getWaitlistEntries(limit = 50) {
  return (await api()).admin.waitlistEntries({ limit });
}

export async function getAuditLog(input: RouterInputs["admin"]["auditLog"]) {
  return (await api()).admin.auditLog(input);
}
