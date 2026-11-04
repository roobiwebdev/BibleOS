import { dayKeyOf, formatDay } from "@starter/bible-core/calendar";
import { Check } from "lucide-react";
import { useSyncExternalStore } from "react";

import { Reveal } from "../components/reveal";
import { SectionHeading } from "../components/section-heading";
import { COPY } from "../copy";
import { JOHN_3 } from "../demo/scripture";

const VERSE = JOHN_3.find((v) => v.n === 16);

const noSubscribe = () => () => undefined;
const ethiopianToday = (locale: "am" | "en") => formatDay(dayKeyOf(new Date()), "ethiopian", locale);

/**
 * SOURCE OF TRUTH KEYWORDS: AmharicShowcase, parallel reading, Ethiopian calendar, Amharic interface
 * WHAT:  John 3:16 in English and Amharic side by side, today's Ethiopian date, and what the app
 *        offers Amharic readers.
 * WHY:   Bilingual reading is what sets BibleOS apart, so the page shows it in real type. The
 *        date is computed in the browser with bible-core's calendar, the same code the app uses.
 * WHERE: app.tsx.
 */
export function Amharic() {
  const a = COPY.amharic;
  // Rendered in the browser only: the prerendered page must not freeze the build date.
  const todayAm = useSyncExternalStore(
    noSubscribe,
    () => ethiopianToday("am"),
    () => undefined,
  );
  const todayEn = useSyncExternalStore(
    noSubscribe,
    () => ethiopianToday("en"),
    () => undefined,
  );

  return (
    <section id="amharic" aria-labelledby="amharic-title" className="border-y bg-sidebar py-20 sm:py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16">
        <Reveal>
          <SectionHeading id="amharic-title" eyebrow={a.eyebrow} title={a.title} align="left">
            <p>{a.body}</p>
          </SectionHeading>
          <ul className="mt-8 flex flex-col gap-3">
            {a.points.map((p) => (
              <li key={p} className="flex gap-3 text-[15.5px] leading-relaxed">
                <Check className="mt-1 size-4 shrink-0 text-primary" aria-hidden />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal>
          <div className="lift rounded-2xl border bg-card p-6 sm:p-8">
            <p className="eyebrow">John 3:16 · ዮሐንስ 3፥16</p>
            <div className="mt-5 grid gap-6 sm:grid-cols-2">
              <figure>
                <blockquote lang="en" className="scripture text-[19px] leading-[1.6]">
                  {VERSE?.en}
                </blockquote>
                <figcaption className="mt-3 text-[12.5px] text-muted-foreground">Berean Standard Bible</figcaption>
              </figure>
              <figure className="border-t pt-6 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-6">
                <blockquote lang="am" className="scripture text-[19px] leading-[1.85]">
                  {VERSE?.am}
                </blockquote>
                <figcaption className="mt-3 text-[12.5px] text-muted-foreground">
                  Amharic Unlocked Literal Bible
                </figcaption>
              </figure>
            </div>
            <div className="mt-8 grid gap-4 border-t pt-6 sm:grid-cols-2">
              <div>
                <p className="text-[12.5px] text-muted-foreground">{a.today}</p>
                <p lang="am" className="mt-1 text-[17px] font-semibold">
                  {todayAm ?? "\u00a0"}
                </p>
                <p className="text-[13px] text-muted-foreground">{todayEn ?? "\u00a0"}</p>
              </div>
              <div>
                <p className="text-[12.5px] text-muted-foreground">{a.navSampleLabel}</p>
                <ul lang="am" className="mt-2 flex flex-wrap gap-1.5">
                  {a.navSample.map((label) => (
                    <li key={label} className="rounded-full bg-muted px-2.5 py-0.5 text-[13.5px]">
                      {label}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
