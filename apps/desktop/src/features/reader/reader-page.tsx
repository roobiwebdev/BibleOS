import { bookByOrd } from "@starter/bible-core/books";
import { alignParallel } from "@starter/bible-core/parallel";
import { chapterRange, formatRange, overlaps, type VerseRange } from "@starter/bible-core/range";
import { chapterOf, makeVerseId, splitVerseId, type VerseId } from "@starter/bible-core/verse-id";
import { TRANSLATIONS } from "@starter/bible-data/manifest";
import { Button } from "@starter/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@starter/ui/components/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@starter/ui/components/tooltip";
import { cn } from "@starter/ui/lib/utils";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  BookmarkPlus,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Copy,
  Eraser,
  Maximize2,
  Minimize2,
  NotebookPen,
  PanelRight,
  Plus,
  X,
} from "lucide-react";
import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent,
  type ReactNode,
} from "react";

import { BookmarkButton } from "../../components/bookmark-button";
import { HIGHLIGHT_BG } from "../../components/highlight-colors";
import { TranslationMenu } from "../../components/translation-menu";
import type { ChapterVerse } from "../../lib/bible/source";
import { useAvailableChapters } from "../../lib/bible/use-chapter";
import { hasOverlayTitleBar } from "../../lib/platform";
import { usePreferences, useT } from "../../lib/state/preferences";
import { useReadingTimer } from "../../lib/state/use-reading-timer";
import { HIGHLIGHT_COLORS, useStudy } from "../../lib/state/study-store";
import { DEFAULT_CHAPTER, readRoute } from "../../router";
import { ChapterPicker } from "./chapter-picker";
import { ChapterText, ParallelText, type VerseDecor } from "./chapter-text";
import { NotesRail } from "./notes-rail";
import { adjacentChapter, useChapterWindow, type WindowChapter } from "./use-chapter-window";

function IconToggle({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          aria-pressed={active}
          onClick={onClick}
          className={cn(active && "bg-accent text-accent-foreground")}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

const NARROW = "(max-width: 1180px)";
/** True when the window is too narrow to keep the notes rail beside the text. */
function useNarrow(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia(NARROW);
      query.addEventListener("change", notify);
      return () => query.removeEventListener("change", notify);
    },
    () => window.matchMedia(NARROW).matches,
  );
}

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/** A chapter counts as read after this long on screen, so scrolling past it does not. */
const MARK_READ_AFTER_MS = 2_000;

/**
 * SOURCE OF TRUTH KEYWORDS: ChapterSection, continuous reader chapter, chapter block, fallback notice
 * WHAT:  One chapter inside the continuous reader: book and chapter heading, the fallback
 *        notice when a translation lacks the book, and the text (single or parallel).
 * WHY:   Each mounted chapter carries its own translations and notices, so the Old Testament
 *        fallback appears exactly on the chapters it applies to.
 * WHERE: reader page.
 */
function ChapterSection({
  chapter,
  parallel,
  decor,
}: {
  chapter: WindowChapter;
  parallel: boolean;
  decor: VerseDecor;
}) {
  const t = useT();
  const { prefs } = usePreferences();
  const { ord, chapter: number } = splitVerseId(chapter.vid);
  const book = bookByOrd(ord);
  const mainMeta = TRANSLATIONS.find((x) => x.id === chapter.main.id);
  const secondMeta = TRANSLATIONS.find((x) => x.id === chapter.second?.id);
  const second = parallel ? chapter.second : undefined;
  const rows = useMemo(
    () => (second ? alignParallel([chapter.main.data.verses, second.data.verses]) : []),
    [chapter.main, second],
  );
  const notices = [chapter.main.replaced, second?.replaced].filter((x) => x !== undefined);
  const title = `${book?.[prefs.locale].short ?? ""} ${number}`;

  return (
    <article data-chapter={chapter.vid} aria-label={title} className="pb-16 pt-12">
      <div className="mb-10 text-center">
        <p className="eyebrow font-sans">{book?.[prefs.locale].name}</p>
        <p className="mt-2 font-reading text-5xl font-light tabular">{number}</p>
      </div>
      {notices.map((n) => (
        <p
          key={n.missing?.id}
          className="mx-auto mb-6 max-w-xl rounded-lg bg-muted px-3 py-2 text-center font-sans text-xs text-muted-foreground"
        >
          {t.read.fallback(n.missing?.abbreviation ?? "", n.shown?.name ?? "")}
        </p>
      ))}
      <div role="document" aria-describedby="reader-hint" aria-label={title}>
        {second ? (
          <>
            <div className="mb-6 hidden grid-cols-2 gap-x-12 border-b pb-2 font-sans text-xs font-medium text-muted-foreground @3xl:grid">
              <span lang={mainMeta?.language}>{mainMeta?.name}</span>
              <span lang={secondMeta?.language}>{secondMeta?.name}</span>
            </div>
            <ParallelText
              rows={rows}
              langs={[mainMeta?.language ?? "en", secondMeta?.language ?? "en"]}
              headings={chapter.main.data.headings}
              decor={decor}
              emptyLabel="—"
            />
          </>
        ) : (
          <ChapterText
            verses={chapter.main.data.verses}
            headings={chapter.main.data.headings}
            lang={mainMeta?.language ?? "en"}
            decor={decor}
          />
        )}
      </div>
    </article>
  );
}

export function ReaderPage() {
  const t = useT();
  const { prefs, update } = usePreferences();
  const study = useStudy();
  const navigate = useNavigate();
  const search = readRoute.useSearch();
  const scrollRef = useRef<HTMLDivElement>(null);
  const win = useChapterWindow(scrollRef, {
    main: prefs.mainTranslation,
    second: prefs.parallelTranslation,
    parallel: prefs.parallel,
  });

  // The chapter the URL asks for; the chapter on screen (`current`) follows scrolling.
  const urlChapter = chapterOf(search.c ?? study.lastRead ?? DEFAULT_CHAPTER);
  const current = win.inView ?? urlChapter;
  const { ord, chapter } = splitVerseId(current);
  const book = bookByOrd(ord);
  const currentChapter = win.chapters.find((c) => c.vid === current);
  const available = useAvailableChapters();
  const [pickerOpen, setPickerOpen] = useState(false);
  const narrow = useNarrow();
  // On narrow windows the rail floats over the text, so it opens only when asked for.
  const [overlayRail, setOverlayRail] = useState(false);
  const mainMeta = TRANSLATIONS.find((x) => x.id === (currentChapter?.main.id ?? prefs.mainTranslation));
  const inPreview = available === undefined || available.includes(urlChapter);

  // Every mounted verse in reading order, so the keyboard cursor flows across chapters.
  const verses: ChapterVerse[] = useMemo(() => win.chapters.flatMap((c) => c.main.data.verses), [win.chapters]);

  // Picks, the keyboard cursor and a draft belong to the navigation they were made in: scrolling
  // keeps them, opening another chapter or link starts a new navigation and clears them.
  // The reader's own URL updates (the chapter in view) are not navigations.
  const waitForLastRead = search.c === undefined && !study.ready;
  const urlParts = splitVerseId(urlChapter);
  const linkedVid = search.v ? makeVerseId(urlParts.ord, urlParts.chapter, search.v) : undefined;
  const urlKey = `${urlChapter}:${search.v ?? ""}`;
  const [nav, setNav] = useState<{ url: string; n: number; chapter: VerseId; linked?: VerseId }>({
    url: "",
    n: 0,
    chapter: urlChapter,
  });
  if (!waitForLastRead && inPreview && nav.url !== urlKey) {
    const own = urlChapter === win.inView && linkedVid === undefined;
    setNav(own ? { ...nav, url: urlKey } : { url: urlKey, n: nav.n + 1, chapter: urlChapter, linked: linkedVid });
  }
  const [picked, setPicked] = useState<{ key: number; range: VerseRange | null } | null>(null);
  // Without a pick, the verse in the link (?v=) that opened this navigation is selected.
  const selection: VerseRange | null =
    picked?.key === nav.n ? picked.range : nav.linked ? { start: nav.linked, end: nav.linked } : null;
  const [cursorState, setCursorState] = useState<{ key: number; vid: VerseId } | null>(null);
  const cursor = cursorState?.key === nav.n ? cursorState.vid : null;
  const [draftState, setDraftState] = useState<{ key: number; anchors: VerseRange[] } | null>(null);
  const draft = draftState?.key === nav.n ? draftState.anchors : null;
  const setDraft = (anchors: VerseRange[] | null) => setDraftState(anchors ? { key: nav.n, anchors } : null);

  const showRail = !prefs.focusMode && (narrow ? overlayRail : prefs.notesRail);
  const openRail = () => (narrow ? setOverlayRail(true) : update({ notesRail: true, focusMode: false }));
  const toggleRail = () => (narrow ? setOverlayRail(!overlayRail) : update({ notesRail: !prefs.notesRail }));
  const [copied, setCopied] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  // Each navigation scrolls to its chapter (and verse), or opens a new window of chapters there.
  const { jumpTo, inView } = win;
  const jumped = useRef(0);
  useEffect(() => {
    if (nav.n === 0 || jumped.current === nav.n) return;
    jumped.current = nav.n;
    void jumpTo(nav.chapter, nav.linked);
  }, [nav, jumpTo]);

  // Reader → URL: the chapter in view becomes the chapter in the link, without a history entry.
  const reportedInView = useRef<VerseId | undefined>(undefined);
  useEffect(() => {
    if (inView === undefined || reportedInView.current === inView) return;
    reportedInView.current = inView;
    if (inView !== urlChapter) void navigate({ to: "/read", search: { c: inView }, replace: true });
  }, [inView, urlChapter, navigate]);

  // Time counts against the chapter on screen; it is marked read after a short stay, not a fly-by.
  const loaded = (currentChapter?.main.data.verses.length ?? 0) > 0;
  useReadingTimer(current, currentChapter?.main.id ?? prefs.mainTranslation, loaded);
  const { markRead } = study;
  useEffect(() => {
    if (!loaded) return;
    const timer = setTimeout(() => markRead(current), MARK_READ_AFTER_MS);
    return () => clearTimeout(timer);
  }, [loaded, current, markRead]);

  const go = (delta: 1 | -1) => {
    const next = adjacentChapter(current, delta);
    if (next !== undefined) void navigate({ to: "/read", search: { c: next } });
  };

  const select = (range: VerseRange | null) => {
    setPicked({ key: nav.n, range });
    setAnnouncement(range ? t.read.selected(formatRange(range, prefs.locale)) : "");
  };

  // Keyboard reading: move a cursor between verses, select and extend, change chapter.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey || document.querySelector("[role=dialog]")) return;
      const index = cursor === null ? -1 : verses.findIndex((v) => v.vid <= cursor && cursor <= v.spanEnd);
      // Without a cursor, start from the chapter on screen rather than the top of the window.
      const first = Math.max(
        0,
        verses.findIndex((v) => chapterOf(v.vid) === current),
      );
      const moveTo = (i: number) => {
        const verse = verses[Math.max(0, Math.min(verses.length - 1, i))];
        if (!verse) return;
        setCursorState({ key: nav.n, vid: verse.vid });
        document.querySelector(`[data-vid="${verse.vid}"]`)?.scrollIntoView({ block: "nearest" });
        if (e.shiftKey) {
          // Extend from the current selection, or from the verse the cursor was on.
          const here = verses[Math.max(index, 0)] ?? verse;
          const anchor = selection ?? { start: here.vid, end: here.spanEnd };
          select({ start: Math.min(anchor.start, verse.vid), end: Math.max(anchor.end, verse.spanEnd) });
        }
      };
      switch (e.key) {
        case "ArrowDown":
        case "j":
          e.preventDefault();
          moveTo(index < 0 ? first : index + 1);
          break;
        case "ArrowUp":
        case "k":
          e.preventDefault();
          moveTo(index < 0 ? first : index - 1);
          break;
        case " ":
        case "Enter": {
          const verse = verses[index];
          if (!verse) return;
          e.preventDefault();
          select({ start: verse.vid, end: verse.spanEnd });
          break;
        }
        case "Escape":
          if (selection || cursor !== null) {
            select(null);
            setCursorState(null);
          } else if (prefs.focusMode) update({ focusMode: false });
          break;
        case "[":
          go(-1);
          break;
        case "]":
          go(1);
          break;
        case "n":
          e.preventDefault();
          openRail();
          setDraft([selection ?? chapterRange(current)]);
          break;
        default:
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const decor: VerseDecor = {
    selection,
    cursor,
    highlightOf: (verse) => study.highlights.find((h) => overlaps(h, { start: verse.vid, end: verse.spanEnd }))?.color,
    hasNote: (verse) =>
      study.notes.some((n) => n.anchors.some((a) => a.start >= verse.vid && a.start <= verse.spanEnd)),
    onVerseClick: (verse: ChapterVerse, event: MouseEvent) => {
      const clicked = { start: verse.vid, end: verse.spanEnd };
      setCursorState({ key: nav.n, vid: verse.vid });
      if (event.shiftKey && selection) {
        select({ start: Math.min(selection.start, clicked.start), end: Math.max(selection.end, clicked.end) });
      } else if (selection && selection.start === clicked.start && selection.end === clicked.end) {
        select(null);
      } else {
        select(clicked);
      }
    },
  };

  const selectionLabel = selection ? formatRange(selection, prefs.locale) : "";
  const selectedText = () =>
    selection
      ? verses
          .filter((x) => x.vid <= selection.end && selection.start <= x.spanEnd)
          .map((x) => x.text.replace(/\n/g, " "))
          .join(" ")
      : "";

  const otherLocale = prefs.locale === "am" ? "en" : "am";

  return (
    <div className="relative flex h-full">
      <section className="@container relative flex min-w-0 flex-1 flex-col">
        <header
          data-tauri-drag-region
          className={cn(
            "flex h-12 shrink-0 items-center gap-1 border-b px-3 transition-opacity",
            prefs.focusMode && "opacity-0 focus-within:opacity-100 hover:opacity-100",
            // With the sidebar hidden, the Mac window buttons sit over the header's left edge.
            prefs.focusMode && hasOverlayTitleBar && "pl-20",
          )}
        >
          <IconToggle label={t.read.previous} onClick={() => go(-1)}>
            <ChevronLeft />
          </IconToggle>
          <IconToggle label={t.read.next} onClick={() => go(1)}>
            <ChevronRight />
          </IconToggle>
          <h1 className="min-w-0">
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              aria-label={t.read.pickChapter}
              className="flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 hover:bg-muted"
            >
              <span className="truncate text-[15px] font-semibold">
                {book?.[prefs.locale].short} {chapter}
              </span>
              <span lang={otherLocale} className="hidden truncate text-sm text-muted-foreground @2xl:inline">
                {book?.[otherLocale].short} {chapter}
              </span>
              <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
            </button>
          </h1>
          <div className="ml-auto flex shrink-0 items-center gap-0.5">
            <BookmarkButton range={selection ?? chapterRange(current)} />
            <TranslationMenu value={prefs.mainTranslation} onChange={(id) => update({ mainTranslation: id })} />
            {prefs.parallel && (
              <>
                <span aria-hidden className="text-muted-foreground">
                  ·
                </span>
                <TranslationMenu
                  value={prefs.parallelTranslation}
                  onChange={(id) => update({ parallelTranslation: id })}
                />
              </>
            )}
            <span aria-hidden className="mx-1.5 h-5 w-px bg-border" />
            <IconToggle
              label={t.read.parallel}
              active={prefs.parallel}
              onClick={() => update({ parallel: !prefs.parallel })}
            >
              <Columns2 />
            </IconToggle>
            <IconToggle label={t.notes.onThisVerse} active={showRail} onClick={toggleRail}>
              <PanelRight />
            </IconToggle>
            <IconToggle
              label={t.read.focus}
              active={prefs.focusMode}
              onClick={() => update({ focusMode: !prefs.focusMode })}
            >
              {prefs.focusMode ? <Minimize2 /> : <Maximize2 />}
            </IconToggle>
          </div>
        </header>

        <div
          ref={scrollRef}
          data-reader-scroll
          onScroll={win.onScroll}
          className="flex-1 overflow-y-auto"
          onClick={(e) => e.target === e.currentTarget && select(null)}
        >
          <div className={cn("mx-auto px-6 pb-40 @2xl:px-10", prefs.parallel ? "max-w-6xl" : "reading-column")}>
            {!inPreview ? (
              <div className="mx-auto max-w-md pt-28 text-center font-sans text-base">
                <p className="text-muted-foreground">{t.read.notInPreview}</p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {available?.map((c) => {
                    const p = splitVerseId(c);
                    return (
                      <Link
                        key={c}
                        to="/read"
                        search={{ c }}
                        className="rounded-full border bg-card px-3 py-1 text-sm hover:border-primary/40"
                      >
                        {bookByOrd(p.ord)?.[prefs.locale].short} {p.chapter}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : (
              <>
                {win.chapters.map((c, i) => (
                  <Fragment key={c.vid}>
                    {i > 0 && <hr aria-hidden className="mx-auto w-24 border-border" />}
                    <ChapterSection chapter={c} parallel={prefs.parallel} decor={decor} />
                  </Fragment>
                ))}
                {win.chapters.length > 0 && (
                  <p id="reader-hint" className="mt-4 text-center font-sans text-[11px] text-muted-foreground">
                    {t.read.keyboardHint}
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        <p aria-live="polite" className="sr-only">
          {announcement}
        </p>

        {selection && (
          <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center px-4">
            <div
              role="toolbar"
              aria-label={selectionLabel}
              onKeyDown={(e) => e.key === "Escape" && select(null)}
              className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-1 rounded-2xl border bg-popover p-1.5 shadow-lg motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
            >
              <span className="px-2 text-xs font-semibold text-muted-foreground">{selectionLabel}</span>
              <span aria-hidden className="h-5 w-px bg-border" />
              <div className="flex items-center gap-1 px-1">
                {HIGHLIGHT_COLORS.map((color) => (
                  <Tooltip key={color}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label={`${t.verse.highlight}: ${t.colors[color]}`}
                        onClick={() => study.setHighlight(selection, color)}
                        className={cn(
                          "size-6 rounded-full border border-foreground/15 transition-transform hover:scale-110",
                          HIGHLIGHT_BG[color],
                        )}
                      />
                    </TooltipTrigger>
                    <TooltipContent>{t.colors[color]}</TooltipContent>
                  </Tooltip>
                ))}
                <IconToggle label={t.verse.removeHighlight} onClick={() => study.removeHighlight(selection)}>
                  <Eraser />
                </IconToggle>
              </div>
              <span aria-hidden className="h-5 w-px bg-border" />
              <Button
                variant="ghost"
                size="sm"
                aria-label={t.verse.addNote}
                onClick={() => {
                  openRail();
                  setDraft([selection]);
                }}
              >
                <NotebookPen /> <span className="hidden @xl:inline">{t.verse.addNote}</span>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild nativeButton>
                  <Button variant="ghost" size="sm" aria-label={t.verse.collect}>
                    <BookmarkPlus /> <span className="hidden @xl:inline">{t.verse.collect}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center">
                  {study.collections.map((c) => {
                    const saved = c.items.some((i) => i.start === selection.start && i.end === selection.end);
                    return (
                      <DropdownMenuItem
                        key={c.id}
                        onClick={() => study.addToCollection(c.id, selection)}
                        className="gap-2"
                      >
                        <span className="flex-1">{c.name}</span>
                        {saved && <Check className="size-3.5" aria-label={t.verse.inCollection} />}
                      </DropdownMenuItem>
                    );
                  })}
                  {study.collections.length > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuItem
                    className="gap-2"
                    onClick={() =>
                      study.createCollection(`${t.verse.newCollection} ${study.collections.length + 1}`, selection)
                    }
                  >
                    <Plus className="size-3.5" /> {t.verse.newCollection}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <IconToggle
                label={copied ? t.verse.copied : t.verse.copy}
                onClick={() => {
                  void navigator.clipboard.writeText(
                    `${selectedText()} (${selectionLabel}, ${mainMeta?.abbreviation ?? ""})`,
                  );
                  setCopied(true);
                  setAnnouncement(t.verse.copied);
                  setTimeout(() => setCopied(false), 1200);
                }}
              >
                {copied ? <Check /> : <Copy />}
              </IconToggle>
              <IconToggle label={t.verse.close} onClick={() => select(null)}>
                <X />
              </IconToggle>
            </div>
          </div>
        )}
      </section>

      {showRail && <NotesRail scope={selection ?? chapterRange(current)} draft={draft} onDraftChange={setDraft} />}

      <ChapterPicker open={pickerOpen} onOpenChange={setPickerOpen} current={{ ord, chapter }} available={available} />
    </div>
  );
}
