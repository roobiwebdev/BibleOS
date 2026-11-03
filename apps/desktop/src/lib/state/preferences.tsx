import { commands } from "@starter/local-api/api";
import { ACCENTS, DEFAULT_PREFERENCES, LINE_WIDTH_IDS, THEME_IDS, type Preferences } from "@starter/local-api/schemas";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { MESSAGES, type Messages } from "../../i18n/messages";
import { callCommand } from "../data/local-api";
import { setDockIcon } from "../native";

/**
 * SOURCE OF TRUTH KEYWORDS: Preferences, usePreferences, useT, ThemeId, ACCENTS, AccentId, reading settings
 * WHAT:  The reader's preferences (theme, accent, type size, language, calendar, translations,
 *        habit rules) and their effect on the page: theme attributes, CSS variables, lang.
 * WHY:   One provider applies appearance at the document root so every screen and component
 *        follows the same tokens. The shape and defaults are local-api's settings schema; values
 *        load from the study database and every change is saved back through settings.set.
 * WHERE: every screen (useT for copy), settings page, reader, Today and Progress.
 */
export { ACCENTS, LINE_WIDTH_IDS };
export type { Preferences };
export type ThemeId = (typeof THEME_IDS)[number];
export type AccentId = (typeof ACCENTS)[number];
export type LineWidth = (typeof LINE_WIDTH_IDS)[number];

/** Reading line length, in em of the scripture font. */
export const LINE_WIDTHS: Record<LineWidth, number> = { narrow: 30, normal: 34, wide: 40 };

interface PreferencesContext {
  prefs: Preferences;
  /** The theme actually shown ("system" resolved to paper or night). */
  resolvedTheme: Exclude<ThemeId, "system">;
  update: (patch: Partial<Preferences>) => void;
}

const Context = createContext<PreferencesContext | null>(null);

function useSystemDark(): boolean {
  const [dark, setDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setDark(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return dark;
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);

  // Load saved preferences once; until then the defaults show.
  useEffect(() => {
    void callCommand(commands.settings.get, {})
      .then(setPrefs)
      .catch(() => undefined);
  }, []);
  const systemDark = useSystemDark();
  const resolvedTheme = prefs.theme === "system" ? (systemDark ? "night" : "paper") : prefs.theme;

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolvedTheme;
    setDockIcon(resolvedTheme);
    root.classList.toggle("dark", resolvedTheme === "night");
    root.lang = prefs.locale;
    root.dataset.accent = prefs.accent;
    root.style.setProperty("--reading-size", `${prefs.textSize}px`);
    root.style.setProperty("--reading-leading", String(prefs.lineSpacing));
    root.style.setProperty("--reading-measure", `${LINE_WIDTHS[prefs.lineWidth]}em`);
  }, [prefs, resolvedTheme]);

  const value = useMemo(
    () => ({
      prefs,
      resolvedTheme,
      update: (patch: Partial<Preferences>) => {
        // Show the change at once, then save it; the saved value wins if they differ.
        setPrefs((p) => ({ ...p, ...patch }));
        void callCommand(commands.settings.set, patch)
          .then(setPrefs)
          .catch(() => undefined);
      },
    }),
    [prefs, resolvedTheme],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function usePreferences(): PreferencesContext {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("usePreferences must be used inside PreferencesProvider");
  return ctx;
}

/** Interface copy in the reader's chosen app language. */
export function useT(): Messages {
  return MESSAGES[usePreferences().prefs.locale];
}
