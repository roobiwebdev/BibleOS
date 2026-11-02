import { runMigrations } from "@starter/local-db/migrate";
import { createExecutor } from "@starter/local-db/executor";
import { createLocalApi, type LocalApi } from "@starter/local-api/api";
import type { Command, CommandFailure } from "@starter/local-api/command";
import { isTauri } from "@tauri-apps/api/core";

import { browserStudyDriver, tauriStudyDriver } from "./drivers";

/**
 * SOURCE OF TRUTH KEYWORDS: getLocalApi, callCommand, CommandFailedError, open study database, startup migrations
 * WHAT:  Opens the study database once (Rust bridge in the app, in-memory sql.js in the browser
 *        preview), applies pending migrations, and runs commands for the screens.
 * WHY:   Screens and state providers talk only to commands, never to SQL. The preview gets
 *        sample content through the same commands so both paths stay identical.
 * WHERE: lib/state providers (study store, preferences).
 */
let opened: Promise<LocalApi> | undefined;

async function open(): Promise<LocalApi> {
  const native = isTauri();
  const executor = createExecutor(native ? tauriStudyDriver : await browserStudyDriver());
  await runMigrations(executor);
  const api = createLocalApi({
    executor,
    // Only entity, action, code and timing reach the log; never note text.
    logger: {
      info: () => undefined,
      error: (message, fields) => console.error(`[local-api] ${message}`, fields),
    },
  });
  if (!native) {
    const { seedSample } = await import("./sample");
    await seedSample(api);
  }
  return api;
}

export function getLocalApi(): Promise<LocalApi> {
  opened ??= open();
  return opened;
}

export class CommandFailedError extends Error {
  constructor(readonly failure: CommandFailure) {
    super(failure.message);
  }
}

/** Runs a command and returns its data, or throws CommandFailedError. */
export async function callCommand<I, O>(command: Command<I, O>, input: I): Promise<O> {
  const result = await (await getLocalApi()).run(command, input);
  if (!result.ok) throw new CommandFailedError(result.error);
  return result.data;
}
