import type { DotState } from "@starter/bible-core/habits";
import { weekday, type DayKey } from "@starter/bible-core/calendar";
import { cn } from "@starter/ui/lib/utils";

/**
 * SOURCE OF TRUTH KEYWORDS: WeekDots, seven-day dots, week row, habit dots
 * WHAT:  A row of seven day markers: filled when read, a dashed ring for today still open,
 *        a soft dot for rest days and a faint dot for missed days.
 * WHY:   A gentle, glanceable record. A missed day is quiet, not red.
 * WHERE: sidebar, Today page.
 */
export function WeekDots({
  dots,
  labels,
  size = "md",
}: {
  dots: ReadonlyArray<{ day: DayKey; state: DotState }>;
  labels?: readonly string[];
  size?: "sm" | "md";
}) {
  return (
    <div className="flex items-end justify-between gap-1.5">
      {dots.map(({ day, state }) => (
        <div key={day} className="flex flex-col items-center gap-1.5">
          <span
            className={cn(
              "block rounded-full transition-colors",
              size === "sm" ? "size-2.5" : "size-6",
              state === "read" && "bg-primary",
              state === "pending" && "border-2 border-dashed border-primary/60",
              state === "rest" && "bg-primary/15",
              state === "missed" && "bg-heat-0",
            )}
          />
          {labels && <span className="text-[10px] font-medium text-muted-foreground">{labels[weekday(day)]}</span>}
        </div>
      ))}
    </div>
  );
}
