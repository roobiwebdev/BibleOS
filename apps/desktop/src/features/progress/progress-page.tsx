import { BOOKS } from "@starter/bible-core/books";
import { addDays, formatDay, inCalendar, monthName, type DayKey } from "@starter/bible-core/calendar";
import { makeVerseId } from "@starter/bible-core/verse-id";
import { cn } from "@starter/ui/lib/utils";
import { Link } from "@tanstack/react-router";

import { Heatmap } from "../../components/heatmap";
import { usePreferences, useT } from "../../lib/state/preferences";
import { useStudy } from "../../lib/state/study-store";
import { useHabits } from "../../lib/state/use-habits";

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-xs">
      <p className="text-3xl font-semibold tracking-tight tabular">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export function ProgressPage() {
  const t = useT();
  const { prefs } = usePreferences();
  const study = useStudy();
  const habits = useHabits();

  const yearStart = (() => {
    // Start of the current year in the chosen calendar.
    let day: DayKey = habits.today;
    const year = inCalendar(day, prefs.calendar).year;
    while (inCalendar(addDays(day, -1), prefs.calendar).year === year) day = addDays(day, -1);
    return day;
  })();
  const thisYear = [...habits.minutes].filter(([day]) => day >= yearStart);
  const minutesThisYear = thisYear.reduce((sum, [, m]) => sum + m, 0);
  const booksFinished = BOOKS.filter((b) =>
    Array.from({ length: b.chapters }, (_, i) => makeVerseId(b.ord, i + 1)).every((c) => study.chaptersRead.has(c)),
  ).length;
  const totalChapters = BOOKS.reduce((sum, b) => sum + b.chapters, 0);

  const monthLabel = (firstOfColumn: DayKey) => {
    for (let i = 0; i < 7; i++) {
      const day = addDays(firstOfColumn, i);
      const parts = inCalendar(day, prefs.calendar);
      if (parts.day === 1)
        return monthName(prefs.calendar, parts.month, prefs.locale).slice(0, prefs.locale === "am" ? 4 : 3);
    }
    return undefined;
  };

  return (
    <div className="h-full overflow-y-auto">
      <div data-tauri-drag-region className="h-11" />
      <div className="mx-auto max-w-5xl px-10 pb-16">
        <h1 className="mb-8 text-3xl font-semibold tracking-tight">{t.progress.title}</h1>

        <div className="mb-5 grid grid-cols-4 gap-4">
          <Stat value={habits.streak} label={`${t.progress.rhythm} (${t.progress.days})`} />
          <Stat value={thisYear.length} label={t.progress.daysThisYear} />
          <Stat value={minutesThisYear.toLocaleString()} label={t.progress.minutesThisYear} />
          <Stat value={booksFinished} label={t.progress.booksFinished} />
        </div>

        <section className="mb-5 rounded-2xl border bg-card p-6 shadow-xs">
          <div className="mb-5 flex items-baseline justify-between">
            <h2 className="font-semibold">{t.progress.activity}</h2>
            <Link to="/settings" className="text-xs text-muted-foreground hover:text-foreground">
              {t.progress.goal(prefs.goalMinutes)}
            </Link>
          </div>
          <Heatmap
            minutes={habits.minutes}
            today={habits.today}
            goalMinutes={prefs.goalMinutes}
            weekStartsOn={prefs.rules.weekStartsOn}
            monthLabel={monthLabel}
            dayLabel={(row) => t.weekdaysShort[(row + prefs.rules.weekStartsOn) % 7] ?? ""}
            tooltip={(day, m) => t.progress.minutesOn(m, formatDay(day, prefs.calendar, prefs.locale))}
            legend={{ less: t.progress.less, more: t.progress.more }}
          />
        </section>

        <section className="rounded-2xl border bg-card p-6 shadow-xs">
          <div className="mb-5 flex items-baseline justify-between">
            <h2 className="font-semibold">{t.progress.coverage}</h2>
            <span className="text-xs text-muted-foreground">
              {t.progress.chaptersRead(study.chaptersRead.size, totalChapters)}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${(study.chaptersRead.size / totalChapters) * 100}%` }}
            />
          </div>
          <div className="mt-6 grid grid-cols-2 gap-x-10">
            {(["OT", "NT"] as const).map((testament) => (
              <div key={testament}>
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {testament === "OT" ? t.progress.oldTestament : t.progress.newTestament}
                </p>
                <div className="flex flex-col gap-1">
                  {BOOKS.filter((b) => b.testament === testament).map((book) => {
                    const read = Array.from({ length: book.chapters }, (_, i) =>
                      study.chaptersRead.has(makeVerseId(book.ord, i + 1)),
                    );
                    return (
                      <div key={book.code} className="flex items-center gap-2">
                        <span className="w-24 shrink-0 truncate text-[11px] text-muted-foreground">
                          {book[prefs.locale].short}
                        </span>
                        <div className="flex flex-wrap gap-[2px]">
                          {read.map((isRead, i) => (
                            <Link
                              key={i}
                              to="/read"
                              search={{ c: makeVerseId(book.ord, i + 1) }}
                              title={`${book[prefs.locale].short} ${i + 1}`}
                              className={cn(
                                "block size-[7px] rounded-[2px] transition-transform hover:scale-150",
                                isRead ? "bg-heat-3" : "bg-heat-0",
                              )}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
