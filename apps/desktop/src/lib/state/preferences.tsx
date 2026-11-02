import type { Locale } from "@starter/bible-core/books";
import type { CalendarSystem } from "@starter/bible-core/calendar";
import { DEFAULT_STREAK_RULES, type StreakRules } from "@starter/bible-core/habits";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { MESSAGES, type Messages } from "../../i18n/messages";

/**
 * SOURCE OF TRUTH KEYWORDS: Preferences, usePreferences, useT, ThemeId, ACCENTS, AccentId, reading settings
 * WHAT:  The reader's preferences (theme, accent, type size, language, calendar, translations,
 *        habit rules) and their effect on the page: theme attributes, CSS variables, lang.
 * WHY:   One provider applies appearance at the document root so every screen and component
 *        follows the same tokens. In the preview it lives in memory; the backend phase stores it
 *        in the settings table with the same shape.
 * WHERE: every screen (useT for copy), settings page, reader, Today and Progress.
 */
export type ThemeId = "system" | "paper" | "sepia" | "night";

// Hues live in styles.css under [data-accent="…"].
export const ACCENTS = ["ink", "forest", "clay", "plum", "teal", "gold"] as const;
export type AccentId = (typeof ACCENTS)[number];

export interface Preferences {
  locale: Locale;
  calendar: CalendarSystem;
  theme: ThemeId;
  accent: AccentId;
  /** Scripture size in px. */
  textSize: number;
  lineSpacing: number;
  mainTranslation: string;
  parallelTranslation: string;
  parallel: boolean;
  /** Hides navigation and tools so only the text remains. */
  focusMode: boolean;
  notesRail: boolean;
  goalMinutes: number;
  rules: StreakRules;
}

const DEFAULTS: Preferences = {
  locale: "en",
  calendar: "gregorian",
  theme: "system",
  accent: "ink",
  textSize: 19,
  lineSpacing: 1.65,
  mainTranslation: "en-bsb",
  parallelTranslation: "am-1962-nt",
  parallel: true,
  focusMode: false,
  notesRail: true,
  goalMinutes: 15,
  rules: DEFAULT_STREAK_RULES,
};

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
  const [prefs, setPrefs] = useState(DEFAULTS);
  const systemDark = useSystemDark();
  const resolvedTheme = prefs.theme === "system" ? (systemDark ? "night" : "paper") : prefs.theme;

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolvedTheme;
    root.classList.toggle("dark", resolvedTheme === "night");
    root.lang = prefs.locale;
    root.dataset.accent = prefs.accent;
    root.style.setProperty("--reading-size", `${prefs.textSize}px`);
    root.style.setProperty("--reading-leading", String(prefs.lineSpacing));
  }, [prefs, resolvedTheme]);

  const value = useMemo(
    () => ({ prefs, resolvedTheme, update: (patch: Partial<Preferences>) => setPrefs((p) => ({ ...p, ...patch })) }),
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
