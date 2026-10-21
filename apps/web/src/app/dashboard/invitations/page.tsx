import { Mail } from "lucide-react";
import { Suspense } from "react";

import { InvitationsSkeleton } from "@/components/skeletons";
import { getAuthConfig } from "@/lib/actions/settings";

import { InvitationsView } from "./_components/invitations-view";

/** Invitations the signed-in user received. `?id=<invitationId>` (from the email) opens one directly. */
export default async function InvitationsPage() {
  const config = await getAuthConfig();

  if (!config.invitesEnabled) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Invitations</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Invitations are currently disabled by the admin.</p>
        </div>
        <div className="flex flex-col items-center justify-center py-16 border border-dashed border-border">
          <Mail className="h-10 w-10 text-muted-foreground/20 mb-4" />
          <p className="text-xs text-muted-foreground">This feature is not enabled.</p>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<InvitationsSkeleton />}>
      <InvitationsView organizationsEnabled={config.organizationsEnabled} />
    </Suspense>
  );
}
