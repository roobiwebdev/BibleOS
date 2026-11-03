import { commands } from "@starter/local-api/api";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { callCommand } from "../data/local-api";
import { checkForUpdates, installUpdate } from "../updates";
import { useT } from "./preferences";

// Let the first screen settle before touching the network.
const LAUNCH_DELAY_MS = 4000;

/**
 * SOURCE OF TRUTH KEYWORDS: useUpdateCheck, update on launch, new version notice, update toast
 * WHAT:  Once per launch, when "Check for updates" is on, looks for a newer release and offers
 *        to install it in a toast. Offline or failed checks stay silent.
 * WHY:   Readers should get fixes without visiting a website, but nothing is downloaded until
 *        they agree. Reads the saved setting directly so it never acts on defaults.
 * WHERE: AppShell.
 */
export function useUpdateCheck() {
  // The copy is read when the toast appears, so a language change never re-runs the check.
  const t = useT();
  const copy = useRef(t.updates);
  useEffect(() => {
    copy.current = t.updates;
  }, [t]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void callCommand(commands.settings.get, {})
        .then(async (prefs) => {
          if (!prefs.checkUpdates) return;
          const result = await checkForUpdates();
          if (result.status !== "available") return;
          const text = copy.current;
          toast(text.available(result.version), {
            duration: Infinity,
            action: { label: text.install, onClick: () => void installUpdate() },
            cancel: { label: text.later, onClick: () => undefined },
          });
        })
        .catch((error: unknown) => console.error("[updates]", error instanceof Error ? error.message : error));
    }, LAUNCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);
}
