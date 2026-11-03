import { Moon, Sun } from "lucide-react";

import { AppIcon } from "../components/logo";
import { REPO } from "../config";
import { COPY } from "../copy";
import { useSiteTheme } from "../lib/theme";

const LINKS = [
  { href: "#features", label: COPY.nav.features },
  { href: "#amharic", label: COPY.nav.amharic },
  { href: "#privacy", label: COPY.nav.privacy },
  { href: "#install", label: COPY.nav.install },
  { href: "#faq", label: COPY.nav.faq },
] as const;

/**
 * SOURCE OF TRUTH KEYWORDS: SiteNav, header, navigation, theme toggle, skip link
 * WHAT:  The sticky page header: logo, section links, GitHub, theme toggle and a download link.
 * WHY:   Short pages still need a way back to Download from anywhere; the section links hide on
 *        small screens to keep the bar on one line.
 * WHERE: app.tsx.
 */
export function SiteNav() {
  const [theme, toggle] = useSiteTheme();
  return (
    <header className="sticky top-0 z-40 border-b border-transparent bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:rounded-lg focus:bg-card focus:px-3 focus:py-2"
      >
        {COPY.nav.skip}
      </a>
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:px-6">
        <a href="#top" className="mr-auto flex items-center gap-2.5 rounded-lg">
          <AppIcon size={32} />
          <span className="text-[16px] font-semibold tracking-tight">BibleOS</span>
        </a>
        <ul className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {l.label}
              </a>
            </li>
          ))}
          <li>
            <a
              href={REPO.url}
              className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {COPY.nav.github}
            </a>
          </li>
        </ul>
        <button
          type="button"
          onClick={toggle}
          aria-label={theme === "night" ? COPY.nav.toSepia : COPY.nav.toNight}
          className="grid size-10 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {theme === "night" ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
        </button>
        <a
          href="#download"
          className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          {COPY.nav.download}
        </a>
      </nav>
    </header>
  );
}
