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
 * WHAT:  The floating page header: a rounded bar with the logo, section links, GitHub, theme
 *        toggle and a download link, inset from the top and edges of the window.
 * WHY:   Short pages still need a way back to Download from anywhere; the section links hide on
 *        small screens to keep the bar on one line.
 * WHERE: app.tsx.
 */
export function SiteNav() {
  const [theme, toggle] = useSiteTheme();
  return (
    <header className="fixed inset-x-0 top-0 z-40 px-3 pt-3 sm:px-6 sm:pt-4">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:rounded-lg focus:bg-card focus:px-3 focus:py-2"
      >
        {COPY.nav.skip}
      </a>
      <nav
        aria-label="Main"
        className="mx-auto flex h-14 max-w-6xl items-center gap-1 rounded-full border bg-background/75 py-2 pr-2 pl-4 shadow-sm backdrop-blur-md sm:gap-2 sm:pl-5"
      >
        <a href="#top" className="mr-auto flex items-center gap-2.5 rounded-lg">
          <AppIcon size={28} />
          <span className="text-[17px] font-semibold tracking-tight">BibleOS</span>
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
          className="rounded-full border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-xs transition-colors hover:bg-muted"
        >
          {COPY.nav.download}
        </a>
      </nav>
    </header>
  );
}
