import { BOOKS } from "@starter/bible-core/books";
import { addDays, formatDay, inCalendar, monthShort, type DayKey } from "@starter/bible-core/calendar";
import { makeVerseId } from "@starter/bible-core/verse-id";
import { cn } from "@starter/ui/lib/utils";
import { Link } from "@tanstack/react-router";

import { Heatmap } from "../../components/heatmap";
import { Card, Page, PageHeader } from "../../components/page";
import { usePreferences, useT } from "../../lib/state/preferences";
import { useStudy } from "../../lib/state/study-store";
import { useHabits } from "../../lib/state/use-habits";

/** Every chapter id of a book. */
const chaptersOf = (ord: number, count: number) => Array.from({ length: count }, (_c, i) => makeVerseId(ord, i + 1));

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
  const number = (n: number) => n.toLocaleString(prefs.locale === "am" ? "am-ET" : "en");

  // Start of the current year in the chosen calendar.
  let yearStart: DayKey = habits.today;
  const year = inCalendar(yearStart, prefs.calendar).year;
  while (inCalendar(addDays(yearStart, -1), prefs.calendar).year === year) yearStart = addDays(yearStart, -1);
  const thisYear = [...habits.minutes].filter(([day]) => day >= yearStart);
  const minutesThisYear = thisYear.reduce((sum, [, m]) => sum + m, 0);
  const lastYear = [...habits.minutes].filter(([day]) => day > addDays(habits.today, -365));

  const booksFinished = BOOKS.filter((b) =>
    chaptersOf(b.ord, b.chapters).every((c) => study.chaptersRead.has(c)),
  ).length;
  const totalChapters = BOOKS.reduce((sum, b) => sum + b.chapters, 0);

  const monthLabel = (firstOfColumn: DayKey) => {
    for (let i = 0; i < 7; i++) {
      const parts = inCalendar(addDays(firstOfColumn, i), prefs.calendar);
      // Pagume (the 13th Ethiopian month) is only 5–6 days; it is not labelled.
      if (parts.day === 1 && parts.month <= 12) return monthShort(prefs.calendar, parts.month, prefs.locale);
    }
    return undefined;
  };

  return (
    <Page>
      <PageHeader title={t.progress.title} />

      <div className="mb-5 grid grid-cols-2 gap-4 @3xl:grid-cols-4">
        <Stat value={habits.streak} label={`${t.progress.rhythm} · ${t.progress.days}`} />
        <Stat value={number(thisYear.length)} label={t.progress.daysThisYear} />
        <Stat value={number(minutesThisYear)} label={t.progress.minutesThisYear} />
        <Stat value={booksFinished} label={t.progress.booksFinished} />
      </div>

      <Card className="mb-5" label={t.progress.activity}>
        <div className="mb-5 flex items-baseline justify-between gap-4">
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
          dayLabel={(row) => (t.weekdaysShort[(row + prefs.rules.weekStartsOn) % 7] ?? "").slice(0, 2)}
          tooltip={(day, m) => t.progress.minutesOn(m, formatDay(day, prefs.calendar, prefs.locale))}
          legend={{ less: t.progress.less, more: t.progress.more }}
          summary={t.progress.heatmapSummary(
            lastYear.length,
            lastYear.reduce((sum, [, m]) => sum + m, 0),
          )}
        />
      </Card>

      <Card label={t.progress.coverage}>
        <div className="mb-5 flex items-baseline justify-between gap-4">
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
        <div className="mt-6 grid grid-cols-1 gap-x-10 gap-y-6 @4xl:grid-cols-2">
          {(["OT", "NT"] as const).map((testament) => (
            <div key={testament}>
              <h3 className="eyebrow mb-3">{testament === "OT" ? t.progress.oldTestament : t.progress.newTestament}</h3>
              <ul className="flex flex-col">
                {BOOKS.filter((b) => b.testament === testament).map((book) => {
                  const chapters = chaptersOf(book.ord, book.chapters);
                  const read = chapters.filter((c) => study.chaptersRead.has(c)).length;
                  const next = chapters.find((c) => !study.chaptersRead.has(c)) ?? chapters[0];
                  const name = book[prefs.locale].short;
                  return (
                    <li key={book.code}>
                      {/* One target per book: the whole row opens its first unread chapter. */}
                      <Link
                        to="/read"
                        search={{ c: next }}
                        aria-label={t.progress.bookProgress(name, read, book.chapters)}
                        className="flex items-center gap-2 rounded-md px-1 py-[3px] hover:bg-muted"
                      >
                        <span className="w-24 shrink-0 truncate text-[11px] text-muted-foreground">{name}</span>
                        <span aria-hidden className="flex flex-1 flex-wrap gap-[2px]">
                          {chapters.map((c) => (
                            <span
                              key={c}
                              className={cn(
                                "block size-[7px] rounded-[2px]",
                                study.chaptersRead.has(c) ? "bg-heat-3" : "bg-heat-0",
                              )}
                            />
                          ))}
                        </span>
                        <span
                          aria-hidden
                          className="w-11 shrink-0 text-right text-[11px] tabular text-muted-foreground"
                        >
                          {read}/{book.chapters}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </Card>
    </Page>
  );
}
