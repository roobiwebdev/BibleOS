import { dayKeyOf, formatDay } from "@starter/bible-core/calendar";
import {
  BookmarkPlus,
  BookOpen,
  Bookmark,
  ChartNoAxesColumn,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Copy,
  Eraser,
  Feather,
  History,
  ListChecks,
  NotebookPen,
  PanelRight,
  Search,
  Settings,
  Sun,
  X,
  type LucideIcon,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import iconNight from "../assets/icon-night-256.png";
import iconPaper from "../assets/icon-paper-256.png";
import iconSepia from "../assets/icon-sepia-256.png";
import logoNight from "../assets/logo-night.png";
import logoPaper from "../assets/logo-paper.png";
import logoSepia from "../assets/logo-sepia.png";
import { easeInOut, easeOut, envelope, lerp, span } from "./ease";
import { JOHN_3, SEARCH_QUERY, SEARCH_RESULTS, SEARCH_TOTAL, VERSE_OF_DAY } from "./scripture";
import { STAGE, T, caretOn, typed } from "./script";

type Theme = "paper" | "sepia" | "night";
type Page = "today" | "read" | "search";

const THEMES: readonly Theme[] = ["paper", "sepia", "night"];
const THEME_LABEL: Record<Theme, string> = { paper: "Paper", sepia: "Sepia", night: "Night" };
const LOGOS: Record<Theme, string> = { paper: logoPaper, sepia: logoSepia, night: logoNight };
const ICONS: Record<Theme, string> = { paper: iconPaper, sepia: iconSepia, night: iconNight };
const SWATCHES = ["promise", "command", "prayer", "insight", "question"] as const;
const SWATCH_BG: Record<(typeof SWATCHES)[number], string> = {
  promise: "bg-hl-promise",
  command: "bg-hl-command",
  prayer: "bg-hl-prayer",
  insight: "bg-hl-insight",
  question: "bg-hl-question",
};

const NAV: readonly { key: string; icon: LucideIcon; page?: Page }[] = [
  { key: "Today", icon: Sun, page: "today" },
  { key: "Read", icon: BookOpen, page: "read" },
  { key: "Plans", icon: ListChecks },
  { key: "Study", icon: NotebookPen },
  { key: "History", icon: History },
  { key: "Progress", icon: ChartNoAxesColumn },
];

/** Reading days this week, Wednesday to today (Tuesday); Friday was missed. */
const WEEK = [
  { day: "Wed", read: true },
  { day: "Thu", read: true },
  { day: "Fri", read: false },
  { day: "Sat", read: true },
  { day: "Sun", read: true },
  { day: "Mon", read: true },
  { day: "Tue", read: true },
];

const WINDOW = { x: 60, y: 30, w: 1080, h: 640 } as const;
const SIDEBAR = 204;
const MAIN = WINDOW.w - SIDEBAR;
const RAIL = 272;
const COLUMNS = 584;

function themeAt(t: number): Theme {
  if (t >= T.theme.sepia) return "sepia";
  if (t >= T.theme.paper) return "paper";
  if (t >= T.theme.night) return "night";
  return "sepia";
}

function pageAt(t: number): { page: Page; since: number } {
  if (t >= T.theme.open - 200) return { page: "read", since: T.theme.open - 200 };
  if (t >= T.search.land) return { page: "search", since: T.search.land };
  if (t >= T.jump.land) return { page: "read", since: T.jump.land };
  return { page: "today", since: 0 };
}

const mix = (token: string, p: number) =>
  p > 0 ? `color-mix(in oklch, var(${token}) ${(p * 100).toFixed(1)}%, transparent)` : undefined;

function Caret({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className="ml-px inline-block h-[1.1em] w-[1.5px] translate-y-[0.15em] bg-primary"
      style={{ opacity: on ? 1 : 0 }}
    />
  );
}

/**
 * SOURCE OF TRUTH KEYWORDS: DemoScene, hero demo, scripted app recreation, today, reader, palette, search, themes
 * WHAT:  A still frame of the BibleOS window at time `t`: Today, the ⌘K palette jumping to
 *        John 3:16 in parallel, a highlight and a note, an Amharic search, and the theme switch.
 * WHY:   Drawn from the app's own tokens, fonts and real scripture rather than a video, so it is
 *        crisp at any size, weighs a few kilobytes and follows the page theme. Everything is a
 *        pure function of `t`; the showcase owns playback.
 * WHERE: demo/showcase.tsx.
 */
export function DemoScene({ t }: { t: number }) {
  const theme = themeAt(t);
  const { page, since } = pageAt(t);
  const pageIn = since === 0 ? 1 : easeOut(span(t, since, since + 320));

  // ⌘K palette: once to jump to John 3:16, once to search.
  const jumpPalette = envelope(t, T.jump.open, T.jump.open + 200, T.jump.enter + 80, T.jump.enter + 260);
  const searchPalette = envelope(t, T.search.open, T.search.open + 200, T.search.enter + 80, T.search.enter + 260);

  // Study on John 3:16.
  const selected = t >= T.study.select && t < T.study.barOut;
  const bar = envelope(t, T.study.bar, T.study.bar + 200, T.study.barOut, T.study.barOut + 200);
  const highlight = span(t, T.study.pick, T.study.pick + 300);
  const rail = easeInOut(span(t, T.study.rail, T.study.rail + 420));
  const flash =
    page === "read" && t < T.study.select
      ? envelope(t, T.jump.flash[0], T.jump.flash[0] + 250, T.jump.flash[1] - 600, T.jump.flash[1])
      : 0;

  const themePicker = envelope(t, T.theme.open, T.theme.open + 220, T.theme.close, T.theme.close + 220);

  return (
    <div className="relative overflow-hidden select-none" style={{ width: STAGE.w, height: STAGE.h }}>
      <div
        className="absolute inset-0 bg-stage"
        style={{
          backgroundImage:
            "radial-gradient(120% 90% at 50% 0%, color-mix(in oklch, var(--primary) 45%, transparent), transparent 70%), radial-gradient(80% 70% at 100% 100%, color-mix(in oklch, var(--hl-promise) 55%, transparent), transparent 70%)",
        }}
      />

      <div
        data-theme={theme}
        className="absolute flex overflow-hidden rounded-[14px] bg-background font-sans text-foreground shadow-2xl ring-1 ring-foreground/10 [&_*]:transition-colors [&_*]:duration-500"
        style={{ left: WINDOW.x, top: WINDOW.y, width: WINDOW.w, height: WINDOW.h }}
      >
        <Sidebar theme={theme} page={page} t={t} />

        <div className="relative h-full overflow-hidden" style={{ width: MAIN }}>
          <div className="absolute inset-0" style={{ opacity: pageIn, transform: `translateY(${(1 - pageIn) * 8}px)` }}>
            {page === "today" && <TodayView t={t} />}
            {page === "read" && (
              <ReaderView t={t} rail={rail} highlight={highlight} flash={flash} selected={selected} />
            )}
            {page === "search" && <SearchView t={t} />}
          </div>

          {bar > 0 && (
            <SelectionBar
              opacity={bar}
              offset={(MAIN - RAIL * rail) / 2}
              picked={t >= T.study.pick}
              noteDown={t >= T.study.note && t < T.study.note + 160}
            />
          )}

          {themePicker > 0 && <ThemePicker opacity={themePicker} theme={theme} />}
        </div>

        {(jumpPalette > 0 || searchPalette > 0) && (
          <Palette t={t} opacity={Math.max(jumpPalette, searchPalette)} mode={jumpPalette > 0 ? "jump" : "search"} />
        )}
      </div>

      <Dock theme={theme} />
    </div>
  );
}

function Sidebar({ theme, page, t }: { theme: Theme; page: Page; t: number }) {
  const today = span(t, T.today.fill[1] - 300, T.today.fill[1]);
  return (
    <aside className="flex h-full shrink-0 flex-col border-r bg-sidebar" style={{ width: SIDEBAR }}>
      <div className="flex h-11 items-center gap-2 px-4">
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-3 rounded-full bg-foreground/15" />
        ))}
      </div>
      <div className="px-4 pb-4">
        <div className="flex items-center gap-2 px-1">
          <span className="relative size-7">
            {THEMES.map((th) => (
              <img
                key={th}
                src={LOGOS[th]}
                alt=""
                className="absolute inset-0 size-7 rounded-[7px] transition-opacity duration-500"
                style={{ opacity: th === theme ? 1 : 0 }}
              />
            ))}
          </span>
          <span className="text-[15px] font-semibold tracking-tight">BibleOS</span>
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-lg border bg-card px-2.5 py-1.5 text-[13px] text-muted-foreground">
          <Search className="size-3.5" />
          <span className="flex-1">Go to…</span>
          <kbd className="rounded border bg-muted px-1 text-[10px] font-medium">⌘K</kbd>
        </div>
      </div>
      <nav className="flex flex-col gap-0.5 px-2">
        {NAV.map(({ key, icon: Icon, page: target }) => (
          <span
            key={key}
            className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13.5px] font-medium ${
              target === page ? "bg-accent text-accent-foreground" : "text-muted-foreground"
            }`}
          >
            <Icon className="size-4" />
            {key}
          </span>
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-3 p-4">
        <div className="rounded-xl border bg-card p-3">
          <div className="mb-2.5 flex items-baseline justify-between">
            <span className="text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">This week</span>
            <span className="tabular text-[10.5px] text-muted-foreground">{Math.round(lerp(4, 9, today))}/15 min</span>
          </div>
          <WeekDots t={t} size={9} gap={14} />
          <p className="mt-2.5 text-xs font-medium">21-day rhythm</p>
        </div>
        <span className="flex items-center gap-2.5 px-2.5 py-1 text-[13.5px] font-medium text-muted-foreground">
          <Settings className="size-4" />
          Settings
        </span>
      </div>
    </aside>
  );
}

/** Week dots fill one by one at the start of the loop; the last one is today. */
function WeekDots({ t, size, gap, labels = false }: { t: number; size: number; gap: number; labels?: boolean }) {
  const [start, end] = T.today.fill;
  const step = (end - start) / WEEK.length;
  return (
    <div className="flex justify-between" style={{ gap }}>
      {WEEK.map((d, i) => {
        const p = d.read ? easeOut(span(t, start + i * step, start + (i + 1) * step)) : 0;
        return (
          <div key={d.day} className="flex flex-col items-center gap-1.5">
            <span className="relative rounded-full bg-heat-0" style={{ width: size, height: size }}>
              <span
                className="absolute inset-0 rounded-full bg-primary"
                style={{ transform: `scale(${p})`, opacity: p }}
              />
            </span>
            {labels && <span className="text-[10.5px] text-muted-foreground">{d.day}</span>}
          </div>
        );
      })}
    </div>
  );
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border bg-card p-5 ${className}`}>{children}</div>;
}

// The demo runs only in the browser (lazy-loaded), so the date is read once when it loads.
const TODAY = dayKeyOf(new Date());

function TodayView({ t }: { t: number }) {
  const key = TODAY;
  const [start, end] = T.today.fill;
  const p = easeOut(span(t, start, end + 400));
  return (
    <div className="h-full px-10 pt-9">
      <p className="text-[13px] text-muted-foreground">
        {formatDay(key, "gregorian", "en")} · {formatDay(key, "ethiopian", "en")}
      </p>
      <h3 className="mt-1 text-[28px] font-semibold tracking-tight">Good morning</h3>

      <div className="mt-6 grid gap-5" style={{ gridTemplateColumns: "1fr 250px" }}>
        <div className="flex flex-col gap-4">
          <Card>
            <p className="eyebrow text-[10.5px]">Verse of the day</p>
            <p lang="en" className="scripture mt-3 text-[19px] leading-snug">
              {VERSE_OF_DAY.en}
            </p>
            <p lang="am" className="scripture mt-2.5 text-[17px] leading-relaxed">
              {VERSE_OF_DAY.am}
            </p>
            <div className="mt-3 flex items-center justify-between text-[13px]">
              <span className="text-muted-foreground">{VERSE_OF_DAY.ref}</span>
              <span className="font-medium">Open in reader →</span>
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <p className="eyebrow text-[10.5px]">Today’s reading</p>
              <span className="text-[12px] text-muted-foreground">Open plans →</span>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-full bg-muted text-primary">
                <Feather className="size-4" />
              </span>
              <div className="flex-1">
                <p className="text-[15px] font-semibold">Gospel of John</p>
                <p className="text-[12px] text-muted-foreground">Day 3 · John 3</p>
              </div>
              <span className="size-5 rounded-full border-2" />
            </div>
          </Card>
          <Card className="flex items-center justify-between">
            <div>
              <p className="eyebrow text-[10.5px]">Continue reading</p>
              <p className="mt-2 text-[15px] font-semibold">John 3</p>
              <p lang="en" className="scripture text-[15px] text-muted-foreground">
                Now there was a man of the Pharisees named Nicodemus…
              </p>
            </div>
            <span className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-[13px] font-medium whitespace-nowrap text-primary-foreground">
              Resume →
            </span>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <p className="eyebrow text-[10.5px]">This week</p>
            <div className="mt-3">
              <WeekDots t={t} size={22} gap={4} labels />
            </div>
            <p className="mt-3 text-[13px] font-medium">You read on 6 of the last 7 days</p>
            <div className="mt-3 flex justify-between text-[11px] text-muted-foreground">
              <span className="tabular">{Math.round(lerp(4, 9, p))} of 15 min today</span>
              <span className="tabular">{Math.round(lerp(27, 60, p))}%</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-heat-0">
              <div className="h-full rounded-full bg-primary" style={{ width: `${lerp(27, 60, p)}%` }} />
            </div>
            <div className="mt-4 border-t pt-4">
              <span className="tabular text-[30px] font-semibold">
                {Math.round(lerp(20, 21, span(t, end, end + 200)))}
              </span>
              <span className="ml-1.5 text-[13px] text-muted-foreground">days · Current rhythm</span>
              <p className="mt-1 text-[11.5px] leading-snug text-muted-foreground">
                Missed a day? A grace day keeps your rhythm going.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Toolbar({ children }: { children?: ReactNode }) {
  return (
    <div className="flex h-12 items-center gap-1.5 border-b px-4 text-muted-foreground">
      <ChevronLeft className="size-4" />
      <ChevronRight className="size-4" />
      <span className="ml-3 text-[14px] font-semibold text-foreground">John 3</span>
      <span lang="am" className="text-[12px]">
        ዮሐንስ 3
      </span>
      <span className="flex-1" />
      {children}
      <Bookmark className="size-4" />
      <span className="ml-3 text-[12px] font-semibold text-foreground">BSB</span>
      <span className="text-[12px]">·</span>
      <span className="text-[12px] font-semibold text-foreground">ULB</span>
      <span className="ml-3 grid size-7 place-items-center rounded-md bg-accent text-accent-foreground">
        <Columns2 className="size-4" />
      </span>
      <span className="grid size-7 place-items-center rounded-md">
        <PanelRight className="size-4" />
      </span>
    </div>
  );
}

function ReaderView({
  t,
  rail,
  highlight,
  flash,
  selected,
}: {
  t: number;
  rail: number;
  highlight: number;
  flash: number;
  selected: boolean;
}) {
  const left = lerp((MAIN - COLUMNS) / 2, (MAIN - RAIL - COLUMNS) / 2, rail);
  const saved = t >= T.study.save;
  const verseStyle = (n: number): CSSProperties => {
    if (n !== 16) return {};
    const bg = highlight > 0 ? mix("--hl-promise", highlight) : mix("--accent", flash);
    return { backgroundColor: bg, boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" };
  };
  return (
    <div className="relative h-full">
      <Toolbar />
      <div
        className="absolute top-12 bottom-0 overflow-hidden"
        style={{
          left,
          width: COLUMNS,
          maskImage: "linear-gradient(transparent, black 28px, black calc(100% - 40px), transparent)",
        }}
      >
        <div className="grid grid-cols-2 gap-x-8 gap-y-3.5 pt-6">
          {JOHN_3.map((v) => (
            <div key={v.n} className="contents">
              <p lang="en" className="scripture text-[15.5px] leading-[1.6]">
                <sup className="verse-number mr-1 text-muted-foreground">{v.n}</sup>
                <span
                  className={`rounded-[3px] ${v.n === 16 && selected ? "underline decoration-primary decoration-2 underline-offset-[5px]" : ""}`}
                  style={verseStyle(v.n)}
                >
                  {v.en}
                </span>
                {v.n === 16 && saved && (
                  <span className="ml-1 inline-block size-1.5 -translate-y-1 rounded-full bg-primary" />
                )}
              </p>
              <p lang="am" className="scripture text-[15px] leading-[1.75]">
                <sup className="verse-number mr-1 text-muted-foreground">{v.n}</sup>
                <span
                  className={`rounded-[3px] ${v.n === 16 && selected ? "underline decoration-primary decoration-2 underline-offset-[5px]" : ""}`}
                  style={verseStyle(v.n)}
                >
                  {v.am}
                </span>
              </p>
            </div>
          ))}
        </div>
      </div>
      {rail > 0 && <NotesRail t={t} rail={rail} />}
    </div>
  );
}

function NotesRail({ t, rail }: { t: number; rail: number }) {
  const text = typed(t, T.study.typing);
  const saved = t >= T.study.save;
  const saving = t >= T.study.save - 160 && t < T.study.save;
  return (
    <div
      className="absolute top-12 right-0 bottom-0 border-l bg-sidebar px-4 pt-4"
      style={{ width: RAIL, transform: `translateX(${(1 - rail) * RAIL}px)` }}
    >
      <p className="text-[13px] font-semibold">Notes on this passage</p>
      <p className="text-[11.5px] text-muted-foreground">John 3:16</p>
      <div className="mt-3 rounded-xl border bg-card p-3 text-[12.5px] leading-relaxed">
        {saved ? (
          <>
            <p>
              Love goes first. He gave before anyone asked. See{" "}
              <span className="rounded bg-accent px-1 font-medium text-accent-foreground">1 John 4:19</span>.
            </p>
            <div className="mt-2.5 flex items-center gap-2 text-[11px]">
              <span className="rounded-full bg-muted px-2 py-0.5">John 3:16</span>
              <span className="text-primary">#love</span>
              <span className="text-primary">#gospel</span>
            </div>
          </>
        ) : (
          <>
            <p className="min-h-[88px]">
              {text ? (
                text
              ) : (
                <span className="text-muted-foreground">Write a note… Link verses with [[John 3:16]]</span>
              )}
              {t >= T.study.rail && !saved && <Caret on={caretOn(t, T.study.typing)} />}
            </p>
            <div className="mt-2 rounded-md border px-2 py-1 text-[11.5px]">
              {t >= T.study.tag ? (
                <span className="text-primary">#love, #gospel</span>
              ) : (
                <span className="text-muted-foreground">Add tags, comma separated</span>
              )}
            </div>
            <div className="mt-2.5 flex justify-end gap-2 text-[11.5px]">
              <span className="rounded-md px-2 py-1 text-muted-foreground">Cancel</span>
              <span
                className="rounded-md bg-primary px-2 py-1 font-medium text-primary-foreground"
                style={{ transform: saving ? "scale(0.95)" : undefined }}
              >
                Save note <kbd className="ml-0.5 text-[10px] opacity-80">⌘↵</kbd>
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SelectionBar({
  opacity,
  offset,
  picked,
  noteDown,
}: {
  opacity: number;
  offset: number;
  picked: boolean;
  noteDown: boolean;
}) {
  return (
    <div
      className="absolute bottom-6 flex w-max items-center gap-1 rounded-2xl whitespace-nowrap border bg-popover p-1.5 text-[12.5px] shadow-lg"
      style={{ left: offset, opacity, transform: `translate(-50%, ${(1 - opacity) * 10}px)` }}
    >
      <span className="px-2 text-[11.5px] font-semibold text-muted-foreground">John 3:16</span>
      <span className="h-5 w-px bg-border" />
      <span className="flex items-center gap-1 px-1">
        {SWATCHES.map((s, i) => (
          <span
            key={s}
            className={`size-6 rounded-full border border-foreground/15 ${SWATCH_BG[s]}`}
            style={i === 0 && picked ? { boxShadow: "0 0 0 2px var(--background), 0 0 0 4px var(--ring)" } : undefined}
          />
        ))}
        <span className="grid size-7 place-items-center text-muted-foreground">
          <Eraser className="size-4" />
        </span>
      </span>
      <span className="h-5 w-px bg-border" />
      <span className={`flex items-center gap-1.5 rounded-md px-2 py-1 font-medium ${noteDown ? "bg-muted" : ""}`}>
        <NotebookPen className="size-4" /> Add note
      </span>
      <span className="flex items-center gap-1.5 rounded-md px-2 py-1 font-medium">
        <BookmarkPlus className="size-4" /> Save to collection
      </span>
      <span className="grid size-7 place-items-center text-muted-foreground">
        <Copy className="size-4" />
      </span>
      <span className="grid size-7 place-items-center text-muted-foreground">
        <X className="size-4" />
      </span>
    </div>
  );
}

function Palette({ t, opacity, mode }: { t: number; opacity: number; mode: "jump" | "search" }) {
  const typing = mode === "jump" ? T.jump.typing : T.search.typing;
  const enter = mode === "jump" ? T.jump.enter : T.search.enter;
  const query = typed(t, typing);
  const pressed = t >= enter && t < enter + 160;

  type Row = { label: string; am?: string; icon: LucideIcon };
  const rows: Row[] = [];
  if (mode === "jump" && query.length >= 2) {
    if (query.startsWith("john 3:1")) {
      rows.push({ label: `John 3:${query.slice(7)}`, am: `ዮሐንስ 3፥${query.slice(7)}`, icon: BookOpen });
      rows.push({ label: "John 3", am: "ዮሐንስ 3", icon: BookOpen });
    } else if (query.startsWith("john")) {
      rows.push({
        label: query.length > 5 ? "John 3" : "John",
        am: query.length > 5 ? "ዮሐንስ 3" : "ዮሐንስ",
        icon: BookOpen,
      });
    } else {
      rows.push({ label: "John", am: "ዮሐንስ", icon: BookOpen });
      rows.push({ label: "Jonah", am: "ዮናስ", icon: BookOpen });
      rows.push({ label: "Job", am: "ኢዮብ", icon: BookOpen });
      rows.push({ label: "Joel", am: "ኢዩኤል", icon: BookOpen });
      rows.push({ label: "Joshua", am: "ኢያሱ", icon: BookOpen });
    }
  }
  if (query) rows.push({ label: `Search the Bible for “${query}”`, icon: Search });

  return (
    <>
      <div className="absolute inset-0 bg-background/60" style={{ opacity }} />
      <div
        className="absolute overflow-hidden rounded-2xl border bg-popover shadow-2xl"
        style={{
          left: SIDEBAR + (MAIN - 520) / 2,
          top: 92,
          width: 520,
          opacity,
          transform: `translateY(${(1 - opacity) * -8}px) scale(${0.98 + opacity * 0.02})`,
        }}
      >
        <div className="flex h-12 items-center border-b-2 border-primary px-4 text-[15px]">
          {query ? (
            <span lang={mode === "search" ? "am" : "en"}>{query}</span>
          ) : (
            <span className="text-muted-foreground">Go to a passage, e.g. John 3:16 or ዮሐ 3፥16</span>
          )}
          <Caret on={caretOn(t, typing)} />
        </div>
        {rows.length > 0 && (
          <div className="p-1.5">
            {rows.map((row, i) => {
              const active = mode === "jump" ? i === 0 : row.icon === Search;
              const Icon = row.icon;
              return (
                <div
                  key={row.label}
                  className={`flex h-9 items-center gap-3 rounded-lg px-2.5 text-[13.5px] ${active ? "bg-accent text-accent-foreground" : ""}`}
                  style={{ transform: active && pressed ? "scale(0.99)" : undefined }}
                >
                  <Icon className="size-4 opacity-70" />
                  <span className="flex-1">{row.label}</span>
                  {row.am && (
                    <span lang="am" className="text-[11.5px] text-muted-foreground">
                      {row.am}
                    </span>
                  )}
                  {active && <span className="text-[12px] text-muted-foreground">↵</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function SearchView({ t }: { t: number }) {
  return (
    <div className="h-full px-10 pt-9">
      <div className="flex items-center justify-between">
        <h3 className="text-[28px] font-semibold tracking-tight">Search the Bible</h3>
        <span className="rounded-full border px-2.5 py-1 text-[12px] font-semibold">ULB</span>
      </div>
      <div className="mt-4 flex h-11 items-center gap-2.5 rounded-xl border bg-card px-3.5 text-[15px] ring-2 ring-ring/60">
        <Search className="size-4 text-muted-foreground" />
        <span lang="am">{SEARCH_QUERY}</span>
      </div>
      <div className="mt-3 flex gap-2 text-[12px]">
        {["Whole Bible", "Old Testament", "New Testament", "One book…"].map((label, i) => (
          <span
            key={label}
            className={`rounded-full border px-3 py-1 ${i === 0 ? "border-primary bg-primary text-primary-foreground" : ""}`}
          >
            {label}
          </span>
        ))}
      </div>
      <p className="mt-4 text-[13px] font-medium">
        {SEARCH_TOTAL} verses{" "}
        <span className="font-normal text-muted-foreground">· Amharic Unlocked Literal Bible</span>
      </p>
      <div className="mt-2 flex flex-col">
        {SEARCH_RESULTS.map((r, i) => {
          const at = T.search.results + i * T.search.resultStep;
          const p = easeOut(span(t, at, at + 260));
          const heading = r.book !== SEARCH_RESULTS[i - 1]?.book ? r.book : undefined;
          return (
            <div key={r.ref} style={{ opacity: p, transform: `translateY(${(1 - p) * 6}px)` }}>
              {heading && <p className="eyebrow mt-3 text-[10.5px]">{heading}</p>}
              <p className="mt-1.5 text-[11.5px] font-semibold text-muted-foreground">{r.ref}</p>
              <p lang="am" className="scripture text-[15px] leading-[1.7]">
                <Marked text={r.text} />
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Marked({ text }: { text: string }) {
  const parts = text.split(SEARCH_QUERY);
  return (
    <>
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && (
            <mark className="rounded-[3px] bg-muted px-0.5 text-foreground ring-1 ring-border">{SEARCH_QUERY}</mark>
          )}
        </span>
      ))}
    </>
  );
}

function ThemePicker({ opacity, theme }: { opacity: number; theme: Theme }) {
  return (
    <div
      className="absolute top-14 right-4 w-[300px] rounded-2xl border bg-popover p-4 shadow-xl"
      style={{ opacity, transform: `translateY(${(1 - opacity) * -6}px)` }}
    >
      <p className="text-[13px] font-semibold">Theme</p>
      <div className="mt-3 grid grid-cols-3 gap-2.5">
        {THEMES.map((th) => (
          <div key={th} className="flex flex-col items-center gap-1.5">
            <div
              data-theme={th}
              className="h-14 w-full rounded-lg border bg-background p-2"
              style={th === theme ? { boxShadow: "0 0 0 2px var(--background), 0 0 0 4px var(--ring)" } : undefined}
            >
              <div className="h-1.5 w-3/4 rounded-full bg-foreground/60" />
              <div className="mt-1.5 h-1.5 w-full rounded-full bg-foreground/25" />
              <div className="mt-1.5 h-1.5 w-2/3 rounded-full bg-foreground/25" />
            </div>
            <span className={`text-[11.5px] ${th === theme ? "font-semibold" : "text-muted-foreground"}`}>
              {THEME_LABEL[th]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Dock({ theme }: { theme: Theme }) {
  return (
    <div className="absolute bottom-[14px] left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-[20px] border border-background/40 bg-background/25 px-3 py-2 backdrop-blur-md">
      <span className="relative size-[52px]">
        {THEMES.map((th) => (
          <img
            key={th}
            src={ICONS[th]}
            alt=""
            className="absolute inset-0 size-[52px] transition-opacity duration-700"
            style={{ opacity: th === theme ? 1 : 0 }}
          />
        ))}
      </span>
      <span className="absolute -bottom-[3px] left-1/2 size-1 -translate-x-1/2 rounded-full bg-background/80" />
    </div>
  );
}
