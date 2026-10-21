/**
 * SOURCE OF TRUTH KEYWORDS: landing page, home page, ReadyPage, site modes, countdown mode, waitlist mode, public site
 * WHAT:  Public home page. Shows the countdown, waitlist or combined launch page when those site
 *        modes are on (Admin > Site Settings), otherwise the starter landing page.
 * WHY:   Server Component: modes and branding are read once on the server through the settings
 *        router (secret-free public subset), so there is no client fetch or loading flash. Batman's
 *        in-browser setup wizard is gone; first-run setup is the local `pnpm bootstrap` CLI.
 * WHERE: route "/".
 */
import { Button } from "@starter/ui/components/button";
import { BRANDING } from "@starter/config/branding";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { api } from "@/server/trpc";

import { CountdownPage } from "./countdown-page";
import { CountdownWaitlistPage } from "./countdown-waitlist-page";
import { BrandMark, LandingThemeToggle } from "@/components/brand-mark";
import { WaitlistPage } from "./waitlist-page";

export default async function Page() {
  const caller = await api();
  const [modes, settings] = await Promise.all([caller.settings.siteModes(), caller.settings.public()]);

  if (modes.countdown && modes.waitlist) {
    return <CountdownWaitlistPage countdown={modes.countdown} waitlist={modes.waitlist} />;
  }
  if (modes.countdown) {
    return <CountdownPage settings={modes.countdown} />;
  }
  if (modes.waitlist) {
    return <WaitlistPage settings={modes.waitlist} />;
  }
  return (
    <ReadyPage
      appName={settings.appName || BRANDING.appName}
      appDescription={settings.appDescription || BRANDING.description}
      supportEmail={settings.supportEmail}
    />
  );
}

function ReadyPage({
  appName,
  appDescription,
  supportEmail,
}: {
  appName: string;
  appDescription: string;
  supportEmail: string;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border/40">
        <div className="max-w-2xl mx-auto px-4 flex h-12 items-center justify-between">
          <div className="flex items-center gap-2">
            <BrandMark className="h-3.5 w-auto text-foreground" />
            <span className="text-[11px] font-semibold tracking-widest uppercase">{appName}</span>
          </div>
          <div className="flex items-center gap-1">
            <LandingThemeToggle />
            <Link href="/blog">
              <Button variant="ghost" size="sm" className="text-[11px] h-7 text-muted-foreground">
                Blog
              </Button>
            </Link>
            <Link href="/pricing">
              <Button variant="ghost" size="sm" className="text-[11px] h-7 text-muted-foreground">
                Pricing
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" className="text-[11px] h-7 bg-foreground text-background hover:bg-foreground/90">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-md w-full py-16">
          <div className="mb-8">
            <BrandMark className="h-6 w-auto text-foreground mb-6" />
            <h1 className="text-xl font-semibold tracking-tight mb-2">{appName}</h1>
            <p className="text-xs text-muted-foreground leading-relaxed">{appDescription}</p>
          </div>

          <div className="mb-8">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 mb-2">Stack</p>
            <div className="flex flex-wrap gap-1.5">
              {STACK.map((s) => (
                <span key={s} className="text-[10px] px-2 py-1 border border-border/40 text-muted-foreground">
                  {s}
                </span>
              ))}
            </div>
          </div>

          <div className="mb-8">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 mb-2">
              Next steps
            </p>
            <div className="space-y-1.5 font-mono text-[11px]">
              <div className="flex items-center gap-2 px-2.5 py-1.5 bg-muted/30 border border-border/30">
                <span className="text-muted-foreground/40 select-none">$</span>
                <span className="text-foreground/80">pnpm bootstrap</span>
              </div>
              <div className="flex items-center gap-2 px-2.5 py-1.5 bg-muted/30 border border-border/30">
                <span className="text-muted-foreground/40 select-none">$</span>
                <span className="text-foreground/80">pnpm dev</span>
              </div>
            </div>
          </div>

          <div className="border border-dashed border-border/40 px-3.5 py-3">
            <p className="text-[10px] text-muted-foreground/50 leading-relaxed">
              Edit <code className="bg-muted/50 px-1 py-px font-mono text-[9px]">app/page.tsx</code> to replace this
              landing page with your own. Name, description and site modes live in Admin → General.
            </p>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <Link href="/signup">
              <Button size="sm" className="text-xs h-8 gap-1.5 bg-foreground text-background hover:bg-foreground/90">
                Create Account
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-xs h-8">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-border/40 py-4">
        <div className="max-w-2xl mx-auto px-4 flex flex-wrap justify-between items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground/40">
          <span>{appName}</span>
          <div className="flex items-center gap-x-3">
            <Link href="/legal/privacy" className="hover:text-muted-foreground transition-colors">
              Privacy
            </Link>
            <Link href="/legal/terms" className="hover:text-muted-foreground transition-colors">
              Terms
            </Link>
            {supportEmail && (
              <a href={`mailto:${supportEmail}`} className="hover:text-muted-foreground transition-colors">
                Contact
              </a>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}

// -- Shared --

const STACK = ["Next.js", "TypeScript", "tRPC", "Drizzle", "PostgreSQL", "Better Auth", "Tailwind", "shadcn/ui", "Nx"];
