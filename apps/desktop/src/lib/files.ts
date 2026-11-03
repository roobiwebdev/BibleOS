import { dayKeyOf } from "@starter/bible-core/calendar";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { z } from "zod";

/**
 * SOURCE OF TRUTH KEYWORDS: saveTextFile, pickTextFile, TextFileKind, export file, import file, file dialog, download
 * WHAT:  Saving and opening the reader's own files (backups, note exports). In the app the
 *        native save/open dialog runs in Rust (src-tauri/src/files.rs); in the browser preview
 *        a save is a download and an open is a file input.
 * WHY:   The web layer never names a file path: Rust shows the dialog and does the read or
 *        write, so the WebView needs no file-system permission at all.
 * WHERE: Settings → Your data.
 */
export type TextFileKind = "json" | "markdown";

/** Same cap as the Rust side (backups are capped at 50 M characters by local-api). */
const MAX_BYTES = 200 * 1024 * 1024;
const ACCEPT: Record<TextFileKind, string> = {
  json: ".json,application/json",
  markdown: ".md,.markdown,text/markdown",
};
const MIME: Record<TextFileKind, string> = { json: "application/json", markdown: "text/markdown" };

/** Returns false when the reader cancelled the save dialog. */
export async function saveTextFile(suggestedName: string, contents: string, kind: TextFileKind): Promise<boolean> {
  if (isTauri()) {
    return z.boolean().parse(await invoke("save_text_file", { suggestedName, contents, kind }));
  }
  const url = URL.createObjectURL(new Blob([contents], { type: `${MIME[kind]};charset=utf-8` }));
  const link = document.createElement("a");
  link.href = url;
  link.download = suggestedName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
  return true;
}

/** The chosen file's text, or undefined when the reader cancelled. */
export async function pickTextFile(kind: TextFileKind): Promise<string | undefined> {
  if (isTauri()) {
    return (
      z
        .string()
        .nullable()
        .parse(await invoke("pick_text_file", { kind })) ?? undefined
    );
  }
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ACCEPT[kind];
  const file = await new Promise<File | undefined>((resolve) => {
    input.addEventListener("change", () => resolve(input.files?.[0]));
    input.addEventListener("cancel", () => resolve(undefined));
    input.click();
  });
  if (!file) return undefined;
  if (file.size > MAX_BYTES) throw new Error("file too large");
  return file.text();
}

/**
 * SOURCE OF TRUTH KEYWORDS: AUTO_BACKUP, backupStudyIfDue, listBackups, BackupInfo, automatic backups, backup schedule
 * WHAT:  The automatic backup schedule (a copy when the newest is a day old, keep 14) and the
 *        calls that run it and list the copies. App only; the preview has nothing to back up.
 * WHY:   The schedule is policy, so it lives here; Rust only copies the database file
 *        (VACUUM INTO on the study connection) and prunes.
 * WHERE: useAutoBackup (startup), Settings → Your data.
 */
export const AUTO_BACKUP = { everyHours: 24, keep: 14 } as const;

const backupInfoSchema = z.object({ name: z.string(), bytes: z.number(), modifiedAt: z.number() });
export type BackupInfo = z.infer<typeof backupInfoSchema>;

export async function listBackups(): Promise<BackupInfo[]> {
  if (!isTauri()) return [];
  return z.array(backupInfoSchema).parse(await invoke("list_backups"));
}

/** Takes a backup when one is due. Returns the new backup, if one was made. */
export async function backupStudyIfDue(): Promise<BackupInfo | undefined> {
  if (!isTauri()) return undefined;
  const made = backupInfoSchema
    .nullable()
    .parse(await invoke("backup_study_if_due", { today: dayKeyOf(new Date()), ...AUTO_BACKUP }));
  return made ?? undefined;
}
