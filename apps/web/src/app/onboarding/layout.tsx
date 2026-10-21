import { resolveUserGate } from "@starter/api/services/user-utils";
import Link from "next/link";

import { BrandMark } from "@/components/brand-mark";
import { redirect } from "next/navigation";

import { AuthVisual } from "@/components/auth-visual";
import { getSession } from "@/server/session";
import { api } from "@/server/trpc";

const currentYear = () => new Date().getFullYear();

/** Onboarding shell. Only signed-in users who still need onboarding (and it is enabled) stay here. */
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const settings = await (await api()).settings.public();

  const gate = resolveUserGate({ user: session.user, settings });
  if (gate === "/maintenance" || gate === "/verify-email") redirect(gate);
  // Already onboarded, or onboarding switched off.
  if (gate !== "/onboarding") redirect("/dashboard");

  return (
    <div className="min-h-screen flex bg-background">
      <div className="w-full lg:w-[45%] xl:w-[40%] flex flex-col min-h-screen">
        <header className="border-b border-border/40 lg:border-b-0">
          <div className="px-6 sm:px-8 lg:px-10">
            <div className="flex h-12 items-center justify-between">
              <Link href="/" className="flex items-center gap-2">
                <BrandMark className="h-3.5 w-auto text-foreground" />
                <span className="text-[11px] font-semibold tracking-widest uppercase">{settings.appName}</span>
              </Link>
              <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Getting started</span>
            </div>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center px-6 sm:px-8 lg:px-10 py-12">
          <div className="w-full max-w-sm">{children}</div>
        </main>

        <footer className="py-4 px-6 sm:px-8 lg:px-10">
          <p className="text-[10px] text-muted-foreground/30">
            &copy; {currentYear()} {settings.appName}
          </p>
        </footer>
      </div>

      <div className="hidden lg:block lg:w-[55%] xl:w-[60%] border-l border-border/40">
        <AuthVisual />
      </div>
    </div>
  );
}
