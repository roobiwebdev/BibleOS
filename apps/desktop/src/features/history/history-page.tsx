import { bookByOrd } from "@starter/bible-core/books";
import { addDays, dayKeyOf, formatDay, type DayKey } from "@starter/bible-core/calendar";
import { formatRange } from "@starter/bible-core/range";
import { chapterOf, splitVerseId, type VerseId } from "@starter/bible-core/verse-id";
import { TRANSLATIONS } from "@starter/bible-data/manifest";
import { Button } from "@starter/ui/components/button";
import { Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen, History } from "lucide-react";

import { Card, Eyebrow, Page, PageHeader } from "../../components/page";
import { useToday } from "../../lib/state/clock";
import { usePreferences, useT } from "../../lib/state/preferences";
import { useReadingHistory } from "./use-history";

const abbreviation = (translationId: string) =>
  TRANSLATIONS.find((x) => x.id === translationId)?.abbreviation ?? translationId;

/** "John 3" in the interface language, for a chapter id. */
function useChapterName(): (chapterVid: VerseId) => string {
  const { prefs } = usePreferences();
  return (chapterVid) => {
    const { ord, chapter } = splitVerseId(chapterVid);
    const book = bookByOrd(ord);
    return book ? `${book[prefs.locale].short} ${chapter}` : "";
  };
}

function DayHeading({ day, today }: { day: DayKey; today: DayKey }) {
  const t = useT();
  const { prefs } = usePreferences();
  const date = formatDay(day, prefs.calendar, prefs.locale);
  const relative = day === today ? t.history.today : day === addDays(today, -1) ? t.history.yesterday : null;
  return (
    <h3 className="text-sm font-semibold">
      {relative ?? date}
      {relative && <span className="ml-2 font-normal text-muted-foreground">{date}</span>}
    </h3>
  );
}

function EmptyHistory() {
  const t = useT();
  return (
    <Card className="mx-auto mt-6 max-w-lg text-center">
      <History aria-hidden className="mx-auto mb-4 size-8 text-muted-foreground" />
      <h2 className="text-lg font-semibold">{t.history.emptyTitle}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{t.history.emptyBody}</p>
      <Button asChild className="mt-6">
        <Link to="/read">
          <BookOpen /> {t.history.startReading}
        </Link>
      </Button>
    </Card>
  );
}

/**
 * SOURCE OF TRUTH KEYWORDS: HistoryPage, reading history, reading timeline, continue where you left off, recently read
 * WHAT:  The History screen: a timeline of reading days (newest first, in the reader's calendar
 *        and language) with the chapters read and minutes, a "continue where you left off" card
 *        and the recently read chapters, each linking back into the reader.
 * WHY:   Finding your way back should be easy and calm: days without reading are simply not
 *        listed, and there are no counts of missed days or streak warnings here.
 * WHERE: route /history (router.tsx), sidebar nav.
 */
export function HistoryPage() {
  const t = useT();
  const { prefs } = usePreferences();
  const today = useToday();
  const chapterName = useChapterName();
  const history = useReadingHistory();
  const isEmpty = history.status === "ready" && history.days.length === 0 && history.recent.length === 0;

  return (
    <Page>
      <PageHeader title={t.history.title} subtitle={t.history.subtitle} />
      {history.status === "loading" && (
        <p className="py-16 text-center text-sm text-muted-foreground" role="status">
          {t.history.loading}
        </p>
      )}
      {history.status === "failed" && (
        <p className="py-16 text-center text-sm text-muted-foreground" role="alert">
          {t.history.loadFailed}
        </p>
      )}
      {isEmpty && <EmptyHistory />}
      {history.status === "ready" && !isEmpty && (
        <div className="grid grid-cols-1 gap-8 @3xl:grid-cols-[minmax(0,1fr)_280px]">
          <section aria-labelledby="history-timeline" className="min-w-0 @3xl:order-1">
            <Eyebrow>
              <span id="history-timeline">{t.history.timeline}</span>
            </Eyebrow>
            <ol className="relative flex flex-col gap-6 border-l pl-6">
              {history.days.map((d) => (
                <li key={d.day} className="relative">
                  <span
                    aria-hidden
                    className="absolute top-1.5 -left-[29px] size-2.5 rounded-full border-2 border-background bg-primary"
                  />
                  <div className="flex items-baseline justify-between gap-4">
                    <DayHeading day={d.day} today={today} />
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {t.history.minutes(d.minutes)}
                    </span>
                  </div>
                  <ul className="mt-2 flex flex-wrap gap-2" aria-label={t.history.chapters(d.chapters.length)}>
                    {d.chapters.map((c) => (
                      <li key={`${c.chapterVid}-${c.translationId}`}>
                        <Link
                          to="/read"
                          search={{ c: c.chapterVid }}
                          className="inline-flex items-baseline gap-2 rounded-lg border bg-card px-3 py-1.5 text-sm transition-colors hover:bg-muted"
                        >
                          <span className="font-medium">{chapterName(c.chapterVid)}</span>
                          <span className="text-[11px] text-muted-foreground">
                            {abbreviation(c.translationId)} · {t.history.minutes(c.minutes)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
            {history.nextBefore && (
              <Button
                variant="outline"
                size="sm"
                className="mt-6 ml-6"
                disabled={history.loadingMore}
                onClick={history.loadMoreDays}
              >
                {history.loadingMore ? t.history.loading : t.history.loadMore}
              </Button>
            )}
          </section>

          <aside className="flex flex-col gap-6 @3xl:order-2">
            {history.resume && (
              <Card className="p-5">
                <Eyebrow>{t.history.resumeTitle}</Eyebrow>
                <p className="text-lg font-semibold">
                  {formatRange({ start: history.resume.vid, end: history.resume.vid }, prefs.locale)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {abbreviation(history.resume.translationId)} ·{" "}
                  {t.history.lastRead(
                    formatDay(dayKeyOf(new Date(history.resume.endedAt)), prefs.calendar, prefs.locale),
                  )}
                </p>
                <Button asChild size="sm" className="mt-4">
                  <Link
                    to="/read"
                    search={{
                      c: chapterOf(history.resume.vid),
                      v: splitVerseId(history.resume.vid).verse || undefined,
                    }}
                  >
                    {t.history.resumeAction} <ArrowRight />
                  </Link>
                </Button>
              </Card>
            )}
            {history.recent.length > 0 && (
              <section aria-labelledby="history-recent">
                <Eyebrow>
                  <span id="history-recent">{t.history.recent}</span>
                </Eyebrow>
                <ul className="flex flex-col">
                  {history.recent.map((c) => (
                    <li key={c.chapterVid}>
                      <Link
                        to="/read"
                        search={{ c: c.chapterVid }}
                        className="flex items-baseline justify-between gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                      >
                        <span className="font-medium">{chapterName(c.chapterVid)}</span>
                        <span className="text-[11px] text-muted-foreground">{t.history.readTimes(c.times)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
                {history.nextCursor && (
                  <Button variant="ghost" size="sm" className="mt-1" onClick={history.loadMoreChapters}>
                    {t.history.loadMoreChapters}
                  </Button>
                )}
              </section>
            )}
          </aside>
        </div>
      )}
    </Page>
  );
}
