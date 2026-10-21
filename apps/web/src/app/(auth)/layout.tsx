import { resolveUserGate } from "@starter/api/services/user-utils";
import Link from "next/link";

import { BrandMark } from "@/components/brand-mark";
import { redirect } from "next/navigation";

import { AuthVisual } from "@/components/auth-visual";
import { getSession } from "@/server/session";
import { api } from "@/server/trpc";

const currentYear = () => new Date().getFullYear();

/** Login/sign-up shell. Signed-in visitors are sent on (verify email, maintenance, dashboard). */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const [session, settings] = await Promise.all([getSession(), (await api()).settings.public()]);

  if (session) {
    redirect(resolveUserGate({ user: session.user, settings }) ?? "/dashboard");
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left — form side */}
      <div className="w-full lg:w-[45%] xl:w-[40%] flex flex-col min-h-screen">
        <header className="border-b border-border/40 lg:border-b-0">
          <div className="px-6 sm:px-8 lg:px-10">
            <div className="flex h-12 items-center justify-between">
              <Link href="/" className="flex items-center gap-2">
                <BrandMark className="h-3.5 w-auto text-foreground" />
                <span className="text-[11px] font-semibold tracking-widest uppercase">{settings.appName}</span>
              </Link>
              <Link href="/" className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                Back
              </Link>
            </div>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center px-6 sm:px-8 lg:px-10 py-12">
          <div className="w-full max-w-xs">{children}</div>
        </main>

        <footer className="py-4 px-6 sm:px-8 lg:px-10">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground/30">
            <span>
              &copy; {currentYear()} {settings.appName}
            </span>
            <Link href="/legal/privacy" className="hover:text-muted-foreground/60 transition-colors">
              Privacy
            </Link>
            <Link href="/legal/terms" className="hover:text-muted-foreground/60 transition-colors">
              Terms
            </Link>
          </div>
        </footer>
      </div>

      {/* Right — visual side (hidden on mobile) */}
      <div className="hidden lg:block lg:w-[55%] xl:w-[60%] border-l border-border/40">
        <AuthVisual />
      </div>
    </div>
  );
}
