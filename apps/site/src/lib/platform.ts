import type { PlatformId } from "../config";

function hintedPlatform(nav: Navigator): string | undefined {
  if (!("userAgentData" in nav)) return undefined;
  const data: unknown = nav.userAgentData;
  if (typeof data === "object" && data !== null && "platform" in data && typeof data.platform === "string") {
    return data.platform;
  }
  return undefined;
}

/**
 * SOURCE OF TRUTH KEYWORDS: detectPlatform, visitor OS, userAgentData, user agent, mobile, download default
 * WHAT:  Guesses the visitor's desktop OS so the hero can offer the right installer first.
 * WHY:   userAgentData.platform is the clean signal where it exists (Chromium); the user agent
 *        string covers Safari and Firefox. Phones and tablets get undefined: BibleOS has no mobile
 *        build, so the page shows every platform instead of guessing. iPadOS reports itself as a
 *        Mac, which touch support gives away.
 * WHERE: lib/use-release.ts (hero and download section).
 */
export function detectPlatform(nav: Navigator = navigator): PlatformId | undefined {
  const ua = nav.userAgent;
  if (/android|iphone|ipad|ipod|mobile/i.test(ua)) return undefined;
  const hint = hintedPlatform(nav)?.toLowerCase() ?? "";
  if (hint.includes("mac") || /macintosh|mac os x/i.test(ua)) return nav.maxTouchPoints > 1 ? undefined : "mac";
  if (hint.includes("win") || /windows/i.test(ua)) return "windows";
  if (hint.includes("linux") || hint.includes("chrome os") || /linux|x11|cros/i.test(ua)) return "linux";
  return undefined;
}
