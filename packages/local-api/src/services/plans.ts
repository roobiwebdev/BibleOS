import type { StudyDb } from "@starter/local-db/drizzle";
import { planProgress, plans } from "@starter/local-db/schema";
import { and, asc, eq, isNull } from "drizzle-orm";

export type PlanRow = typeof plans.$inferSelect;
export type PlanProgressRow = typeof planProgress.$inferSelect;

/**
 * SOURCE OF TRUTH KEYWORDS: plansService, plan rows, plan_progress rows, completed days query
 * WHAT:  Queries on started plans and their completed days (live rows only unless stated).
 * WHY:   Services hold reusable queries, commands hold decisions (CLAUDE.md routers/services).
 *        plan_progress has a unique (plan_id, day) index, so un-completing a day soft-deletes
 *        the row and completing it again revives the same row.
 * WHERE: commands/plans.ts.
 */
export async function getLive(db: StudyDb, id: string): Promise<PlanRow | undefined> {
  return (
    await db
      .select()
      .from(plans)
      .where(and(eq(plans.id, id), isNull(plans.deletedAt)))
  ).at(0);
}

export function listLive(db: StudyDb): Promise<PlanRow[]> {
  return db.select().from(plans).where(isNull(plans.deletedAt)).orderBy(asc(plans.createdAt), asc(plans.id));
}

export async function insert(db: StudyDb, row: typeof plans.$inferInsert): Promise<void> {
  await db.insert(plans).values(row);
}

export async function update(
  db: StudyDb,
  id: string,
  patch: Partial<Pick<PlanRow, "startedOn" | "finishedAt" | "leftAt">> & { updatedAt: number },
): Promise<void> {
  await db.update(plans).set(patch).where(eq(plans.id, id));
}

/** Live (completed) progress rows, for one plan or for all. */
export function liveProgress(db: StudyDb, planId?: string): Promise<PlanProgressRow[]> {
  const live = isNull(planProgress.deletedAt);
  return db
    .select()
    .from(planProgress)
    .where(planId ? and(eq(planProgress.planId, planId), live) : live)
    .orderBy(asc(planProgress.planId), asc(planProgress.day));
}

/** The progress row for a day, deleted or not. */
export async function findDay(db: StudyDb, planId: string, day: number): Promise<PlanProgressRow | undefined> {
  return (
    await db
      .select()
      .from(planProgress)
      .where(and(eq(planProgress.planId, planId), eq(planProgress.day, day)))
  ).at(0);
}

export async function insertDay(db: StudyDb, row: typeof planProgress.$inferInsert): Promise<void> {
  await db.insert(planProgress).values(row);
}

export async function reviveDay(db: StudyDb, id: string, now: number): Promise<void> {
  await db
    .update(planProgress)
    .set({ deletedAt: null, completedAt: now, updatedAt: now })
    .where(eq(planProgress.id, id));
}

export async function softDeleteDay(db: StudyDb, id: string, now: number): Promise<void> {
  await db.update(planProgress).set({ deletedAt: now, updatedAt: now }).where(eq(planProgress.id, id));
}

/** Clears every completed day of a plan (restart). */
export async function softDeleteAllDays(db: StudyDb, planId: string, now: number): Promise<void> {
  await db
    .update(planProgress)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(planProgress.planId, planId), isNull(planProgress.deletedAt)));
}
