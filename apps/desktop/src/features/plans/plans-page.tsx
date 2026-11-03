import { formatDay, dayKeyOf } from "@starter/bible-core/calendar";
import { BUILT_IN_PLANS, planPace, type BuiltInPlan } from "@starter/bible-core/plans";
import { Button } from "@starter/ui/components/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@starter/ui/components/tabs";
import { cn } from "@starter/ui/lib/utils";
import { Check, RotateCcw, Play } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Card, Eyebrow, Page, PageHeader } from "../../components/page";
import { useToday } from "../../lib/state/clock";
import { planSchedule, planTitle, usePlans, type Plan } from "../../lib/state/plans-store";
import { usePreferences, useT } from "../../lib/state/preferences";
import { ActivePlan } from "./active-plan";
import { CustomPlanForm } from "./custom-plan-form";
import { PlanIcon, ProgressBar } from "./plan-parts";

const TABS = ["active", "browse", "finished"] as const;
type Tab = (typeof TABS)[number];

function BrowseCard({ plan, following, onStart }: { plan: BuiltInPlan; following: boolean; onStart: () => void }) {
  const t = useT();
  const { prefs } = usePreferences();
  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start gap-3">
        <PlanIcon planKey={plan.key} />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold leading-snug">{plan.title[prefs.locale]}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t.plans.days(plan.days.length)} · {t.plans.pace(planPace(plan))}
          </p>
        </div>
      </div>
      <p className="mt-3 flex-1 text-sm leading-relaxed text-foreground/80">{plan.description[prefs.locale]}</p>
      <div className="mt-4 flex justify-end">
        {following ? (
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <Check className="size-4" /> {t.plans.following}
          </span>
        ) : (
          <Button size="sm" onClick={onStart}>
            <Play /> {t.plans.start}
          </Button>
        )}
      </div>
    </Card>
  );
}

/** A finished or left plan, with Resume (left only) and Start over. */
function PastPlanRow({ plan }: { plan: Plan }) {
  const t = useT();
  const { prefs } = usePreferences();
  const today = useToday();
  const { resumePlan, restartPlan } = usePlans();
  const s = planSchedule(plan, today);
  const when = plan.status === "finished" ? plan.finishedAt : plan.leftAt;
  return (
    <li className="flex items-center gap-4 py-3.5 first:pt-0 last:pb-0">
      <PlanIcon planKey={plan.key} className="size-9" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold leading-tight">{planTitle(plan, prefs.locale)}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t.plans.completedDays(s.completed.size, s.totalDays)}
          {when !== null && ` · ${formatDay(dayKeyOf(new Date(when)), prefs.calendar, prefs.locale)}`}
        </p>
        {plan.status === "left" && <ProgressBar value={s.progress} className="mt-2 max-w-60" />}
      </div>
      {plan.status === "left" && (
        <Button size="sm" variant="outline" onClick={() => resumePlan(plan.id)}>
          <Play /> {t.plans.resume}
        </Button>
      )}
      <Button size="sm" variant="ghost" onClick={() => restartPlan(plan.id)}>
        <RotateCcw /> {t.plans.restart}
      </Button>
    </li>
  );
}

export function PlansPage() {
  const t = useT();
  const { prefs } = usePreferences();
  const { ready, plans, startPlan, startCustomPlan } = usePlans();
  const active = plans.filter((p) => p.status === "active");
  const finished = plans.filter((p) => p.status === "finished");
  const left = plans.filter((p) => p.status === "left");
  const [chosenTab, setTab] = useState<Tab | undefined>();
  const [chosenPlan, setChosenPlan] = useState<string | undefined>();
  const tab: Tab = chosenTab ?? (ready && active.length === 0 ? "browse" : "active");
  const selected = active.find((p) => p.id === chosenPlan) ?? active[0];

  const opened = (plan: Plan | undefined) => {
    if (!plan) return;
    toast(t.plans.started(planTitle(plan, prefs.locale)));
    setChosenPlan(plan.id);
    setTab("active");
  };

  return (
    <Page>
      <Tabs value={tab} onValueChange={(value) => setTab(TABS.find((x) => x === value))} className="flex flex-col">
        <PageHeader
          title={t.plans.title}
          subtitle={t.plans.subtitle}
          actions={
            <TabsList>
              <TabsTrigger value="active">
                {t.plans.active}
                {active.length > 0 && <span className="ml-1 tabular text-muted-foreground">{active.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="browse">{t.plans.browse}</TabsTrigger>
              <TabsTrigger value="finished">{t.plans.finished}</TabsTrigger>
            </TabsList>
          }
        />

        <TabsContent value="active">
          {active.length === 0 ? (
            ready && (
              <Card className="flex flex-col items-start gap-3">
                <p className="text-lg font-semibold">{t.plans.noActive}</p>
                <p className="text-sm text-muted-foreground">{t.plans.noActiveHint}</p>
                <Button onClick={() => setTab("browse")}>{t.plans.browsePlans}</Button>
              </Card>
            )
          ) : (
            <div className="flex flex-col gap-5">
              {active.length > 1 && (
                <div className="flex flex-wrap gap-2" role="tablist">
                  {active.map((plan) => (
                    <button
                      key={plan.id}
                      type="button"
                      role="tab"
                      aria-selected={plan.id === selected?.id}
                      onClick={() => setChosenPlan(plan.id)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm transition-colors",
                        plan.id === selected?.id ? "border-primary bg-primary/10 text-foreground" : "hover:bg-muted",
                      )}
                    >
                      {planTitle(plan, prefs.locale)}
                    </button>
                  ))}
                </div>
              )}
              {selected && <ActivePlan key={selected.id} plan={selected} />}
            </div>
          )}
        </TabsContent>

        <TabsContent value="browse" className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-4 @2xl:grid-cols-2 @5xl:grid-cols-3">
            {BUILT_IN_PLANS.map((plan) => (
              <BrowseCard
                key={plan.key}
                plan={plan}
                following={active.some((p) => p.key === plan.key)}
                onStart={() => void startPlan(plan.key).then(opened)}
              />
            ))}
          </div>
          <CustomPlanForm onCreate={(draft) => void startCustomPlan(draft).then(opened)} />
        </TabsContent>

        <TabsContent value="finished" className="flex flex-col gap-5">
          {finished.length === 0 && left.length === 0 && (
            <Card>
              <p className="text-sm text-muted-foreground">{t.plans.noFinished}</p>
            </Card>
          )}
          {finished.length > 0 && (
            <Card>
              <Eyebrow>{t.plans.finishedSection}</Eyebrow>
              <ul className="divide-y">
                {finished.map((plan) => (
                  <PastPlanRow key={plan.id} plan={plan} />
                ))}
              </ul>
            </Card>
          )}
          {left.length > 0 && (
            <Card>
              <Eyebrow>{t.plans.leftSection}</Eyebrow>
              <ul className="divide-y">
                {left.map((plan) => (
                  <PastPlanRow key={plan.id} plan={plan} />
                ))}
              </ul>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </Page>
  );
}
