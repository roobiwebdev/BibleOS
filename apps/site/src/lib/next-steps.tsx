import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import type { PlatformId } from "../config";

interface NextStepsValue {
  /** The platform whose steps are showing, or null when the dialog is closed. */
  open: PlatformId | null;
  show: (platform: PlatformId) => void;
  close: () => void;
}

const Context = createContext<NextStepsValue>({ open: null, show: () => undefined, close: () => undefined });

/**
 * SOURCE OF TRUTH KEYWORDS: NextStepsProvider, useNextSteps, after download, install dialog state
 * WHAT:  Which platform's "your download has started" steps are open, shared by every download link.
 * WHY:   The hero and the download cards both start downloads; one dialog serves them all.
 * WHERE: app.tsx (provider); hero.tsx, download.tsx and next-steps-dialog.tsx (hook).
 */
export function NextStepsProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<PlatformId | null>(null);
  const show = useCallback((platform: PlatformId) => setOpen(platform), []);
  const close = useCallback(() => setOpen(null), []);
  const value = useMemo(() => ({ open, show, close }), [open, show, close]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useNextSteps(): NextStepsValue {
  return useContext(Context);
}
