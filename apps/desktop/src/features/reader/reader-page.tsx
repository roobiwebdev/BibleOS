import { bookByOrd } from "@starter/bible-core/books";
import { alignParallel } from "@starter/bible-core/parallel";
import { chapterRange, formatRange, overlaps, type VerseRange } from "@starter/bible-core/range";
import { chapterOf, makeVerseId, splitVerseId, type VerseId } from "@starter/bible-core/verse-id";
import { TRANSLATIONS } from "@starter/bible-data/manifest";
import { Button } from "@starter/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
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
import { useEffect, useMemo, useState, useSyncExternalStore, type MouseEvent, type ReactNode } from "react";

import { HIGHLIGHT_BG } from "../../components/highlight-colors";
import type { ChapterData, ChapterVerse } from "../../lib/bible/source";
import { useAvailableChapters, useChapter } from "../../lib/bible/use-chapter";
import { usePreferences, useT } from "../../lib/state/preferences";
import { HIGHLIGHT_COLORS, useStudy } from "../../lib/state/study-store";
import { DEFAULT_CHAPTER, readRoute } from "../../router";
import { ChapterPicker } from "./chapter-picker";
import { ChapterText, ParallelText, type VerseDecor } from "./chapter-text";
import { NotesRail } from "./notes-rail";

function TranslationPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const current = TRANSLATIONS.find((t) => t.id === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild nativeButton>
        <Button variant="ghost" size="sm" className="gap-1 font-semibold">
          {current?.abbreviation ?? value}
          <ChevronDown className="size-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {(["am", "en"] as const).map((lang, i) => (
          // Base UI requires a group label to sit inside a menu group.
          <DropdownMenuGroup key={lang}>
            {i > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel>{lang === "am" ? "አማርኛ · Amharic" : "English"}</DropdownMenuLabel>
            {TRANSLATIONS.filter((t) => t.language === lang).map((t) => (
              <DropdownMenuItem key={t.id} onClick={() => onChange(t.id)} className="gap-2">
                <span className="w-9 text-xs font-semibold text-muted-foreground">{t.abbreviation}</span>
                <span lang={t.language} className="flex-1 truncate">
                  {t.name}
                </span>
                {t.id === value && <Check className="size-3.5" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

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

/**
 * When a translation lacks this book (the 1962 Amharic text is New Testament only), show a
 * full translation in the same language instead, and say so.
 */
function useWithFallback(id: string, chapterId: VerseId) {
  const meta = TRANSLATIONS.find((x) => x.id === id);
  const fallbackId =
    TRANSLATIONS.find((x) => x.language === meta?.language && x.scope === "bible" && x.id !== id)?.id ?? id;
  const own = useChapter(id, chapterId);
  const fallback = useChapter(fallbackId, chapterId);
  const missing = own !== undefined && own.verses.length === 0 && fallbackId !== id;
  return {
    data: missing ? fallback : own,
    id: missing ? fallbackId : id,
    replaced: missing ? { missing: meta, shown: TRANSLATIONS.find((x) => x.id === fallbackId) } : undefined,
  };
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

export function ReaderPage() {
  const t = useT();
  const { prefs, update } = usePreferences();
  const study = useStudy();
  const navigate = useNavigate();
  const search = readRoute.useSearch();
  const chapterId = chapterOf(search.c ?? study.lastRead ?? DEFAULT_CHAPTER);
  const { ord, chapter } = splitVerseId(chapterId);
  const book = bookByOrd(ord);
  const available = useAvailableChapters();
  const [pickerOpen, setPickerOpen] = useState(false);
  const narrow = useNarrow();
  // On narrow windows the rail floats over the text, so it opens only when asked for.
  const [overlayRail, setOverlayRail] = useState(false);

  const main = useWithFallback(prefs.mainTranslation, chapterId);
  const second = useWithFallback(prefs.parallelTranslation, chapterId);
  const mainMeta = TRANSLATIONS.find((x) => x.id === main.id);
  const secondMeta = TRANSLATIONS.find((x) => x.id === second.id);
  const mainData: ChapterData | undefined = main.data;
  const secondData: ChapterData | undefined = second.data;
  const verses: ChapterVerse[] = useMemo(() => mainData?.verses ?? [], [mainData]);
  const inPreview = available === undefined || available.includes(chapterId);

  // A pick belongs to the chapter and link it was made on; moving elsewhere clears it.
  // Without a pick, a verse in the link (?v=) is selected.
  const pickKey = `${chapterId}:${search.v ?? ""}`;
  const [picked, setPicked] = useState<{ key: string; range: VerseRange | null } | null>(null);
  const linkedVid = search.v ? makeVerseId(ord, chapter, search.v) : undefined;
  const selection: VerseRange | null =
    picked?.key === pickKey ? picked.range : linkedVid ? { start: linkedVid, end: linkedVid } : null;

  const [cursorState, setCursorState] = useState<{ key: string; vid: VerseId } | null>(null);
  const cursor = cursorState?.key === pickKey ? cursorState.vid : null;

  // The note being written keeps the passage it was started on, and closes on another chapter.
  const [draftState, setDraftState] = useState<{ chapterId: VerseId; anchors: VerseRange[] } | null>(null);
  const draft = draftState?.chapterId === chapterId ? draftState.anchors : null;
  const setDraft = (anchors: VerseRange[] | null) => setDraftState(anchors ? { chapterId, anchors } : null);

  const showRail = !prefs.focusMode && (narrow ? overlayRail : prefs.notesRail);
  const openRail = () => (narrow ? setOverlayRail(true) : update({ notesRail: true, focusMode: false }));
  const toggleRail = () => (narrow ? setOverlayRail(!overlayRail) : update({ notesRail: !prefs.notesRail }));
  const [copied, setCopied] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const { markRead } = study;
  useEffect(() => {
    if (verses.length > 0) markRead(chapterId);
  }, [verses.length, chapterId, markRead]);

  // Scroll a linked verse (from the palette or a note) into view once its chapter is on screen.
  useEffect(() => {
    if (!linkedVid || verses.length === 0) return;
    const target = verses.find((x) => x.vid <= linkedVid && x.spanEnd >= linkedVid)?.vid ?? linkedVid;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() =>
      document
        .querySelector(`[data-vid="${target}"]`)
        ?.scrollIntoView({ block: "center", behavior: smooth ? "smooth" : "auto" }),
    );
  }, [linkedVid, verses]);

  const go = (delta: number) => {
    if (!book) return;
    let nextOrd = ord;
    let nextChapter = chapter + delta;
    if (nextChapter < 1) {
      const prevBook = bookByOrd(ord - 1);
      if (!prevBook) return;
      nextOrd = prevBook.ord;
      nextChapter = prevBook.chapters;
    } else if (nextChapter > book.chapters) {
      if (!bookByOrd(ord + 1)) return;
      nextOrd = ord + 1;
      nextChapter = 1;
    }
    void navigate({ to: "/read", search: { c: makeVerseId(nextOrd, nextChapter) } });
  };

  const select = (range: VerseRange | null) => {
    setPicked({ key: pickKey, range });
    setAnnouncement(range ? t.read.selected(formatRange(range, prefs.locale)) : "");
  };

  // Keyboard reading: move a cursor between verses, select and extend, change chapter.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey || document.querySelector("[role=dialog]")) return;
      const index = cursor === null ? -1 : verses.findIndex((v) => v.vid <= cursor && cursor <= v.spanEnd);
      const moveTo = (i: number) => {
        const verse = verses[Math.max(0, Math.min(verses.length - 1, i))];
        if (!verse) return;
        setCursorState({ key: pickKey, vid: verse.vid });
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
          moveTo(index + 1);
          break;
        case "ArrowUp":
        case "k":
          e.preventDefault();
          moveTo(index < 0 ? 0 : index - 1);
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
          setDraft([selection ?? chapterRange(chapterId)]);
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
      setCursorState({ key: pickKey, vid: verse.vid });
      if (event.shiftKey && selection) {
        select({ start: Math.min(selection.start, clicked.start), end: Math.max(selection.end, clicked.end) });
      } else if (selection && selection.start === clicked.start && selection.end === clicked.end) {
        select(null);
      } else {
        select(clicked);
      }
    },
  };

  const rows = useMemo(
    () => (mainData && secondData ? alignParallel([mainData.verses, secondData.verses]) : []),
    [mainData, secondData],
  );

  const selectionLabel = selection ? formatRange(selection, prefs.locale) : "";
  const selectedText = () =>
    selection
      ? verses
          .filter((x) => x.vid <= selection.end && selection.start <= x.spanEnd)
          .map((x) => x.text.replace(/\n/g, " "))
          .join(" ")
      : "";

  const otherLocale = prefs.locale === "am" ? "en" : "am";
  const notices = [main.replaced, prefs.parallel ? second.replaced : undefined].filter((x) => x !== undefined);

  return (
    <div className="relative flex h-full">
      <section className="@container relative flex min-w-0 flex-1 flex-col">
        <header
          data-tauri-drag-region
          className={cn(
            "flex h-12 shrink-0 items-center gap-1 border-b px-3 transition-opacity",
            prefs.focusMode && "opacity-0 focus-within:opacity-100 hover:opacity-100",
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
            <TranslationPicker value={prefs.mainTranslation} onChange={(id) => update({ mainTranslation: id })} />
            {prefs.parallel && (
              <>
                <span aria-hidden className="text-muted-foreground">
                  ·
                </span>
                <TranslationPicker
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

        <div className="flex-1 overflow-y-auto" onClick={(e) => e.target === e.currentTarget && select(null)}>
          <div className={cn("mx-auto px-6 pb-40 pt-12 @2xl:px-10", prefs.parallel ? "max-w-6xl" : "reading-column")}>
            {!inPreview ? (
              <div className="mx-auto max-w-md pt-16 text-center font-sans text-base">
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
                <div className="mb-10 text-center">
                  <p className="eyebrow font-sans">{book?.[prefs.locale].name}</p>
                  <p className="mt-2 font-reading text-5xl font-light tabular">{chapter}</p>
                </div>
                {notices.map((n) => (
                  <p
                    key={n.missing?.id}
                    className="mx-auto mb-6 max-w-xl rounded-lg bg-muted px-3 py-2 text-center font-sans text-xs text-muted-foreground"
                  >
                    {t.read.fallback(n.missing?.abbreviation ?? "", n.shown?.name ?? "")}
                  </p>
                ))}
                <div
                  role="document"
                  aria-describedby="reader-hint"
                  aria-label={`${book?.[prefs.locale].short ?? ""} ${chapter}`}
                >
                  {prefs.parallel ? (
                    <>
                      <div className="mb-6 hidden grid-cols-2 gap-x-12 border-b pb-2 font-sans text-xs font-medium text-muted-foreground @3xl:grid">
                        <span lang={mainMeta?.language}>{mainMeta?.name}</span>
                        <span lang={secondMeta?.language}>{secondMeta?.name}</span>
                      </div>
                      <ParallelText
                        rows={rows}
                        langs={[mainMeta?.language ?? "en", secondMeta?.language ?? "en"]}
                        headings={mainData?.headings ?? []}
                        decor={decor}
                        emptyLabel="—"
                      />
                    </>
                  ) : (
                    <ChapterText
                      verses={verses}
                      headings={mainData?.headings ?? []}
                      lang={mainMeta?.language ?? "en"}
                      decor={decor}
                    />
                  )}
                </div>
                <p id="reader-hint" className="mt-10 text-center font-sans text-[11px] text-muted-foreground">
                  {t.read.keyboardHint}
                </p>
                <div className="mt-8 flex justify-between border-t pt-6 font-sans text-sm">
                  <Button variant="ghost" onClick={() => go(-1)}>
                    <ChevronLeft /> {t.read.previous}
                  </Button>
                  <Button variant="ghost" onClick={() => go(1)}>
                    {t.read.next} <ChevronRight />
                  </Button>
                </div>
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

      {showRail && <NotesRail scope={selection ?? chapterRange(chapterId)} draft={draft} onDraftChange={setDraft} />}

      <ChapterPicker open={pickerOpen} onOpenChange={setPickerOpen} current={{ ord, chapter }} available={available} />
    </div>
  );
}
