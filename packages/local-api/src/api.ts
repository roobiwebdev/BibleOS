import type { SqliteExecutor } from "@starter/local-db/executor";

import type { Command, CommandDeps, CommandLogger, CommandResult } from "./command";
import { backupCommands } from "./commands/backup";
import { collectionCommands } from "./commands/collections";
import { highlightCommands } from "./commands/highlights";
import { noteCommands } from "./commands/notes";
import { readingCommands } from "./commands/reading";
import { settingsCommands } from "./commands/settings";

/**
 * SOURCE OF TRUTH KEYWORDS: commands, command registry, highlights, notes, collections, reading, settings, backup
 * WHAT:  Every local command, grouped by entity (the desktop's root router).
 * WHY:   One registry for the UI hooks and tests to import; names read as `<entity>.<action>`.
 * WHERE: createLocalApi callers, desktop query hooks, tests.
 */
export const commands = {
  highlights: highlightCommands,
  notes: noteCommands,
  collections: collectionCommands,
  reading: readingCommands,
  settings: settingsCommands,
  backup: backupCommands,
};

export interface LocalApi {
  /** Runs a command: validate, (transaction + change_log for mutations), typed result. */
  run<I, O>(command: Command<I, O>, input: I): Promise<CommandResult<O>>;
}

/**
 * SOURCE OF TRUTH KEYWORDS: createLocalApi, LocalApi, api.run, command runner
 * WHAT:  Binds the commands to one executor (the open study database), a clock and a logger.
 * WHY:   The UI never touches SQL or the executor; it calls `api.run(commands.notes.save, input)`.
 * WHERE: desktop app startup (after runMigrations), tests.
 */
export function createLocalApi(options: {
  executor: SqliteExecutor;
  clock?: () => number;
  logger?: CommandLogger;
}): LocalApi {
  const deps: CommandDeps = options;
  return { run: (command, input) => command.call(deps, input) };
}
