import { createContext, useContext, type ReactNode } from "react";

import type { PlatformId } from "../config";
import type { ReleaseState } from "./releases";
import { useRelease } from "./use-release";

interface ReleaseContextValue {
  release: ReleaseState;
  platform: PlatformId | undefined;
}

const Context = createContext<ReleaseContextValue>({ release: { status: "loading" }, platform: undefined });

/**
 * SOURCE OF TRUTH KEYWORDS: ReleaseProvider, useReleaseInfo, shared release state, download context
 * WHAT:  Shares one release lookup and the detected platform with every section.
 * WHY:   The hero and the download section both need it; one request serves both.
 * WHERE: app.tsx (provider); hero.tsx and download.tsx (hook).
 */
export function ReleaseProvider({ children }: { children: ReactNode }) {
  const value = useRelease();
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useReleaseInfo(): ReleaseContextValue {
  return useContext(Context);
}
