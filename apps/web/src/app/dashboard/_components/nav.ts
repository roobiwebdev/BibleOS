/**
 * SOURCE OF TRUTH KEYWORDS: visibleDashboardNav, dashboard nav filter, requiresSetting, DashboardNavItem
 * WHAT:  DASHBOARD_NAV filtered by the runtime toggles an admin controls (organizations, invites).
 * WHY:   The module registry says which entries exist; app_settings says which are switched on now.
 * WHERE: dashboard layout (shell nav) and dashboard home (feature cards).
 */
import { DASHBOARD_NAV, type NavItem } from "@starter/config/modules";

export type DashboardToggles = { organizationsEnabled: boolean; invitesEnabled: boolean };

export function visibleDashboardNav(toggles: DashboardToggles): NavItem[] {
  return DASHBOARD_NAV.filter((item) => !item.requiresSetting || toggles[item.requiresSetting]);
}
