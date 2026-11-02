import { makeVerseId } from "@starter/bible-core/verse-id";
import { formatReference, matchBooks, parseReference } from "@starter/bible-core/reference";
import { Dialog, DialogContent, DialogTitle } from "@starter/ui/components/dialog";
import { cn } from "@starter/ui/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import { BookOpen, ChartNoAxesColumn, CornerDownLeft, NotebookPen, Settings, Sun } from "lucide-react";
import { useState, type ReactNode } from "react";

import { usePreferences, useT } from "../lib/state/preferences";

interface Item {
  id: string;
  label: string;
  hint?: string;
  icon: ReactNode;
  run: () => void;
}

/** ⌘K: jump to any passage typed in English or Amharic, a book, or a screen. */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useT();
  const { prefs } = usePreferences();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const close = () => {
    onOpenChange(false);
    setQuery("");
    setActive(0);
  };

  const goRead = (c: number, v?: number) => () => {
    void navigate({ to: "/read", search: { c, v } });
    close();
  };

  // Rebuilt every render: a few dozen entries at most.
  const items: Item[] = (() => {
    const list: Item[] = [];
    const q = query.trim();
    const ref = q ? parseReference(q) : undefined;
    if (ref && /\d/.test(q)) {
      list.push({
        id: "ref",
        label: `${formatReference(ref, prefs.locale)}`,
        hint: formatReference(ref, prefs.locale === "am" ? "en" : "am"),
        icon: <BookOpen className="size-4" />,
        run: goRead(makeVerseId(ref.book.ord, ref.chapter), ref.verse),
      });
    }
    if (q) {
      for (const book of matchBooks(q.replace(/\s*\d.*$/, "") || q, 6)) {
        if (list.some((i) => i.id === `book-${book.code}`) || (ref && ref.book.code === book.code && /\d/.test(q)))
          continue;
        list.push({
          id: `book-${book.code}`,
          label: book[prefs.locale].short,
          hint: book[prefs.locale === "am" ? "en" : "am"].short,
          icon: <BookOpen className="size-4 opacity-60" />,
          run: goRead(makeVerseId(book.ord, 1)),
        });
      }
    }
    const pages = [
      { to: "/today", label: t.nav.today, icon: <Sun className="size-4" /> },
      { to: "/study", label: t.nav.study, icon: <NotebookPen className="size-4" /> },
      { to: "/progress", label: t.nav.progress, icon: <ChartNoAxesColumn className="size-4" /> },
      { to: "/settings", label: t.nav.settings, icon: <Settings className="size-4" /> },
    ] as const;
    for (const page of pages) {
      if (q && !page.label.toLowerCase().includes(q.toLowerCase())) continue;
      list.push({
        id: page.to,
        label: page.label,
        icon: page.icon,
        run: () => {
          void navigate({ to: page.to });
          close();
        },
      });
    }
    return list;
  })();

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="top-[22%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-lg" showCloseButton={false}>
        <DialogTitle className="sr-only">{t.palette.goTo}</DialogTitle>
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, items.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              items[active]?.run();
            }
          }}
          placeholder={t.palette.placeholder}
          className="w-full border-b bg-transparent px-4 py-3.5 text-[15px] outline-none placeholder:text-muted-foreground"
        />
        <ul className="max-h-80 overflow-y-auto p-1.5">
          {items.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">{t.palette.noMatch}</li>
          )}
          {items.map((item, i) => (
            <li key={item.id}>
              <button
                type="button"
                onMouseMove={() => setActive(i)}
                onClick={item.run}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm",
                  i === active ? "bg-accent text-accent-foreground" : "text-foreground",
                )}
              >
                <span className="text-muted-foreground">{item.icon}</span>
                <span className="flex-1 truncate font-medium">{item.label}</span>
                {item.hint && <span className="truncate text-xs text-muted-foreground">{item.hint}</span>}
                {i === active && <CornerDownLeft className="size-3.5 text-muted-foreground" />}
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
