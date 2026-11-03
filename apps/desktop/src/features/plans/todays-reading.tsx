import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { Card, Eyebrow } from "../../components/page";
import { useToday } from "../../lib/state/clock";
import { planSchedule, planTitle, usePlans } from "../../lib/state/plans-store";
import { usePreferences, useT } from "../../lib/state/preferences";
import { DayCheck, PassageLinks, PlanIcon } from "./plan-parts";

/**
 * SOURCE OF TRUTH KEYWORDS: TodaysReading, today's reading card, plan reading on Today
 * WHAT:  Today's passages for every active plan, with a link into the reader and a checkbox to
 *        mark the day read. Renders nothing when no plan is active.
 * WHY:   Today is where the reader starts; the plan's reading belongs there, not only on Plans.
 * WHERE: Today page.
 */
export function TodaysReading() {
  const t = useT();
  const { prefs } = usePreferences();
  const today = useToday();
  const { plans, setDayDone } = usePlans();
  const active = plans.filter((p) => p.status === "active");
  if (active.length === 0) return null;

  return (
    <Card label={t.plans.todaysReading}>
      <div className="mb-3 flex items-center justify-between">
        <Eyebrow className="mb-0">{t.plans.todaysReading}</Eyebrow>
        <Link to="/plans" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          {t.plans.openPlans} <ArrowRight className="size-3" />
        </Link>
      </div>
      <div className="flex flex-col divide-y">
        {active.map((plan) => {
          const s = planSchedule(plan, today);
          const title = planTitle(plan, prefs.locale);
          return (
            <div key={plan.id} className="flex items-start gap-4 py-4 first:pt-1 last:pb-0">
              <PlanIcon planKey={plan.key} className="size-9" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold leading-tight">{title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {s.currentDay < s.todayDay ? t.plans.catchUp : t.plans.dayOf(s.currentDay, s.totalDays)}
                  {s.currentDay < s.todayDay && ` · ${t.plans.day(s.currentDay)}`}
                </p>
                <div className="mt-2">
                  <PassageLinks passages={s.currentPassages} compact />
                </div>
              </div>
              <DayCheck
                checked={s.currentDone}
                label={`${t.plans.markDone}: ${title}, ${t.plans.day(s.currentDay)}`}
                onChange={(done) => setDayDone(plan.id, s.currentDay, done)}
              />
            </div>
          );
        })}
      </div>
    </Card>
  );
}
