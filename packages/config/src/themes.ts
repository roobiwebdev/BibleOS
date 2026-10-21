/**
 * SOURCE OF TRUTH KEYWORDS: APP_THEMES, AppThemeId, theme presets, data-app-theme, appTheme
 * WHAT:  The brand colour presets selectable in Admin > General. Each id maps to a
 *        `[data-app-theme="<id>"]` block in packages/ui/src/styles/globals.css.
 * WHY:   Batman shipped the `appTheme` column but no presets; this finishes it.
 * WHERE: admin general page (picker), root layout (sets the attribute), Zod validation in api.
 */
export const APP_THEMES = [
  { id: "default", label: "Neutral" },
  { id: "blue", label: "Blue" },
  { id: "green", label: "Green" },
  { id: "violet", label: "Violet" },
  { id: "orange", label: "Orange" },
] as const;

export type AppThemeId = (typeof APP_THEMES)[number]["id"];
export const APP_THEME_IDS = APP_THEMES.map((t) => t.id) as [AppThemeId, ...AppThemeId[]];
