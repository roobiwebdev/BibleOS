import { cn } from "@starter/ui/lib/utils";
import { Link, Outlet } from "@tanstack/react-router";
import { BookOpen, ChartNoAxesColumn, NotebookPen, Search, Settings, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { WeekDots } from "../components/week-dots";
import { usePreferences, useT } from "../lib/state/preferences";
import { useHabits } from "../lib/state/use-habits";
import { CommandPalette } from "./command-palette";

const NAV = [
  { to: "/today", key: "today", icon: Sun },
  { to: "/read", key: "read", icon: BookOpen },
  { to: "/study", key: "study", icon: NotebookPen },
  { to: "/progress", key: "progress", icon: ChartNoAxesColumn },
] as const;

/** Sidebar + content frame. The top strip is draggable and leaves room for the macOS window buttons. */
export function AppShell() {
  const t = useT();
  const { prefs } = usePreferences();
  const habits = useHabits();
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-full">
      <aside
        className={cn(
          "flex w-56 shrink-0 flex-col border-r bg-sidebar transition-[margin] duration-300",
          prefs.focusMode && "-ml-56",
        )}
      >
        <div data-tauri-drag-region className="h-11 shrink-0" />
        <div className="px-4 pb-4">
          <div className="flex items-center gap-2 px-1">
            <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <BookOpen className="size-3.5" />
            </span>
            <span className="text-[15px] font-semibold tracking-tight">BibleOS</span>
          </div>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="mt-4 flex w-full items-center gap-2 rounded-lg border bg-card px-2.5 py-1.5 text-left text-[13px] text-muted-foreground shadow-xs transition-colors hover:text-foreground"
          >
            <Search className="size-3.5" />
            <span className="flex-1 truncate">{t.palette.goTo}…</span>
            <kbd className="rounded border bg-muted px-1 text-[10px] font-medium">⌘K</kbd>
          </button>
        </div>

        <nav className="flex flex-col gap-0.5 px-2">
          {NAV.map(({ to, key, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13.5px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              activeProps={{
                className: "bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground",
              }}
            >
              <Icon className="size-4" />
              {t.nav[key]}
            </Link>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-3 p-4">
          <Link
            to="/progress"
            className="rounded-xl border bg-card p-3 shadow-xs transition-colors hover:border-primary/30"
          >
            <div className="mb-2.5 flex items-baseline justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t.today.thisWeek}
              </span>
              <span className="tabular text-[11px] text-muted-foreground">
                {habits.todayMinutes}/{prefs.goalMinutes}′
              </span>
            </div>
            <WeekDots dots={habits.dots} size="sm" />
            <p className="mt-2.5 text-xs font-medium">{t.today.rhythm(habits.streak)}</p>
          </Link>
          <Link
            to="/settings"
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13.5px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            )}
            activeProps={{ className: "bg-accent text-accent-foreground" }}
          >
            <Settings className="size-4" />
            {t.nav.settings}
          </Link>
        </div>
      </aside>

      <main className="relative min-w-0 flex-1 overflow-hidden">
        <Outlet />
      </main>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
