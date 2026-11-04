import { isTauri } from "@tauri-apps/api/core";

// WKWebView reports "Macintosh", WebView2 "Windows NT" and WebKitGTK "X11; Linux".
const userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent;

/**
 * SOURCE OF TRUTH KEYWORDS: isMac, platform, operating system, user agent, Windows, Linux, macOS
 * WHAT:  Whether BibleOS is running on a Mac (in the app, or a Mac browser for the preview).
 * WHY:   The few things that differ between systems (title bar, shortcut labels) read this one
 *        flag. The user agent is enough to tell the three webviews apart, so no OS plugin and
 *        no extra permission are needed.
 * WHERE: hasOverlayTitleBar, shortcutLabel; anything else that must differ by system.
 */
export const isMac = /Macintosh|Mac OS X/.test(userAgent);

/**
 * SOURCE OF TRUTH KEYWORDS: hasOverlayTitleBar, title bar, traffic lights, window buttons, drag strip, titleBarStyle
 * WHAT:  True when the window content runs under the title bar, so screens must leave a
 *        draggable strip at the top and keep clear of the window buttons.
 * WHY:   tauri.conf.json asks for titleBarStyle "Overlay", which only macOS supports. Windows
 *        and Linux keep their native title bar, where an extra empty strip is wasted space.
 *        The browser preview keeps the Mac layout so it matches the main platform.
 * WHERE: TitleBarStrip, the reader header in focus mode.
 */
export const hasOverlayTitleBar = !isTauri() || isMac;

/**
 * SOURCE OF TRUTH KEYWORDS: shortcutLabel, keyboard shortcut, kbd, Cmd, Ctrl, modifier key, ⌘K
 * WHAT:  The label for a Cmd/Ctrl shortcut on this system: "⌘K" on a Mac, "Ctrl+K" elsewhere.
 * WHY:   Shortcut handlers accept both metaKey and ctrlKey; the label shown should name the key
 *        people on Windows and Linux actually press.
 * WHERE: Sidebar search button (K), note editor save button (Enter).
 */
export function shortcutLabel(key: string): string {
  if (isMac) return `⌘${key === "Enter" ? "↵" : key}`;
  return `Ctrl+${key}`;
}
