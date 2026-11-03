import { dayKeyOf } from "@starter/bible-core/calendar";
import { commands } from "@starter/local-api/api";
import { isTauri } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { callCommand, CommandFailedError } from "../../lib/data/local-api";
import { backupStudyIfDue, listBackups, pickTextFile, saveTextFile, type BackupInfo } from "../../lib/files";
import { usePreferences, useT } from "../../lib/state/preferences";
import { useStudy } from "../../lib/state/study-store";
import { notesToMarkdown } from "./notes-markdown";

const today = () => dayKeyOf(new Date());

/**
 * SOURCE OF TRUTH KEYWORDS: useYourData, export backup, import backup, export notes, automatic backups toggle
 * WHAT:  The actions behind Settings → Your data: export a JSON backup, import one (merge),
 *        export notes as Markdown, switch automatic backups, and the list of automatic copies.
 * WHY:   Keeps file and command plumbing out of the settings layout. Every import goes
 *        through backup.import, which validates the whole file before writing anything.
 * WHERE: settings page.
 */
export function useYourData() {
  const t = useT();
  const { prefs, update } = usePreferences();
  const study = useStudy();
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    void listBackups()
      .then(setBackups)
      .catch(() => undefined);
  }, []);
  useEffect(refresh, [refresh]);

  const run = async (task: () => Promise<void>, failure: string) => {
    setBusy(true);
    try {
      await task();
    } catch (error) {
      console.error("[data]", error instanceof CommandFailedError ? error.failure.code : error);
      toast.error(failure, { description: error instanceof CommandFailedError ? error.failure.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const exportBackup = () =>
    run(async () => {
      const backup = await callCommand(commands.backup.export, {});
      if (await saveTextFile(`bibleos-backup-${today()}.json`, JSON.stringify(backup, null, 2), "json")) {
        toast.success(t.welcome.data.saved);
      }
    }, t.welcome.data.exportFailed);

  const exportMarkdown = () =>
    run(async () => {
      if (study.notes.length === 0) {
        toast(t.welcome.data.noNotes);
        return;
      }
      const markdown = notesToMarkdown(study.notes, prefs.locale, t.welcome.data.markdown);
      if (await saveTextFile(`bibleos-notes-${today()}.md`, markdown, "markdown")) toast.success(t.welcome.data.saved);
    }, t.welcome.data.exportFailed);

  const importBackup = () =>
    run(async () => {
      const json = await pickTextFile("json");
      if (json === undefined) return;
      const { changed } = await callCommand(commands.backup.import, { json });
      const total = Object.values(changed).reduce((sum, n) => sum + n, 0);
      if (total === 0) {
        toast(t.welcome.data.importNothing);
        return;
      }
      const labels = t.welcome.data.tables;
      const parts = [
        [labels.notes, changed.notes],
        [labels.highlights, changed.highlights],
        [labels.collections, changed.collections],
        [labels.reading, changed.readingSessions],
      ].filter((p): p is [string, number] => typeof p[1] === "number" && p[1] > 0);
      toast.success(t.welcome.data.imported(total), {
        description: parts.map(([label, n]) => `${n} ${label}`).join(" · "),
      });
      // The app reloads to show the merged data everywhere. The preview keeps its in-memory
      // data only until a reload, so it stays put.
      if (isTauri()) setTimeout(() => window.location.reload(), 1_500);
    }, t.welcome.data.importFailed);

  const setAutoBackup = (on: boolean) => {
    update({ autoBackup: on });
    if (on) {
      void backupStudyIfDue()
        .then(refresh)
        .catch(() => undefined);
    }
  };

  return { backups, busy, exportBackup, exportMarkdown, importBackup, setAutoBackup };
}
