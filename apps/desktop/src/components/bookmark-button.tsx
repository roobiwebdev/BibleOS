import { formatRange, type VerseRange } from "@starter/bible-core/range";
import { Button } from "@starter/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@starter/ui/components/tooltip";
import { cn } from "@starter/ui/lib/utils";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { toast } from "sonner";

import { usePreferences, useT } from "../lib/state/preferences";
import { useStudy } from "../lib/state/study-store";

/**
 * SOURCE OF TRUTH KEYWORDS: BookmarkButton, one-click bookmark, toggle bookmark, aria-pressed
 * WHAT:  An icon button that bookmarks exactly the given passage, or removes that bookmark.
 *        Filled (BookmarkCheck) while the range is bookmarked; removing offers Undo.
 * WHY:   Keeping your place should take one click, with no dialog. The state is matched on the
 *        exact range, so a chapter bookmark and a verse bookmark inside it are separate.
 * WHERE: reader header (the selection, or the whole chapter when nothing is selected).
 */
export function BookmarkButton({ range }: { range: VerseRange }) {
  const t = useT();
  const { prefs } = usePreferences();
  const study = useStudy();
  const existing = study.bookmarks.find((b) => b.start === range.start && b.end === range.end);
  const label = existing ? t.history.bookmarks.remove : t.history.bookmarks.add;

  const onClick = () => {
    if (existing) {
      const undo = study.removeBookmark(existing.id);
      toast(t.history.bookmarks.removed, { action: { label: t.notes.undo, onClick: undo } });
    } else {
      study.toggleBookmark(range);
      toast(t.history.bookmarks.added(formatRange(range, prefs.locale)));
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          aria-pressed={Boolean(existing)}
          disabled={!study.ready}
          onClick={onClick}
          className={cn(existing && "text-primary")}
        >
          {existing ? <BookmarkCheck className="fill-primary/15" /> : <Bookmark />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
