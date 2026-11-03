import { BUILT_IN_PLANS } from "@starter/bible-core/plans";
import { CalendarDays, Command, DatabaseBackup, History, Palette, Type, type LucideIcon } from "lucide-react";

import { Reveal } from "../components/reveal";
import { Screenshot } from "../components/screenshot";
import { SectionHeading } from "../components/section-heading";
import { COPY } from "../copy";

const EXTRA_ICONS: readonly LucideIcon[] = [Command, CalendarDays, History, Palette, DatabaseBackup, Type];

/**
 * SOURCE OF TRUTH KEYWORDS: Features, feature rows, screenshots, plans list, extras grid
 * WHAT:  What the app does, one screenshot per main screen, then the bundled plans and the
 *        smaller conveniences.
 * WHY:   Real screenshots show the app as it is. Plan names and lengths come from bible-core,
 *        so the list matches the app.
 * WHERE: app.tsx.
 */
export function Features() {
  const f = COPY.features;
  return (
    <section aria-labelledby="features-title" className="scroll-mt-20 py-20 sm:py-28" id="features">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading id="features-title" eyebrow={f.eyebrow} title={f.title} />

        <div className="mt-16 flex flex-col gap-20 sm:mt-20 sm:gap-28">
          {f.rows.map((row, i) => (
            <Reveal key={row.id}>
              <article className="grid items-center gap-8 lg:grid-cols-12 lg:gap-12">
                <div className={`lg:col-span-4 ${i % 2 === 1 ? "lg:order-2" : ""}`}>
                  <h3 className="scripture text-[1.6rem] leading-snug font-medium tracking-tight sm:text-[1.9rem]">
                    {row.title}
                  </h3>
                  <p className="mt-4 text-[16.5px] leading-relaxed text-muted-foreground">{row.body}</p>
                  {row.id === "plans" && (
                    <div className="mt-6">
                      <p className="eyebrow">{f.plansHeading}</p>
                      <ul className="mt-3 flex flex-col divide-y rounded-xl border bg-card/60 text-[14.5px]">
                        {BUILT_IN_PLANS.map((plan) => (
                          <li key={plan.key} className="flex items-baseline justify-between gap-3 px-3.5 py-2">
                            <span>{plan.title.en}</span>
                            <span className="tabular shrink-0 text-[13px] text-muted-foreground">
                              {f.days(plan.days.length)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <div className={`lg:col-span-8 ${i % 2 === 1 ? "lg:order-1" : ""}`}>
                  <Screenshot name={row.image} alt={row.alt} />
                </div>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal>
          <ul className="mt-24 grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {f.extras.map((item, i) => {
              const Icon = EXTRA_ICONS[i] ?? Command;
              return (
                <li key={item.title} className="bg-background p-6">
                  <Icon className="size-5 text-primary" aria-hidden />
                  <h3 className="mt-3 text-[15px] font-semibold">{item.title}</h3>
                  <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted-foreground">{item.body}</p>
                </li>
              );
            })}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
