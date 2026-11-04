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

/**
 * SOURCE OF TRUTH KEYWORDS: openExternal, open link, system browser, openUrl, opener plugin, external URL
 * WHAT:  Opens a web address in the person's default browser.
 * WHY:   A plain link would load inside the app window. The app may only open the addresses its
 *        capability allows (see capabilities/default.json); the browser preview uses a new tab.
 * WHERE: BuiltBy (sidebar and Settings → About).
 */
export function openExternal(url: string): void {
  if (!isTauri()) {
    window.open(url, "_blank", "noopener");
    return;
  }
  void import("@tauri-apps/plugin-opener").then(({ openUrl }) => openUrl(url)).catch(() => undefined);
}
