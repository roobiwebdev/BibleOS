import { bookByOrd } from "@starter/bible-core/books";
import { alignParallel } from "@starter/bible-core/parallel";
import { formatReference } from "@starter/bible-core/reference";
import { chapterOf, makeVerseId, splitVerseId } from "@starter/bible-core/verse-id";
import { TRANSLATIONS } from "@starter/bible-data/manifest";
import { Button } from "@starter/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
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
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type MouseEvent } from "react";

import type { ChapterVerse } from "../../lib/bible/source";
import { useAvailableChapters, useChapter } from "../../lib/bible/use-chapter";
import { usePreferences, useT } from "../../lib/state/preferences";
import { HIGHLIGHT_COLORS, overlaps, useStudy, type VerseRange } from "../../lib/state/study-store";
import { DEFAULT_CHAPTER, readRoute } from "../../router";
import { ChapterText, ParallelText, type VerseDecor } from "./chapter-text";
import { NotesRail } from "./notes-rail";

const HIGHLIGHT_SWATCH = {
  promise: "bg-hl-promise",
  command: "bg-hl-command",
  prayer: "bg-hl-prayer",
  insight: "bg-hl-insight",
  question: "bg-hl-question",
} as const;

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
          <div key={lang}>
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
          </div>
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
  children: React.ReactNode;
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

  const main = useChapter(prefs.mainTranslation, chapterId);
  const second = useChapter(prefs.parallelTranslation, chapterId);
  // A pick belongs to the chapter and link it was made on; moving elsewhere clears it.
  // Without a pick, a verse in the link (?v=) is selected.
  const [picked, setPicked] = useState<{ key: string; range: VerseRange | null } | null>(null);
  const pickKey = `${chapterId}:${search.v ?? ""}`;
  const linkedVid = search.v ? makeVerseId(ord, chapter, search.v) : undefined;
  const selection: VerseRange | null =
    picked?.key === pickKey ? picked.range : linkedVid ? { start: linkedVid, end: linkedVid } : null;
  const setSelection = (range: VerseRange | null) => setPicked({ key: pickKey, range });
  const [writing, setWriting] = useState(false);
  const [copied, setCopied] = useState(false);

  const mainMeta = TRANSLATIONS.find((x) => x.id === prefs.mainTranslation);
  const secondMeta = TRANSLATIONS.find((x) => x.id === prefs.parallelTranslation);
  const inPreview = available === undefined || available.includes(chapterId);

  const { markRead } = study;
  useEffect(() => {
    if (main && main.verses.length > 0) markRead(chapterId);
  }, [main, chapterId, markRead]);

  // Scroll a linked verse (from the palette or a note) into view once its chapter is on screen.
  useEffect(() => {
    if (!linkedVid || !main) return;
    const target = main.verses.find((x) => x.vid <= linkedVid && x.spanEnd >= linkedVid)?.vid ?? linkedVid;
    requestAnimationFrame(() =>
      document.querySelector(`[data-vid="${target}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }),
    );
  }, [linkedVid, main]);

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

  const decor: VerseDecor = {
    selection,
    highlightOf: (verse) => study.highlights.find((h) => overlaps(h, { start: verse.vid, end: verse.spanEnd }))?.color,
    hasNote: (verse) =>
      study.notes.some((n) =>
        n.anchors.some((a) => a.start <= verse.spanEnd && verse.vid <= a.end && a.start >= verse.vid),
      ),
    onVerseClick: (verse: ChapterVerse, event: MouseEvent) => {
      const clicked = { start: verse.vid, end: verse.spanEnd };
      if (event.shiftKey && selection) {
        setSelection({ start: Math.min(selection.start, clicked.start), end: Math.max(selection.end, clicked.end) });
      } else if (selection && selection.start === clicked.start && selection.end === clicked.end) {
        setSelection(null);
      } else {
        setSelection(clicked);
      }
    },
  };

  const rows = useMemo(() => (main && second ? alignParallel([main.verses, second.verses]) : []), [main, second]);

  const selectedText = () => {
    if (!selection || !main) return "";
    return main.verses
      .filter((x) => x.vid <= selection.end && selection.start <= x.spanEnd)
      .map((x) => x.text.replace(/\n/g, " "))
      .join(" ");
  };
  const selectionLabel = (() => {
    if (!selection || !book) return "";
    const a = splitVerseId(selection.start);
    const b = splitVerseId(selection.end);
    return formatReference(
      { book, chapter: a.chapter, verse: a.verse, endVerse: b.verse !== a.verse ? b.verse : undefined },
      prefs.locale,
    );
  })();

  const title = book ? `${book[prefs.locale].short} ${chapter}` : "";
  const otherTitle = book ? `${book[prefs.locale === "am" ? "en" : "am"].short} ${chapter}` : "";
  const showRail = prefs.notesRail && !prefs.focusMode;

  return (
    <div className="flex h-full">
      <section className="relative flex min-w-0 flex-1 flex-col">
        <header
          data-tauri-drag-region
          className={cn(
            "flex h-12 shrink-0 items-center gap-1 border-b px-3 transition-opacity",
            prefs.focusMode && "opacity-0 hover:opacity-100",
          )}
        >
          <IconToggle label={t.read.previous} onClick={() => go(-1)}>
            <ChevronLeft />
          </IconToggle>
          <IconToggle label={t.read.next} onClick={() => go(1)}>
            <ChevronRight />
          </IconToggle>
          <h1 className="ml-1 truncate text-[15px] font-semibold">
            {title}
            <span lang={prefs.locale === "am" ? "en" : "am"} className="ml-2 text-sm font-normal text-muted-foreground">
              {otherTitle}
            </span>
          </h1>
          <div className="ml-auto flex items-center gap-0.5">
            <TranslationPicker value={prefs.mainTranslation} onChange={(id) => update({ mainTranslation: id })} />
            {prefs.parallel && (
              <>
                <span className="text-muted-foreground">·</span>
                <TranslationPicker
                  value={prefs.parallelTranslation}
                  onChange={(id) => update({ parallelTranslation: id })}
                />
              </>
            )}
            <span className="mx-1.5 h-5 w-px bg-border" />
            <IconToggle
              label={t.read.parallel}
              active={prefs.parallel}
              onClick={() => update({ parallel: !prefs.parallel })}
            >
              <Columns2 />
            </IconToggle>
            <IconToggle
              label={t.notes.onThisVerse}
              active={showRail}
              onClick={() => update({ notesRail: !prefs.notesRail })}
            >
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

        <div className="flex-1 overflow-y-auto" onClick={(e) => e.target === e.currentTarget && setSelection(null)}>
          <div className={cn("mx-auto px-10 pb-40 pt-12", prefs.parallel ? "max-w-6xl" : "max-w-[70ch]")}>
            {!inPreview ? (
              <div className="mx-auto max-w-md pt-16 text-center">
                <p className="text-muted-foreground">{t.read.notInPreview}</p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {available?.map((c) => {
                    const p = splitVerseId(c);
                    const b = bookByOrd(p.ord);
                    return (
                      <Link
                        key={c}
                        to="/read"
                        search={{ c }}
                        className="rounded-full border bg-card px-3 py-1 text-sm hover:border-primary/40"
                      >
                        {b?.[prefs.locale].short} {p.chapter}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : (
              <>
                <div className="mb-10 text-center">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {book?.[prefs.locale].name}
                  </p>
                  <p className="mt-2 font-reading text-5xl font-light tabular">{chapter}</p>
                </div>
                {prefs.parallel ? (
                  <>
                    <div className="mb-6 grid grid-cols-2 gap-x-12 border-b pb-2 text-xs font-medium text-muted-foreground">
                      <span lang={mainMeta?.language}>{mainMeta?.name}</span>
                      <span lang={secondMeta?.language}>{secondMeta?.name}</span>
                    </div>
                    <ParallelText
                      rows={rows}
                      langs={[mainMeta?.language ?? "en", secondMeta?.language ?? "en"]}
                      headings={main?.headings ?? []}
                      decor={decor}
                      emptyLabel={second && second.verses.length === 0 ? t.read.noText : "—"}
                    />
                  </>
                ) : main && main.verses.length === 0 ? (
                  <p className="text-center text-muted-foreground">{t.read.noText}</p>
                ) : (
                  <ChapterText
                    verses={main?.verses ?? []}
                    headings={main?.headings ?? []}
                    lang={mainMeta?.language ?? "en"}
                    decor={decor}
                  />
                )}
                <div className="mt-16 flex justify-between border-t pt-6 text-sm">
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

        {selection && (
          <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
            <div className="pointer-events-auto flex items-center gap-1 rounded-2xl border bg-popover p-1.5 shadow-lg animate-in fade-in slide-in-from-bottom-2">
              <span className="px-2 text-xs font-semibold text-muted-foreground">{selectionLabel}</span>
              <span className="h-5 w-px bg-border" />
              <div className="flex items-center gap-1 px-1.5">
                {HIGHLIGHT_COLORS.map((color) => (
                  <Tooltip key={color}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label={t.colors[color]}
                        onClick={() => study.setHighlight(selection, color)}
                        className={cn(
                          "size-5 rounded-full border border-foreground/10 transition-transform hover:scale-110",
                          HIGHLIGHT_SWATCH[color],
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
              <span className="h-5 w-px bg-border" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  update({ notesRail: true, focusMode: false });
                  setWriting(true);
                }}
              >
                <NotebookPen /> {t.verse.addNote}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild nativeButton>
                  <Button variant="ghost" size="sm">
                    <BookmarkPlus /> {t.verse.collect}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center">
                  {study.collections.map((c) => (
                    <DropdownMenuItem key={c.id} onClick={() => study.addToCollection(c.id, selection)}>
                      {c.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <IconToggle
                label={copied ? t.verse.copied : t.verse.copy}
                onClick={() => {
                  void navigator.clipboard.writeText(
                    `${selectedText()} (${selectionLabel}, ${mainMeta?.abbreviation ?? ""})`,
                  );
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1200);
                }}
              >
                {copied ? <Check /> : <Copy />}
              </IconToggle>
              <IconToggle label={t.verse.close} onClick={() => setSelection(null)}>
                <X />
              </IconToggle>
            </div>
          </div>
        )}
      </section>

      {showRail && (
        <NotesRail
          chapterId={chapterId}
          selection={selection}
          selectionLabel={selectionLabel}
          writing={writing}
          onWritingChange={setWriting}
        />
      )}
    </div>
  );
}
