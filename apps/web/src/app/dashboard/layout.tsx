import { resolveUserGate } from "@starter/api/services/user-utils";
import { isModuleEnabled } from "@starter/config/modules";
import { redirect } from "next/navigation";

import { requireSession } from "@/server/session";
import { api } from "@/server/trpc";

import { visibleDashboardNav } from "./_components/nav";
import { DashboardShell } from "./dashboard-shell";

/**
 * Guards every /dashboard page in Batman's order: signed in -> maintenance (non-admins) ->
 * verified email (when required) -> onboarding (when enabled). Then renders the shell with the
 * module nav and the unread notification badge.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const caller = await api();
  const settings = await caller.settings.public();

  const gate = resolveUserGate({ user: session.user, settings });
  if (gate) redirect(gate);

  const unreadCount = isModuleEnabled("notifications") ? await caller.notifications.unreadCount() : 0;

  return (
    <DashboardShell
      user={{
        name: session.user.name,
        email: session.user.email,
        image: session.user.image ?? null,
        isAdmin: session.user.role === "admin",
      }}
      nav={visibleDashboardNav(settings)}
      unreadNotifications={unreadCount}
      showPricing={isModuleEnabled("billing")}
    >
      {children}
    </DashboardShell>
  );
}
