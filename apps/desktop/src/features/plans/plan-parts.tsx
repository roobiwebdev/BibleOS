import { formatPassageGroup, passageGroups, type PlanDay } from "@starter/bible-core/plans";
import { chapterOf, splitVerseId } from "@starter/bible-core/verse-id";
import { Button } from "@starter/ui/components/button";
import { cn } from "@starter/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpenText,
  CalendarRange,
  Check,
  Cross,
  Feather,
  Library,
  Mountain,
  Music,
  PencilLine,
  type LucideIcon,
} from "lucide-react";

import { usePreferences, useT } from "../../lib/state/preferences";

const ICONS: Record<string, LucideIcon> = {
  "gospels-30": Cross,
  "through-bible-year": CalendarRange,
  "nt-90": BookOpenText,
  "psalms-proverbs": Music,
  "bible-year": Library,
  "sermon-mount": Mountain,
  "john-21": Feather,
};

/**
 * SOURCE OF TRUTH KEYWORDS: PlanIcon, plan icon, plan badge
 * WHAT:  The icon tile for a plan key (custom plans get a pen).
 * WHERE: Plans page cards, active plan header, Today's reading.
 */
export function PlanIcon({ planKey, className }: { planKey: string; className?: string }) {
  const Icon = ICONS[planKey] ?? PencilLine;
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary",
        className,
      )}
    >
      <Icon className="size-5" />
    </span>
  );
}

/**
 * SOURCE OF TRUTH KEYWORDS: PassageLinks, plan day passages, Read link, open passage in reader
 * WHAT:  A day's passages as links into the reader (one per chapter run), e.g. "Genesis 1–3 →".
 * WHY:   Plans and Today both send the reader straight to the passage with /read?c=…&v=….
 * WHERE: Plans page day list and today's reading, Today's reading card.
 */
export function PassageLinks({ passages, compact = false }: { passages: PlanDay; compact?: boolean }) {
  const { prefs } = usePreferences();
  const t = useT();
  return (
    <ul className={cn("flex flex-wrap gap-2", compact && "gap-x-3 gap-y-1")}>
      {passageGroups(passages).map((group) => {
        const first = group[0];
        if (!first) return null;
        const verse = splitVerseId(first.start).verse;
        const label = formatPassageGroup(group, prefs.locale);
        return (
          <li key={first.start}>
            {compact ? (
              <Link
                to="/read"
                search={{ c: chapterOf(first.start), v: verse || undefined }}
                className="text-sm text-primary underline-offset-4 hover:underline"
              >
                {label}
              </Link>
            ) : (
              <Button variant="outline" size="sm" asChild>
                <Link
                  to="/read"
                  search={{ c: chapterOf(first.start), v: verse || undefined }}
                  aria-label={`${t.plans.read} ${label}`}
                >
                  {label} <ArrowRight />
                </Link>
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * SOURCE OF TRUTH KEYWORDS: DayCheck, mark day done, plan day checkbox
 * WHAT:  A round checkbox that marks one plan day read or unread.
 * WHERE: Plans page day list, Today's reading card.
 */
export function DayCheck({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        checked ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/60",
      )}
    >
      {checked && <Check className="size-3.5" strokeWidth={3} />}
    </button>
  );
}

/** A thin progress bar (0–1). */
export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-muted", className)}>
      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.round(value * 100)}%` }} />
    </div>
  );
}
