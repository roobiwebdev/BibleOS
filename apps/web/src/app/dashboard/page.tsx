import { api } from "@/server/trpc";
import { getSession } from "@/server/session";

import { visibleDashboardNav } from "./_components/nav";
import { DashboardHome } from "./dashboard-shell";

export default async function DashboardPage() {
  const [session, settings] = await Promise.all([getSession(), (await api()).settings.public()]);

  return <DashboardHome userName={session?.user.name} nav={visibleDashboardNav(settings)} />;
}
