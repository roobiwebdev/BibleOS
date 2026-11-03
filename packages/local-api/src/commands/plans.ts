import { bookByCode } from "@starter/bible-core/books";
import type { DayKey } from "@starter/bible-core/calendar";
import {
  builtInPlan,
  customPlan,
  MAX_PLAN_DAYS,
  PLAN_KEYS,
  type PlanDay,
  type PlanDefinition,
} from "@starter/bible-core/plans";
import { z } from "zod";

import { CommandError, defineCommand, type CommandContext } from "../command";
import { dayKeySchema, LIMITS, verseRangeSchema } from "../schemas";
import * as plansService from "../services/plans";

/** planKey stored for plans the reader made; built-in keys come from bible-core PLAN_KEYS. */
export const CUSTOM_PLAN_KEY = "custom";

export type PlanStatus = "active" | "finished" | "left";

/**
 * SOURCE OF TRUTH KEYWORDS: Plan, PlanStatus, started plan, plan shape, completedDays
 * WHAT:  A plan the reader started, as the UI sees it: its days (from bible-core for built-in
 *        plans, from the stored JSON for custom ones), which days are done, and its status.
 * WHY:   One shape for the Plans page and Today. Status is derived from left_at/finished_at so
 *        the two columns can never disagree with it.
 * WHERE: plans commands, desktop plans store.
 */
export interface Plan {
  id: string;
  key: string;
  /** Stored title; built-in plans show their localized title from bible-core instead. */
  title: string;
  custom: boolean;
  startedOn: DayKey;
  finishedAt: number | null;
  leftAt: number | null;
  status: PlanStatus;
  days: PlanDay[];
  completedDays: number[];
  createdAt: number;
  updatedAt: number;
}

/**
 * SOURCE OF TRUTH KEYWORDS: planDefinitionSchema, custom plan JSON, stored plan definition
 * WHAT:  The JSON stored in plans.definition for a custom plan: its days and the books chosen.
 * WHY:   The column is free text, so it is validated on the way in and on the way out. Days are
 *        stored (not regenerated) so a future change to the generator never moves a reader's plan.
 * WHERE: plans.start, reading plans back, backup import (later).
 */
export const planDefinitionSchema = z.object({
  books: z.array(z.string().min(1).max(8)).max(100).default([]),
  days: z.array(z.array(verseRangeSchema).min(1).max(200)).min(1).max(MAX_PLAN_DAYS),
});

const bookCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(8)
  .refine((code) => bookByCode(code) !== undefined, { message: "Unknown book" });

const idSchema = z.string().min(1).max(64);

const startSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("builtIn"), planKey: z.enum(PLAN_KEYS), startedOn: dayKeySchema }),
  z.object({
    kind: z.literal("custom"),
    title: z.string().trim().min(1).max(LIMITS.title),
    books: z.array(bookCodeSchema).min(1).max(100),
    days: z.number().int().min(1).max(MAX_PLAN_DAYS),
    startedOn: dayKeySchema,
  }),
]);

function parseDefinition(text: string | null): PlanDefinition {
  if (!text) return { days: [] };
  try {
    const raw: unknown = JSON.parse(text);
    const parsed = planDefinitionSchema.safeParse(raw);
    return parsed.success ? { days: parsed.data.days } : { days: [] };
  } catch {
    return { days: [] };
  }
}

function daysOf(row: plansService.PlanRow): PlanDay[] {
  return row.planKey === CUSTOM_PLAN_KEY
    ? parseDefinition(row.definition).days
    : (builtInPlan(row.planKey)?.days ?? []);
}

function toPlan(row: plansService.PlanRow, completed: readonly number[]): Plan {
  return {
    id: row.id,
    key: row.planKey,
    title: row.title,
    custom: row.planKey === CUSTOM_PLAN_KEY,
    startedOn: row.startedOn,
    finishedAt: row.finishedAt,
    leftAt: row.leftAt,
    status: row.leftAt !== null ? "left" : row.finishedAt !== null ? "finished" : "active",
    days: daysOf(row),
    completedDays: [...completed],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function liveOrThrow(ctx: CommandContext, id: string) {
  const row = await plansService.getLive(ctx.db, id);
  if (!row) throw new CommandError("NOT_FOUND", "That reading plan no longer exists.");
  return row;
}

async function load(ctx: CommandContext, id: string): Promise<Plan> {
  const row = await liveOrThrow(ctx, id);
  return toPlan(
    row,
    (await plansService.liveProgress(ctx.db, id)).map((p) => p.day),
  );
}

/** Checks the day exists in the plan and the plan is being followed. */
async function followedDay(ctx: CommandContext, planId: string, day: number) {
  const row = await liveOrThrow(ctx, planId);
  if (row.leftAt !== null) throw new CommandError("CONFLICT", "You left this plan. Resume it to keep reading.");
  if (day > daysOf(row).length) throw new CommandError("INVALID_INPUT", "That day is not part of this plan.");
  return row;
}

/**
 * SOURCE OF TRUTH KEYWORDS: plans.start, plans.list, plans.get, plans.completeDay, plans.uncompleteDay, plans.leave, plans.resume, plans.restart
 * WHAT:  Reading plan commands. Starting a built-in plan that is already active is a CONFLICT.
 *        Leaving sets left_at and keeps every completed day; resume clears it again (Undo).
 *        Completing the last open day marks the plan finished; un-completing a day reopens it.
 *        Restart moves the start to today and clears completed days.
 * WHY:   Readers must be able to leave a plan (the reference app's gap) without losing what
 *        they read, and to come back to it later.
 * WHERE: desktop plans store (Plans page, Today's reading).
 */
export const planCommands = {
  start: defineCommand({
    entity: "plans",
    action: "start",
    kind: "mutation",
    input: startSchema,
    run: async (ctx, input): Promise<Plan> => {
      const id = ctx.newId();
      const base = { id, startedOn: input.startedOn, createdAt: ctx.now, updatedAt: ctx.now };
      if (input.kind === "builtIn") {
        const plan = builtInPlan(input.planKey);
        if (!plan) throw new CommandError("NOT_FOUND", "That reading plan does not exist.");
        const active = (await plansService.listLive(ctx.db)).some(
          (p) => p.planKey === plan.key && p.leftAt === null && p.finishedAt === null,
        );
        if (active) throw new CommandError("CONFLICT", "You are already following this plan.");
        await plansService.insert(ctx.db, { ...base, planKey: plan.key, title: plan.title.en, definition: null });
      } else {
        const definition = customPlan(input.books, input.days);
        if (definition.days.length === 0) throw new CommandError("INVALID_INPUT", "Choose at least one book.");
        const books = [...new Set(input.books.map((b) => b.toUpperCase()))];
        await plansService.insert(ctx.db, {
          ...base,
          planKey: CUSTOM_PLAN_KEY,
          title: input.title,
          definition: JSON.stringify(planDefinitionSchema.parse({ books, days: definition.days })),
        });
      }
      return load(ctx, id);
    },
    entityId: (plan) => plan.id,
  }),

  list: defineCommand({
    entity: "plans",
    action: "list",
    kind: "query",
    input: z.object({}).default({}),
    run: async (ctx): Promise<Plan[]> => {
      const done = Map.groupBy(await plansService.liveProgress(ctx.db), (p) => p.planId);
      return (await plansService.listLive(ctx.db)).map((row) =>
        toPlan(
          row,
          (done.get(row.id) ?? []).map((p) => p.day),
        ),
      );
    },
  }),

  get: defineCommand({
    entity: "plans",
    action: "get",
    kind: "query",
    input: z.object({ id: idSchema }),
    run: (ctx, { id }) => load(ctx, id),
  }),

  completeDay: defineCommand({
    entity: "plans",
    action: "completeDay",
    kind: "mutation",
    input: z.object({ planId: idSchema, day: z.number().int().min(1).max(MAX_PLAN_DAYS) }),
    run: async (ctx, { planId, day }): Promise<Plan> => {
      const row = await followedDay(ctx, planId, day);
      const existing = await plansService.findDay(ctx.db, planId, day);
      if (!existing) {
        await plansService.insertDay(ctx.db, {
          id: ctx.newId(),
          planId,
          day,
          completedAt: ctx.now,
          createdAt: ctx.now,
          updatedAt: ctx.now,
        });
      } else if (existing.deletedAt !== null) {
        await plansService.reviveDay(ctx.db, existing.id, ctx.now);
      }
      const done = (await plansService.liveProgress(ctx.db, planId)).length;
      const finished = done >= daysOf(row).length;
      if (finished && row.finishedAt === null) {
        await plansService.update(ctx.db, planId, { finishedAt: ctx.now, updatedAt: ctx.now });
      }
      return load(ctx, planId);
    },
    entityId: (_plan, input) => input.planId,
  }),

  uncompleteDay: defineCommand({
    entity: "plans",
    action: "uncompleteDay",
    kind: "mutation",
    input: z.object({ planId: idSchema, day: z.number().int().min(1).max(MAX_PLAN_DAYS) }),
    run: async (ctx, { planId, day }): Promise<Plan> => {
      const row = await followedDay(ctx, planId, day);
      const existing = await plansService.findDay(ctx.db, planId, day);
      if (existing && existing.deletedAt === null) await plansService.softDeleteDay(ctx.db, existing.id, ctx.now);
      if (row.finishedAt !== null) await plansService.update(ctx.db, planId, { finishedAt: null, updatedAt: ctx.now });
      return load(ctx, planId);
    },
    entityId: (_plan, input) => input.planId,
  }),

  leave: defineCommand({
    entity: "plans",
    action: "leave",
    kind: "mutation",
    input: z.object({ id: idSchema }),
    run: async (ctx, { id }): Promise<Plan> => {
      const row = await liveOrThrow(ctx, id);
      if (row.leftAt === null) await plansService.update(ctx.db, id, { leftAt: ctx.now, updatedAt: ctx.now });
      return load(ctx, id);
    },
    entityId: (plan) => plan.id,
  }),

  resume: defineCommand({
    entity: "plans",
    action: "resume",
    kind: "mutation",
    input: z.object({ id: idSchema }),
    run: async (ctx, { id }): Promise<Plan> => {
      const row = await liveOrThrow(ctx, id);
      if (row.leftAt !== null) await plansService.update(ctx.db, id, { leftAt: null, updatedAt: ctx.now });
      return load(ctx, id);
    },
    entityId: (plan) => plan.id,
  }),

  restart: defineCommand({
    entity: "plans",
    action: "restart",
    kind: "mutation",
    input: z.object({ id: idSchema, startedOn: dayKeySchema }),
    run: async (ctx, { id, startedOn }): Promise<Plan> => {
      await liveOrThrow(ctx, id);
      await plansService.softDeleteAllDays(ctx.db, id, ctx.now);
      await plansService.update(ctx.db, id, { startedOn, leftAt: null, finishedAt: null, updatedAt: ctx.now });
      return load(ctx, id);
    },
    entityId: (plan) => plan.id,
  }),
};
