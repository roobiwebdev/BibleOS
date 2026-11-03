import type { Locale } from "@starter/bible-core/books";
import type { DayKey } from "@starter/bible-core/calendar";
import {
  builtInPlan,
  dayForDate,
  daysBehind,
  nextUnreadDay,
  planProgress,
  type PlanDay,
  type PlanKey,
} from "@starter/bible-core/plans";
import { commands } from "@starter/local-api/api";
import type { Plan } from "@starter/local-api/commands/plans";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { callCommand, CommandFailedError } from "../data/local-api";
import { useToday } from "./clock";
import { useT } from "./preferences";

export type { Plan };

export interface CustomPlanDraft {
  title: string;
  books: string[];
  days: number;
}

interface PlansContext {
  /** False until the first load from the study database finishes. */
  ready: boolean;
  plans: Plan[];
  startPlan: (key: PlanKey) => Promise<Plan | undefined>;
  startCustomPlan: (draft: CustomPlanDraft) => Promise<Plan | undefined>;
  /** Marks a day done or not done. */
  setDayDone: (planId: string, day: number, done: boolean) => void;
  /** Leaves a plan (progress kept) and returns a function that resumes it (for Undo). */
  leavePlan: (planId: string) => () => void;
  resumePlan: (planId: string) => void;
  restartPlan: (planId: string) => void;
}

const Context = createContext<PlansContext | null>(null);

/**
 * SOURCE OF TRUTH KEYWORDS: PlansProvider, usePlans, reading plans state, startPlan, leavePlan, setDayDone
 * WHAT:  The reader's started plans, loaded through local-api plan commands, with actions that
 *        run a command and then reload the list.
 * WHY:   Plans page and Today share one copy, so ticking a day on Today shows on the Plans page
 *        at once. Mirrors the study store: commands are the only way in.
 * WHERE: main.tsx (provider), Plans page, Today's reading card.
 */
export function PlansProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const today = useToday();
  const [state, setState] = useState<{ ready: boolean; plans: Plan[] }>({ ready: false, plans: [] });

  const reportFailure = useCallback(
    (error: unknown) => {
      console.error("[plans]", error instanceof CommandFailedError ? error.failure.code : error);
      toast.error(error instanceof CommandFailedError ? error.failure.message : t.plans.failed);
    },
    [t],
  );

  const reload = useCallback(async () => {
    const plans = await callCommand(commands.plans.list, {});
    setState({ ready: true, plans });
  }, []);

  // First load from the study database.
  useEffect(() => {
    let live = true;
    const load = async () => {
      const plans = await callCommand(commands.plans.list, {});
      if (live) setState({ ready: true, plans });
    };
    load().catch(reportFailure);
    return () => {
      live = false;
    };
  }, [reportFailure]);

  const act = useCallback(
    (task: () => Promise<unknown>) => void task().then(reload).catch(reportFailure),
    [reload, reportFailure],
  );

  const start = useCallback(
    async (task: () => Promise<Plan>) => {
      try {
        const plan = await task();
        await reload();
        return plan;
      } catch (error) {
        reportFailure(error);
        return undefined;
      }
    },
    [reload, reportFailure],
  );

  const actions = useMemo<Omit<PlansContext, "ready" | "plans">>(
    () => ({
      startPlan: (planKey) =>
        start(() => callCommand(commands.plans.start, { kind: "builtIn", planKey, startedOn: today })),
      startCustomPlan: (draft) =>
        start(() => callCommand(commands.plans.start, { kind: "custom", ...draft, startedOn: today })),
      setDayDone: (planId, day, done) =>
        act(() => callCommand(done ? commands.plans.completeDay : commands.plans.uncompleteDay, { planId, day })),
      leavePlan: (id) => {
        act(() => callCommand(commands.plans.leave, { id }));
        return () => act(() => callCommand(commands.plans.resume, { id }));
      },
      resumePlan: (id) => act(() => callCommand(commands.plans.resume, { id })),
      restartPlan: (id) => act(() => callCommand(commands.plans.restart, { id, startedOn: today })),
    }),
    [act, start, today],
  );

  const value = useMemo<PlansContext>(() => ({ ...state, ...actions }), [state, actions]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function usePlans(): PlansContext {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("usePlans must be used inside PlansProvider");
  return ctx;
}

/** A started plan's title in the interface language (custom plans keep the reader's title). */
export function planTitle(plan: Plan, locale: Locale): string {
  return builtInPlan(plan.key)?.title[locale] ?? plan.title;
}

export interface PlanSchedule {
  totalDays: number;
  completed: ReadonlySet<number>;
  /** Day the calendar says is today's, clamped to the plan. */
  todayDay: number;
  /** The day to read now: the first unread day, never later than today's. */
  currentDay: number;
  currentPassages: PlanDay;
  currentDone: boolean;
  progress: number;
  behind: number;
}

/**
 * SOURCE OF TRUTH KEYWORDS: planSchedule, PlanSchedule, today's reading, current plan day, catch-up
 * WHAT:  Where a started plan stands today: its current day and passages, progress and how
 *        many days behind the reader is.
 * WHY:   The Plans page and Today show the same "today's reading"; the bible-core math runs once here.
 * WHERE: Plans page, Today's reading card.
 */
export function planSchedule(plan: Plan, today: DayKey): PlanSchedule {
  const totalDays = plan.days.length;
  const completed = new Set(plan.completedDays);
  const todayDay = Math.min(dayForDate(plan.startedOn, today), Math.max(1, totalDays));
  // Behind readers see the oldest unread day first; ahead readers see today's.
  const currentDay = Math.min(nextUnreadDay(totalDays, completed) ?? todayDay, todayDay);
  return {
    totalDays,
    completed,
    todayDay,
    currentDay,
    currentPassages: plan.days[currentDay - 1] ?? [],
    currentDone: completed.has(currentDay),
    progress: planProgress(totalDays, completed),
    behind: daysBehind(plan.startedOn, today, totalDays, completed),
  };
}
