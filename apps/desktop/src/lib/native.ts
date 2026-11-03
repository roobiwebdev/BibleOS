import { invoke, isTauri } from "@tauri-apps/api/core";

/**
 * SOURCE OF TRUTH KEYWORDS: setDockIcon, app icon, dock icon, theme icon, native integration
 * WHAT:  Asks the app shell to show the Dock icon that matches the visible theme.
 * WHY:   The icon should look like the app while it runs. macOS keeps the bundled (sepia)
 *        icon whenever the app is closed; the browser preview has no Dock, so this does nothing there.
 * WHERE: PreferencesProvider, whenever the shown theme changes.
 */
export function setDockIcon(theme: "paper" | "sepia" | "night"): void {
  if (isTauri()) void invoke("set_app_icon", { theme }).catch(() => undefined);
}
