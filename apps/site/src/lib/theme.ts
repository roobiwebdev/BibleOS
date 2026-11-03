import { useCallback, useSyncExternalStore } from "react";

export type SiteTheme = "sepia" | "night";

const KEY = "bibleos-site-theme";

function current(): SiteTheme {
  return document.documentElement.dataset.theme === "night" ? "night" : "sepia";
}

function apply(theme: SiteTheme) {
  document.documentElement.dataset.theme = theme;
}

function savedTheme(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** Notifies on any change of the root theme attribute, and follows the system until a choice is saved. */
function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  const onSystem = () => {
    if (!savedTheme()) apply(query.matches ? "night" : "sepia");
  };
  query.addEventListener("change", onSystem);
  return () => {
    observer.disconnect();
    query.removeEventListener("change", onSystem);
  };
}

/**
 * SOURCE OF TRUTH KEYWORDS: useSiteTheme, sepia, night, theme toggle, data-theme, colour scheme
 * WHAT:  The page theme: Sepia (the app's default) or Night, following the system until the
 *        visitor picks one.
 * WHY:   The same tokens as the app (styles.css) keep the site looking like BibleOS. index.html
 *        sets the attribute before first paint; this hook reads it and changes it. Storage may
 *        be unavailable (private windows), so every access is guarded.
 * WHERE: sections/nav.tsx.
 */
export function useSiteTheme(): [SiteTheme, () => void] {
  const theme = useSyncExternalStore(subscribe, current, () => "sepia" as const);
  const toggle = useCallback(() => {
    const next: SiteTheme = current() === "night" ? "sepia" : "night";
    apply(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // The choice lasts for this page view only.
    }
  }, []);
  return [theme, toggle];
}
