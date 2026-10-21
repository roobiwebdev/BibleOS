import { Building2 } from "lucide-react";

import { getAuthConfig } from "@/lib/actions/settings";
import { requireSession } from "@/server/session";

import { OrganizationsView } from "./_components/organizations-view";

export default async function OrganizationsPage() {
  const [session, config] = await Promise.all([requireSession(), getAuthConfig()]);

  if (!config.organizationsEnabled) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Organizations</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Organizations are currently disabled by the admin.</p>
        </div>
        <div className="flex flex-col items-center justify-center py-16 border border-dashed border-border">
          <Building2 className="h-10 w-10 text-muted-foreground/20 mb-4" />
          <p className="text-xs text-muted-foreground">This feature is not enabled.</p>
        </div>
      </div>
    );
  }

  return <OrganizationsView invitesEnabled={config.invitesEnabled} currentUserId={session.user.id} />;
}
