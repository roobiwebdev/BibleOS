import { hasOverlayTitleBar } from "../lib/platform";

/**
 * SOURCE OF TRUTH KEYWORDS: TitleBarStrip, title bar, drag region, traffic lights, window buttons, top strip
 * WHAT:  The top of a column: on a Mac, an empty strip you can drag the window by that leaves
 *        room for the window buttons; on Windows and Linux, a small gap under the native title bar.
 * WHY:   The overlay title bar exists only on macOS. One component keeps every column's top
 *        edge the same on each system.
 * WHERE: AppShell sidebar, Page.
 */
export function TitleBarStrip() {
  if (hasOverlayTitleBar) return <div data-tauri-drag-region className="h-11 shrink-0" />;
  return <div className="h-4 shrink-0" />;
}
