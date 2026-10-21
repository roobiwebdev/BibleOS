import { BRANDING } from "@starter/config/branding";
import { Wrench } from "lucide-react";
import { redirect } from "next/navigation";

import { SignOutButton } from "@/components/sign-out-button";
import { getSession, isAdmin } from "@/server/session";
import { api } from "@/server/trpc";

export default async function MaintenancePage() {
  const session = await getSession();

  // Admins should not see this page — redirect to dashboard
  if (isAdmin(session)) {
    redirect("/dashboard");
  }

  const settings = await (await api()).settings.public();

  const message =
    settings.maintenanceMessage.trim() || "We're performing scheduled maintenance. We'll be back shortly.";
  const appName = settings.appName.trim() || BRANDING.appName;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="rounded-full bg-muted p-4">
            <Wrench className="size-10 text-muted-foreground" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Under Maintenance</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">{message}</p>
        </div>
        {session?.user ? (
          <SignOutButton />
        ) : (
          <p className="text-xs text-muted-foreground">{appName} · Check back soon</p>
        )}
      </div>
    </div>
  );
}
