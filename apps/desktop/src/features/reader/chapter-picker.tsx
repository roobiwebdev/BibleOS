import { BOOKS, type BookInfo } from "@starter/bible-core/books";
import { makeVerseId, type VerseId } from "@starter/bible-core/verse-id";
import { Dialog, DialogContent, DialogTitle } from "@starter/ui/components/dialog";
import { cn } from "@starter/ui/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { usePreferences, useT } from "../../lib/state/preferences";
import { useStudy } from "../../lib/state/study-store";

/**
 * SOURCE OF TRUTH KEYWORDS: ChapterPicker, book picker, chapter grid, navigate to chapter
 * WHAT:  A two-step chooser: pick a book (Old and New Testament lists), then a chapter.
 *        Chapters already read are tinted; the current chapter is outlined.
 * WHY:   Browsing by book is how most people move through the Bible; ⌘K is for typing.
 * WHERE: reader title button.
 */
export function ChapterPicker({
  open,
  onOpenChange,
  current,
  available,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: { ord: number; chapter: number };
  /** Openable chapters in the preview; undefined means all. */
  available: readonly VerseId[] | undefined;
}) {
  const t = useT();
  const { prefs } = usePreferences();
  const study = useStudy();
  const navigate = useNavigate();
  const [book, setBook] = useState<BookInfo | undefined>();
  const shown = book ?? BOOKS.find((b) => b.ord === current.ord) ?? BOOKS[0];

  const go = (chapterId: VerseId) => {
    void navigate({ to: "/read", search: { c: chapterId } });
    onOpenChange(false);
    setBook(undefined);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setBook(undefined);
      }}
    >
      <DialogContent className="max-w-3xl gap-0 overflow-hidden p-0 sm:max-w-3xl" showCloseButton={false}>
        <DialogTitle className="border-b px-5 py-3 text-sm font-semibold">{t.read.pickChapter}</DialogTitle>
        <div className="grid h-[28rem] grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          <div className="grid grid-cols-2 gap-x-2 overflow-y-auto border-r p-3">
            {(["OT", "NT"] as const).map((testament) => (
              <div key={testament}>
                <p className="eyebrow mb-1.5 px-2">
                  {testament === "OT" ? t.progress.oldTestament : t.progress.newTestament}
                </p>
                <ul>
                  {BOOKS.filter((b) => b.testament === testament).map((b) => (
                    <li key={b.code}>
                      <button
                        type="button"
                        onClick={() => setBook(b)}
                        aria-pressed={shown?.code === b.code}
                        className={cn(
                          "w-full truncate rounded-md px-2 py-1 text-left text-[13px]",
                          shown?.code === b.code ? "bg-accent font-semibold text-accent-foreground" : "hover:bg-muted",
                        )}
                      >
                        {b[prefs.locale].short}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {shown && (
            <div className="overflow-y-auto p-4">
              <p className="mb-3 font-semibold">{shown[prefs.locale].name}</p>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-1.5">
                {Array.from({ length: shown.chapters }, (_c, i) => {
                  const chapterId = makeVerseId(shown.ord, i + 1);
                  const isCurrent = shown.ord === current.ord && i + 1 === current.chapter;
                  const inPreview = available === undefined || available.includes(chapterId);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => go(chapterId)}
                      aria-current={isCurrent ? "page" : undefined}
                      className={cn(
                        "h-10 rounded-lg text-sm font-medium tabular transition-colors",
                        study.chaptersRead.has(chapterId) ? "bg-accent text-accent-foreground" : "bg-muted",
                        isCurrent && "ring-2 ring-primary",
                        !inPreview && "opacity-45",
                        "hover:bg-primary hover:text-primary-foreground",
                      )}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
