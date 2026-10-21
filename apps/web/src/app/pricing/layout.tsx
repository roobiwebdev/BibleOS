import { BRANDING } from "@starter/config/branding";
import Link from "next/link";

import { AuthVisual } from "@/components/auth-visual";
import { api } from "@/server/trpc";

/** Footer year; a module-level helper keeps render pure for the linter. */
const currentYear = () => new Date().getFullYear();

function BatLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 40" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M50 0C50 0 42 14 30 18C18 22 0 18 0 18C0 18 12 28 20 32C28 36 50 40 50 40C50 40 72 36 80 32C88 28 100 18 100 18C100 18 82 22 70 18C58 14 50 0 50 0Z" />
    </svg>
  );
}

export default async function PricingLayout({ children }: { children: React.ReactNode }) {
  const { appName } = await (await api()).settings.public();
  const name = appName || BRANDING.appName;

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left — content side */}
      <div className="w-full lg:w-[45%] xl:w-[40%] flex flex-col min-h-screen">
        <header className="border-b border-border/40 lg:border-b-0">
          <div className="px-6 sm:px-8 lg:px-10">
            <div className="flex h-12 items-center justify-between">
              <Link href="/" className="flex items-center gap-2">
                <BatLogo className="h-3.5 w-auto text-foreground" />
                <span className="text-[11px] font-semibold tracking-widest uppercase">{name}</span>
              </Link>
              <Link href="/" className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                Back
              </Link>
            </div>
          </div>
        </header>

        <main className="flex-1 flex flex-col px-6 sm:px-8 lg:px-10 py-12">{children}</main>

        <footer className="py-4 px-6 sm:px-8 lg:px-10">
          <p className="text-[10px] text-muted-foreground/30">
            &copy; {currentYear()} {name}
          </p>
        </footer>
      </div>

      {/* Right — visual side (hidden on mobile) */}
      <div className="hidden lg:block lg:w-[55%] xl:w-[60%] border-l border-border/40">
        <AuthVisual />
      </div>
    </div>
  );
}
