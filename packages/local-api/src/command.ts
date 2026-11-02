import { createStudyDb, type StudyDb } from "@starter/local-db/drizzle";
import type { SqliteExecutor } from "@starter/local-db/executor";
import { uuidv7 } from "@starter/local-db/ids";
import { changeLog } from "@starter/local-db/schema";
import { z } from "zod";

/**
 * SOURCE OF TRUTH KEYWORDS: CommandErrorCode, CommandError, CommandResult, CommandFailure, typed errors
 * WHAT:  The error vocabulary of local commands. Rules throw CommandError; defineCommand turns
 *        every outcome into a CommandResult, so callers never see a raw exception.
 * WHY:   The UI branches on a small set of codes (show the form error, say "not found", or
 *        a generic failure) instead of parsing messages. Unknown errors become INTERNAL with a
 *        generic message, because database errors can quote parameters such as note text.
 * WHERE: every command in src/commands, the desktop query hooks.
 */
export type CommandErrorCode = "INVALID_INPUT" | "NOT_FOUND" | "CONFLICT" | "INTERNAL";

export class CommandError extends Error {
  readonly code: CommandErrorCode;
  constructor(code: CommandErrorCode, message: string) {
    super(message);
    this.name = "CommandError";
    this.code = code;
  }
}

export interface CommandIssue {
  path: string;
  message: string;
}

export interface CommandFailure {
  code: CommandErrorCode;
  message: string;
  issues?: CommandIssue[];
}

export type CommandResult<T> = { ok: true; data: T } | { ok: false; error: CommandFailure };

/**
 * SOURCE OF TRUTH KEYWORDS: CommandLogger, LogFields, scoped logger, noopLogger
 * WHAT:  The logger shape commands use: same methods as @starter/core's createLogger.
 * WHY:   core's logger reads process.env, which the WebView does not have, so the app injects
 *        one. Fields are scalars only, and commands log entity/action/code/duration, never input.
 * WHERE: defineCommand, createLocalApi.
 */
export type LogFields = Record<string, string | number | boolean | null | undefined>;
export interface CommandLogger {
  info: (message: string, fields?: LogFields) => void;
  error: (message: string, fields?: LogFields, err?: unknown) => void;
}
export const noopLogger: CommandLogger = { info: () => undefined, error: () => undefined };

/** What a command's `run` receives: a Drizzle db (inside the transaction for mutations). */
export interface CommandContext {
  db: StudyDb;
  /** The raw executor behind `db` (the transaction for mutations). */
  executor: SqliteExecutor;
  /** One timestamp per command, so every row it writes agrees. */
  now: number;
  newId: () => string;
}

export interface CommandDeps {
  executor: SqliteExecutor;
  clock?: () => number;
  logger?: CommandLogger;
}

export type CommandKind = "query" | "mutation";

export interface Command<TInput, TOutput> {
  readonly entity: string;
  readonly action: string;
  readonly kind: CommandKind;
  call(deps: CommandDeps, input: TInput): Promise<CommandResult<TOutput>>;
}

/** Input and output types of a command, for UI hooks (the RouterInputs/Outputs of the desktop). */
export type CommandInput<C> = C extends Command<infer I, unknown> ? I : never;
export type CommandOutput<C> = C extends Command<never, infer O> ? O : never;

export interface CommandDefinition<TSchema extends z.ZodType, TOutput> {
  entity: string;
  action: string;
  kind: CommandKind;
  input: TSchema;
  run: (ctx: CommandContext, input: z.output<TSchema>) => Promise<TOutput>;
  /** The id recorded in change_log for a mutation (default: none). Put it after `run` so the output type is inferred from run. */
  entityId?: (output: NoInfer<TOutput>, input: z.output<TSchema>) => string | null;
}

/**
 * SOURCE OF TRUTH KEYWORDS: defineCommand, command builder, security checkpoint, change_log, audit, transaction, Zod input
 * WHAT:  The single checkpoint every study-data read and write goes through (the desktop's
 *        protectedProcedure). It: 1) validates input with Zod, 2) opens a transaction for
 *        mutations, 3) writes a change_log row (entity, entity_id, action, at) inside that
 *        transaction, 4) maps every error to a typed CommandResult, 5) logs entity, action,
 *        outcome and duration only, never input or note contents.
 * WHY:   One local user means no auth or rate limits (see the engineering plan §6); what
 *        remains is input limits, atomic writes and an audit trail that later becomes the
 *        sync outbox. Doing it here once means commands only hold their rules.
 * WHERE: src/commands/*.ts; called through createLocalApi in api.ts.
 */
export function defineCommand<TSchema extends z.ZodType, TOutput>(
  def: CommandDefinition<TSchema, TOutput>,
): Command<z.input<TSchema>, TOutput> {
  return {
    entity: def.entity,
    action: def.action,
    kind: def.kind,
    async call(deps, rawInput) {
      const logger = deps.logger ?? noopLogger;
      const started = Date.now();
      const name = `${def.entity}.${def.action}`;
      const parsed = await def.input.safeParseAsync(rawInput);
      if (!parsed.success) {
        logger.info("command rejected", { command: name, code: "INVALID_INPUT" });
        return {
          ok: false,
          error: {
            code: "INVALID_INPUT",
            message: "The input is not valid.",
            issues: parsed.error.issues.map((i) => ({ path: i.path.map(String).join("."), message: i.message })),
          },
        };
      }
      const input = parsed.data;
      const now = (deps.clock ?? Date.now)();
      try {
        const data =
          def.kind === "query"
            ? await def.run(context(deps.executor, now), input)
            : await deps.executor.transaction(async (tx) => {
                const ctx = context(tx, now);
                const output = await def.run(ctx, input);
                await ctx.db.insert(changeLog).values({
                  id: uuidv7(now),
                  entity: def.entity,
                  entityId: def.entityId?.(output, input) ?? null,
                  action: def.action,
                  at: now,
                });
                return output;
              });
        logger.info("command ok", { command: name, ms: Date.now() - started });
        return { ok: true, data };
      } catch (err) {
        if (err instanceof CommandError) {
          logger.info("command failed", { command: name, code: err.code });
          return { ok: false, error: { code: err.code, message: err.message } };
        }
        // The error itself may quote SQL parameters (note text), so only its type is logged.
        logger.error("command crashed", { command: name, error: err instanceof Error ? err.name : typeof err });
        return {
          ok: false,
          error: { code: "INTERNAL", message: "Something went wrong while saving your study data." },
        };
      }
    },
  };
}

function context(executor: SqliteExecutor, now: number): CommandContext {
  return { db: createStudyDb(executor), executor, now, newId: () => uuidv7(now) };
}
