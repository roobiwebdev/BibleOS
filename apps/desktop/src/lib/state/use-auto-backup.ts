import { commands } from "@starter/local-api/api";
import { useEffect } from "react";

import { callCommand } from "../data/local-api";
import { backupStudyIfDue } from "../files";

/**
 * SOURCE OF TRUTH KEYWORDS: useAutoBackup, automatic backup on startup, daily backup
 * WHAT:  Once per launch, takes a backup of the study database when automatic backups are on
 *        and the newest copy is a day old.
 * WHY:   A daily copy protects notes from a bad import or a damaged file without asking the
 *        reader to remember. Reads the saved setting directly so it never acts on defaults.
 * WHERE: AppShell.
 */
export function useAutoBackup() {
  useEffect(() => {
    void callCommand(commands.settings.get, {})
      .then((prefs) => (prefs.autoBackup ? backupStudyIfDue() : undefined))
      .catch((error: unknown) => console.error("[backup]", error instanceof Error ? error.message : error));
  }, []);
}
