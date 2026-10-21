"use client";
/**
 * SOURCE OF TRUTH KEYWORDS: BrandMark, logo, LandingThemeToggle, landing header, public site chrome, theme icon toggle
 * WHAT:  The small brand mark and one-click light/dark toggle used by the public landing views.
 * WHY:   Batman copied both into every landing variant (ready, waitlist, countdown, combined);
 *        one copy keeps the public pages visually identical.
 * WHERE: app/page.tsx, waitlist-page.tsx, countdown-page.tsx, countdown-waitlist-page.tsx.
 */
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 40"
      fill="currentColor"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Neutral "stacked layers" mark. Replace with your product logo when rebranding. */}
      <path d="M50 2 80 14 50 26 20 14Z" />
      <path d="M26 21.5 50 31l24-9.5 6 2.5-30 12-30-12Z" opacity="0.55" />
    </svg>
  );
}

export function LandingThemeToggle() {
  const { theme, setTheme } = useTheme();
  // false during SSR and hydration, true afterwards: avoids an icon mismatch.
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  return (
    <button
      type="button"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
      aria-label="Toggle theme"
    >
      {mounted && theme === "dark" ? (
        <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
          <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M8 1v2M8 13v2M1 8h2M13 8h2M3.17 3.17l1.42 1.42M11.41 11.41l1.42 1.42M3.17 12.83l1.42-1.42M11.41 4.59l1.42-1.42"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
          <path
            d="M13.5 8.5a5.5 5.5 0 0 1-6-6 5.5 5.5 0 1 0 6 6Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}
