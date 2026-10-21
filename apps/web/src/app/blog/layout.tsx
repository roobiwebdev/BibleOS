import { BRANDING } from "@starter/config/branding";
import Link from "next/link";

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

export default async function BlogLayout({ children }: { children: React.ReactNode }) {
  const { appName } = await (await api()).settings.public();
  const name = appName || BRANDING.appName;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border/40">
        <div className="max-w-2xl mx-auto px-4 flex h-12 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <BatLogo className="h-3.5 w-auto text-foreground" />
            <span className="text-[11px] font-semibold tracking-widest uppercase">{name}</span>
          </Link>
          <div className="flex items-center gap-1">
            <Link href="/blog" className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
              Blog
            </Link>
            <Link href="/login" className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border/40 py-4">
        <div className="max-w-2xl mx-auto px-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground/40">
          <span>
            &copy; {currentYear()} {name}
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
  );
}
