import { formatPassages } from "@starter/bible-core/plans";
import { formatDay } from "@starter/bible-core/calendar";
import { Button } from "@starter/ui/components/button";
import { cn } from "@starter/ui/lib/utils";
import { chapterOf, splitVerseId } from "@starter/bible-core/verse-id";
import { Link } from "@tanstack/react-router";
import { ArrowRight, CircleCheck, Hourglass, LogOut } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Card, Eyebrow } from "../../components/page";
import { useToday } from "../../lib/state/clock";
import { planSchedule, planTitle, usePlans, type Plan } from "../../lib/state/plans-store";
import { usePreferences, useT } from "../../lib/state/preferences";
import { DayCheck, PassageLinks, PlanIcon, ProgressBar } from "./plan-parts";

// Days shown around the current one before "Show all days".
const WINDOW_BEFORE = 3;
const WINDOW_AFTER = 7;

/** One started plan: today's reading, catch-up hint, every day with its checkbox, and Leave. */
export function ActivePlan({ plan }: { plan: Plan }) {
  const t = useT();
  const { prefs } = usePreferences();
  const today = useToday();
  const { setDayDone, leavePlan } = usePlans();
  const [showAll, setShowAll] = useState(false);
  const s = planSchedule(plan, today);
  const title = planTitle(plan, prefs.locale);
  const catchingUp = s.currentDay < s.todayDay;

  const from = showAll ? 1 : Math.max(1, s.currentDay - WINDOW_BEFORE);
  const to = showAll ? s.totalDays : Math.min(s.totalDays, s.currentDay + WINDOW_AFTER);
  const dayNumbers = Array.from({ length: Math.max(0, to - from + 1) }, (_x, i) => from + i);

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <div className="flex items-start gap-4">
          <PlanIcon planKey={plan.key} />
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t.plans.startedOn(formatDay(plan.startedOn, prefs.calendar, prefs.locale))}
              <span aria-hidden className="mx-2 opacity-40">
                ·
              </span>
              {t.plans.dayOf(s.todayDay, s.totalDays)}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const undo = leavePlan(plan.id);
              toast(t.plans.left(title), { action: { label: t.plans.undo, onClick: undo } });
            }}
          >
            <LogOut /> {t.plans.leave}
          </Button>
        </div>
        <div className="mt-5">
          <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
            <span>{t.plans.completedDays(s.completed.size, s.totalDays)}</span>
            <span className="tabular">{t.plans.percentDone(Math.round(s.progress * 100))}</span>
          </div>
          <ProgressBar value={s.progress} />
        </div>
      </Card>

      <Card label={t.plans.todaysReading}>
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <Eyebrow>
              {catchingUp ? t.plans.catchUp : t.plans.todaysReading} · {t.plans.day(s.currentDay)}
            </Eyebrow>
            <PassageLinks passages={s.currentPassages} />
          </div>
          <DayCheck
            checked={s.currentDone}
            label={`${t.plans.markDone}: ${t.plans.day(s.currentDay)}`}
            onChange={(done) => setDayDone(plan.id, s.currentDay, done)}
          />
        </div>
        <p
          className={cn(
            "mt-4 flex items-center gap-2 border-t pt-3 text-sm",
            s.behind > 0 ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {s.behind > 0 ? <Hourglass className="size-4 text-primary" /> : <CircleCheck className="size-4" />}
          {s.completed.size >= s.totalDays
            ? t.plans.allDone
            : s.behind > 0
              ? t.plans.behind(s.behind)
              : t.plans.onTrack}
        </p>
      </Card>

      <Card className="p-0">
        <div className="flex items-center justify-between px-6 pt-5 pb-2">
          <Eyebrow className="mb-0">{t.plans.allDays}</Eyebrow>
          {s.totalDays > WINDOW_BEFORE + WINDOW_AFTER + 1 && (
            <Button variant="ghost" size="xs" onClick={() => setShowAll((v) => !v)}>
              {showAll ? t.plans.showLess : t.plans.showAll}
            </Button>
          )}
        </div>
        <ol className="divide-y">
          {dayNumbers.map((day) => {
            const done = s.completed.has(day);
            const passages = plan.days[day - 1] ?? [];
            return (
              <li
                key={day}
                className={cn(
                  "flex items-center gap-4 px-6 py-3",
                  day === s.currentDay && "bg-muted/50",
                  day > s.todayDay && !done && "text-muted-foreground",
                )}
              >
                <DayCheck
                  checked={done}
                  label={`${t.plans.markDone}: ${t.plans.day(day)}`}
                  onChange={(next) => setDayDone(plan.id, day, next)}
                />
                <span className="w-16 shrink-0 text-xs font-medium tabular text-muted-foreground">
                  {t.plans.day(day)}
                </span>
                <span className={cn("min-w-0 flex-1 truncate text-sm", done && "line-through opacity-60")}>
                  {formatPassages(passages, prefs.locale)}
                </span>
                {passages[0] && (
                  <Button variant="ghost" size="xs" asChild>
                    <Link
                      to="/read"
                      search={{
                        c: chapterOf(passages[0].start),
                        v: splitVerseId(passages[0].start).verse || undefined,
                      }}
                    >
                      {t.plans.read} <ArrowRight />
                    </Link>
                  </Button>
                )}
              </li>
            );
          })}
        </ol>
      </Card>
    </div>
  );
}
