import { useEffect, useState, useSyncExternalStore } from "react";

import type { PlatformId } from "../config";
import { detectPlatform } from "./platform";
import { fetchLatestRelease, type ReleaseState } from "./releases";

const noSubscribe = () => () => undefined;

/**
 * SOURCE OF TRUTH KEYWORDS: useRelease, latest release hook, detected platform, download state
 * WHAT:  The latest release (or the fallback) plus the visitor's platform, for any section that
 *        shows download buttons.
 * WHY:   One request per page view; sections share it through the provider in app.tsx.
 * WHERE: app.tsx (ReleaseContext).
 */
export function useRelease(): { release: ReleaseState; platform: PlatformId | undefined } {
  const [release, setRelease] = useState<ReleaseState>({ status: "loading" });
  // The prerendered page knows no visitor; the browser fills the platform in on hydration.
  const platform = useSyncExternalStore(
    noSubscribe,
    () => detectPlatform(),
    () => undefined,
  );

  useEffect(() => {
    const controller = new AbortController();
    void fetchLatestRelease(controller.signal).then((state) => {
      if (!controller.signal.aborted) setRelease(state);
    });
    return () => controller.abort();
  }, []);

  return { release, platform };
}
