import { formatReference, matchBooks, parseReference } from "@starter/bible-core/reference";
import { makeVerseId } from "@starter/bible-core/verse-id";
import { Dialog, DialogContent, DialogTitle } from "@starter/ui/components/dialog";
import { cn } from "@starter/ui/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import {
  BookOpen,
  ChartNoAxesColumn,
  Columns2,
  CornerDownLeft,
  Maximize2,
  NotebookPen,
  Search,
  Settings,
  Sun,
} from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { usePreferences, useT } from "../lib/state/preferences";

interface Item {
  id: string;
  label: string;
  hint?: string;
  icon: ReactNode;
  run: () => void;
}

/**
 * SOURCE OF TRUTH KEYWORDS: CommandPalette, ⌘K, go to passage, command menu, combobox
 * WHAT:  Jump to any passage typed in English or Amharic, a book, a screen, run a command, or
 *        search the whole Bible for the typed words.
 * WHY:   Typing a reference is the fastest way around the Bible. It is a real combobox so
 *        screen readers follow the highlighted option.
 * WHERE: app shell (⌘K and the sidebar search button).
 */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useT();
  const { prefs, update } = usePreferences();
  const navigate = useNavigate();
  const listId = useId();
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

  const q = query.trim();
  const items: Item[] = [];
  const ref = q ? parseReference(q) : undefined;
  if (ref && /\d/.test(q)) {
    items.push({
      id: "ref",
      label: formatReference(ref, prefs.locale),
      hint: formatReference(ref, prefs.locale === "am" ? "en" : "am"),
      icon: <BookOpen className="size-4" />,
      run: goRead(makeVerseId(ref.book.ord, ref.chapter), ref.verse),
    });
  }
  if (q) {
    for (const book of matchBooks(q.replace(/\s*\d.*$/, "") || q, 6)) {
      if (ref && ref.book.code === book.code && /\d/.test(q)) continue;
      items.push({
        id: `book-${book.code}`,
        label: book[prefs.locale].short,
        hint: book[prefs.locale === "am" ? "en" : "am"].short,
        icon: <BookOpen className="size-4 opacity-60" />,
        run: goRead(makeVerseId(book.ord, 1)),
      });
    }
  }
  // Anything typed can also be a word search; it leads when nothing above matched.
  if (q) {
    items.push({
      id: "search",
      label: t.search.paletteSearch(q),
      icon: <Search className="size-4" />,
      run: () => {
        void navigate({ to: "/search", search: { q } });
        close();
      },
    });
  }
  const pages = [
    { to: "/today", label: t.nav.today, icon: <Sun className="size-4" /> },
    { to: "/study", label: t.nav.study, icon: <NotebookPen className="size-4" /> },
    { to: "/progress", label: t.nav.progress, icon: <ChartNoAxesColumn className="size-4" /> },
    { to: "/settings", label: t.nav.settings, icon: <Settings className="size-4" /> },
  ] as const;
  const commands: Item[] = [
    ...pages.map((page) => ({
      id: page.to,
      label: page.label,
      icon: page.icon,
      run: () => {
        void navigate({ to: page.to });
        close();
      },
    })),
    {
      id: "parallel",
      label: t.palette.toggleParallel,
      icon: <Columns2 className="size-4" />,
      run: () => {
        update({ parallel: !prefs.parallel });
        close();
      },
    },
    {
      id: "focus",
      label: t.palette.toggleFocus,
      icon: <Maximize2 className="size-4" />,
      run: () => {
        update({ focusMode: !prefs.focusMode });
        void navigate({ to: "/read" });
        close();
      },
    },
    {
      id: "new-note",
      label: t.palette.newNote,
      icon: <NotebookPen className="size-4" />,
      run: () => {
        void navigate({ to: "/study", search: { tab: "notes" } });
        close();
      },
    },
  ];
  for (const command of commands) {
    if (!q || command.label.toLowerCase().includes(q.toLowerCase())) items.push(command);
  }

  const optionId = (i: number) => `${listId}-${i}`;
  const moveTo = (i: number) => {
    setActive(i);
    document.getElementById(optionId(i))?.scrollIntoView({ block: "nearest" });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="top-[22%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-lg" showCloseButton={false}>
        <DialogTitle className="sr-only">{t.palette.goTo}</DialogTitle>
        <input
          autoFocus
          role="combobox"
          aria-expanded
          aria-controls={listId}
          aria-activedescendant={items[active] ? optionId(active) : undefined}
          aria-autocomplete="list"
          aria-label={t.palette.placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            // Ignore keys while an input method (e.g. an Amharic keyboard) is composing.
            if (e.nativeEvent.isComposing) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              moveTo(Math.min(active + 1, items.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              moveTo(Math.max(active - 1, 0));
            } else if (e.key === "Enter") {
              items[active]?.run();
            }
          }}
          placeholder={t.palette.placeholder}
          className="w-full border-b bg-transparent px-4 py-3.5 text-[15px] placeholder:text-muted-foreground focus-visible:outline-none"
        />
        <ul id={listId} role="listbox" aria-label={t.palette.goTo} className="max-h-80 overflow-y-auto p-1.5">
          {items.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">{t.palette.noMatch}</li>
          )}
          {items.map((item, i) => (
            <li
              key={item.id}
              id={optionId(i)}
              role="option"
              aria-selected={i === active}
              onMouseMove={() => setActive(i)}
              onClick={item.run}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm",
                i === active ? "bg-accent text-accent-foreground" : "text-foreground",
              )}
            >
              <span aria-hidden className="text-muted-foreground">
                {item.icon}
              </span>
              <span className="flex-1 truncate font-medium">{item.label}</span>
              {item.hint && <span className="truncate text-xs text-muted-foreground">{item.hint}</span>}
              {i === active && <CornerDownLeft aria-hidden className="size-3.5 text-muted-foreground" />}
            </li>
          ))}
        </ul>
        <p aria-live="polite" className="sr-only">
          {q ? t.palette.results(items.length) : ""}
        </p>
      </DialogContent>
    </Dialog>
  );
}
