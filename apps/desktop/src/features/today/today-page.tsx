import { bookByCode, bookByOrd, type Locale } from "@starter/bible-core/books";
import { formatRange } from "@starter/bible-core/range";
import { dayKeyToJdn, formatDay } from "@starter/bible-core/calendar";
import { chapterOf, splitVerseId, verseIdFromCode, type VerseId } from "@starter/bible-core/verse-id";
import { DEFAULT_TRANSLATIONS } from "@starter/local-api/schemas";
import { Button } from "@starter/ui/components/button";
import { Textarea } from "@starter/ui/components/textarea";
import { cn } from "@starter/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { useState } from "react";

import { OnlineAttribution, OnlineUnavailable } from "../../components/online-text";
import { Card, Eyebrow, Page, PageHeader } from "../../components/page";
import { WeekDots } from "../../components/week-dots";
import { TodaysReading } from "../plans/todays-reading";
import { findReaderTranslation, isOnline, type ReaderTranslation } from "../../lib/bible/catalog";
import { covers, pickTranslation } from "../../lib/bible/translations";
import { useChapter, usePassage } from "../../lib/bible/use-chapter";
import { useNow } from "../../lib/state/clock";
import { usePreferences, useT } from "../../lib/state/preferences";
import { useStudy } from "../../lib/state/study-store";
import { useHabits } from "../../lib/state/use-habits";

// Curated verses of the day, rotating daily.
const VERSES_OF_THE_DAY = [
  ["JHN", 3, 16],
  ["PSA", 23, 1],
  ["ROM", 8, 28],
  ["PSA", 91, 1],
  ["1CO", 13, 4],
  ["JHN", 1, 14],
  ["ROM", 8, 38],
] as const;

/**
 * SOURCE OF TRUTH KEYWORDS: VotdQuote, verse of the day text, one side of the verse of the day
 * WHAT:  One translation's text of the verse of the day, with its language set. Online
 *        translations ask their publisher for this one verse and show their attribution, or
 *        "needs internet" with a retry.
 * WHY:   Both sides of the verse of the day may be bundled or online (an ESV main text with the
 *        2005 beside it), and each handles a missing connection on its own.
 * WHERE: Today.
 */
function VotdQuote({
  translation,
  vid,
  placeholder,
  textClassName,
  className,
}: {
  translation: ReaderTranslation | undefined;
  vid: VerseId;
  placeholder: string;
  textClassName: string;
  className?: string;
}) {
  const t = useT();
  const load = usePassage(translation?.id ?? "", { start: vid, end: vid });
  const verse = load.data?.find((v) => v.vid <= vid && v.spanEnd >= vid);
  if (load.error && isOnline(translation)) {
    return (
      <OnlineUnavailable
        compact
        abbreviation={translation.abbreviation}
        reason={load.error}
        onRetry={load.retry}
        className={className}
      />
    );
  }
  if (load.data && !verse && isOnline(translation)) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>{t.online.notInText(translation.abbreviation)}</p>
    );
  }
  return (
    <div className={className}>
      <blockquote lang={translation?.language ?? "en"} className={textClassName}>
        {verse?.text ?? placeholder}
      </blockquote>
      {isOnline(translation) && verse && <OnlineAttribution translation={translation} className="mt-2" />}
    </div>
  );
}

export function TodayPage() {
  const t = useT();
  const { prefs } = usePreferences();
  const study = useStudy();
  const habits = useHabits();
  const [reflection, setReflection] = useState("");
  const [saved, setSaved] = useState(false);

  const hour = new Date(useNow()).getHours();
  const greeting = hour < 12 ? t.today.morning : hour < 18 ? t.today.afternoon : t.today.evening;
  const otherCalendar = prefs.calendar === "ethiopian" ? "gregorian" : "ethiopian";

  const [code, ch, vs] = VERSES_OF_THE_DAY[dayKeyToJdn(habits.today) % VERSES_OF_THE_DAY.length] ?? ["JHN", 3, 16];
  const votd = verseIdFromCode(code, ch, vs) ?? 0;
  // The verse in the main translation's language first, then in the other language. Each side
  // uses the reader's own translation in that language when it has the verse (the 1962 is New
  // Testament only; the online ESV and NLT have every book), else that language's featured
  // text (the 2005 for Amharic).
  const testament = bookByCode(code)?.testament;
  const mainMeta = findReaderTranslation(prefs.mainTranslation);
  const firstLang: Locale = mainMeta?.language ?? "am";
  const secondLang: Locale = firstLang === "am" ? "en" : "am";
  const yours = [prefs.mainTranslation, prefs.parallelTranslation];
  const choose = (lang: Locale): ReaderTranslation | undefined =>
    yours.map(findReaderTranslation).find((tr) => tr?.language === lang && (isOnline(tr) || covers(tr, testament))) ??
    findReaderTranslation(pickTranslation(lang, { testament })?.id ?? DEFAULT_TRANSLATIONS[lang]);
  const first = choose(firstLang);
  const second = choose(secondLang);

  const last = splitVerseId(study.lastRead);
  const lastBook = bookByOrd(last.ord);
  const lastChapter = useChapter(prefs.mainTranslation, chapterOf(study.lastRead));
  const snippet = lastChapter?.verses.find((v) => v.vid >= study.lastRead)?.text ?? "";
  const recent = study.notes.toSorted((a, b) => b.updatedAt - a.updatedAt).slice(0, 3);
  const progress = Math.min(1, habits.todayMinutes / prefs.goalMinutes);

  return (
    <Page>
      <PageHeader
        title={greeting}
        subtitle={
          <>
            {formatDay(habits.today, prefs.calendar, prefs.locale)}
            <span aria-hidden className="mx-2 opacity-40">
              ·
            </span>
            {formatDay(habits.today, otherCalendar, prefs.locale)}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-5 @4xl:grid-cols-3">
        <div className="flex flex-col gap-5 @4xl:col-span-2">
          <Card className="relative overflow-hidden">
            <Eyebrow>
              <Sparkles className="mr-1.5 inline size-3.5 -translate-y-px" />
              {t.today.verseOfDay}
            </Eyebrow>
            <VotdQuote
              translation={first}
              vid={votd}
              placeholder="…"
              textClassName="scripture text-[1.35em] leading-snug"
            />
            <VotdQuote
              translation={second}
              vid={votd}
              placeholder=""
              className="mt-4"
              textClassName="scripture text-[1.05em] text-foreground/80"
            />
            <div className="mt-5 flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                {formatRange({ start: votd, end: votd }, prefs.locale)}
                {[first, second].map(
                  (tr) =>
                    tr && (
                      <span key={tr.id} className="ml-2 text-xs font-semibold opacity-70">
                        {tr.abbreviation}
                      </span>
                    ),
                )}
              </span>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/read" search={{ c: chapterOf(votd), v: vs }}>
                  {t.study.openInReader} <ArrowRight />
                </Link>
              </Button>
            </div>
          </Card>

          <TodaysReading />

          <Card>
            <Eyebrow>{t.today.continueReading}</Eyebrow>
            <div className="flex items-center gap-5">
              <div className="min-w-0 flex-1">
                <p className="text-lg font-semibold">
                  {lastBook?.[prefs.locale].short} {last.chapter}
                </p>
                <p lang={mainMeta?.language} className="scripture mt-1 line-clamp-2 text-[0.9em] text-muted-foreground">
                  {snippet}
                </p>
                {isOnline(mainMeta) && snippet && <OnlineAttribution translation={mainMeta} className="mt-1" />}
              </div>
              <Button asChild>
                <Link to="/read" search={{ c: chapterOf(study.lastRead), v: last.verse || undefined }}>
                  {t.today.resume} <ArrowRight />
                </Link>
              </Button>
            </div>
          </Card>

          <Card>
            <Eyebrow>{t.today.reflection}</Eyebrow>
            <p className="mb-3 font-reading text-lg">{t.today.reflectionPrompt}</p>
            <Textarea
              value={reflection}
              onChange={(e) => {
                setReflection(e.target.value);
                setSaved(false);
              }}
              placeholder={t.today.reflectionPlaceholder}
              className="min-h-24 resize-none bg-background"
            />
            <div className="mt-3 flex items-center justify-end gap-3">
              {saved && (
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Check className="size-4" /> {t.today.saved}
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                disabled={!reflection.trim()}
                onClick={() => {
                  study.saveNote({
                    kind: "journal",
                    title: t.today.reflectionPrompt,
                    body: reflection.trim(),
                    tags: ["journal"],
                    anchors: [{ start: votd, end: votd }],
                  });
                  setReflection("");
                  setSaved(true);
                }}
              >
                {t.today.saveReflection}
              </Button>
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <Card>
            <Eyebrow>{t.today.thisWeek}</Eyebrow>
            <WeekDots dots={habits.dots} labels={t.weekdaysShort} />
            <p className="mt-5 text-sm font-medium">{t.today.daysRead(habits.daysThisWeek)}</p>
            <div className="mt-4">
              <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
                <span>
                  {habits.goalMet ? t.today.goalMet : t.today.minutesToday(habits.todayMinutes, prefs.goalMinutes)}
                </span>
                <span className="tabular">{Math.round(progress * 100)}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
            </div>
            <div className="mt-5 flex items-baseline gap-2 border-t pt-4">
              <span className="text-3xl font-semibold tabular">{habits.streak}</span>
              <span className="text-sm text-muted-foreground">
                {t.progress.days} · {t.progress.rhythm}
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t.today.graceNote}</p>
          </Card>

          <Card className="p-5">
            <Eyebrow>{t.today.recentNotes}</Eyebrow>
            <div className="flex flex-col divide-y">
              {recent.map((note) => (
                <Link key={note.id} to="/study" search={{ note: note.id }} className="py-3 first:pt-0 last:pb-0">
                  <p className="text-sm font-semibold">{note.title}</p>
                  {/* Plain text here: links inside a link are not allowed. */}
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {note.body.replace(/\[\[([^\]]+)\]\]/g, "$1")}
                  </p>
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </Page>
  );
}
