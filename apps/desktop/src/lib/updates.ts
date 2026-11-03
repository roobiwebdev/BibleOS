import { getVersion } from "@tauri-apps/api/app";
import { isTauri } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { useSyncExternalStore } from "react";

export type UpdateState =
  | { status: "unsupported" }
  | { status: "idle" }
  | { status: "checking" }
  | { status: "current"; checkedAt: number }
  | { status: "available"; version: string; notes: string | undefined }
  | { status: "downloading"; version: string; received: number; total: number | undefined }
  | { status: "restarting"; version: string }
  | { status: "error"; message: string };

let state: UpdateState = isTauri() ? { status: "idle" } : { status: "unsupported" };
let pending: Update | null = null;
const listeners = new Set<() => void>();

function set(next: UpdateState) {
  state = next;
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * SOURCE OF TRUTH KEYWORDS: checkForUpdates, installUpdate, useUpdates, updater, auto update, GitHub Releases, relaunch
 * WHAT:  One shared update state for the app: look for a newer signed release, then download,
 *        install and relaunch when the reader agrees.
 * WHY:   The launch check and Settings → Updates must agree on what was found and never start
 *        two downloads. The updater plugin verifies each release against the public key in
 *        tauri.conf.json before installing it, so an unsigned or altered file is rejected.
 * WHERE: useUpdateCheck (AppShell, on launch) and the Updates group in Settings.
 */
export async function checkForUpdates(): Promise<UpdateState> {
  if (state.status === "unsupported" || state.status === "checking" || state.status === "downloading") return state;
  set({ status: "checking" });
  try {
    pending = await check();
    set(
      pending
        ? { status: "available", version: pending.version, notes: pending.body }
        : { status: "current", checkedAt: Date.now() },
    );
  } catch (error) {
    pending = null;
    set({ status: "error", message: messageOf(error) });
  }
  return state;
}

/** Downloads and installs the release found by checkForUpdates, then restarts into it. */
export async function installUpdate(): Promise<void> {
  const update = pending;
  if (!update || state.status !== "available") return;
  const version = update.version;
  let received = 0;
  let total: number | undefined;
  set({ status: "downloading", version, received, total });
  try {
    await update.downloadAndInstall((event) => {
      if (event.event === "Started") total = event.data.contentLength;
      if (event.event === "Progress") received += event.data.chunkLength;
      set({ status: "downloading", version, received, total });
    });
    set({ status: "restarting", version });
    await relaunch();
  } catch (error) {
    set({ status: "error", message: messageOf(error) });
  }
}

export function useUpdates(): UpdateState {
  return useSyncExternalStore(subscribe, () => state);
}

/** The installed app version, or undefined in the browser preview. */
export function appVersion(): Promise<string | undefined> {
  return isTauri() ? getVersion() : Promise.resolve(undefined);
}
