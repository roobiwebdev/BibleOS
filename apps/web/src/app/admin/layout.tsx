/**
 * SOURCE OF TRUTH KEYWORDS: AdminLayout, admin shell, admin guard, requireAdmin, admin sidebar
 * WHAT:  Shell for every /admin page: role guard, fixed sidebar on desktop, tabs on mobile.
 * WHY:   Redirecting here keeps non-admins out of the UI; every admin procedure re-checks the
 *        role server-side, so this guard is UX, not the security boundary.
 * WHERE: all routes under apps/web/src/app/admin.
 */
import { requireAdmin } from "@/server/session";

import { AdminMobileNav, AdminSidebar } from "./admin-sidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <div className="min-h-screen bg-background">
      <div className="flex min-h-screen">
        <AdminSidebar />
        <div className="flex-1 p-5 md:p-8 min-w-0 md:ml-48">
          <AdminMobileNav />
          {children}
        </div>
      </div>
    </div>
  );
}
