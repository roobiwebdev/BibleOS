import { addDays, weekday, type DayKey } from "@starter/bible-core/calendar";
import { heatLevel } from "@starter/bible-core/habits";
import { Tooltip, TooltipContent, TooltipTrigger } from "@starter/ui/components/tooltip";
import { cn } from "@starter/ui/lib/utils";
import { useEffect, useRef, useState } from "react";

const CELL = 11;
const GAP = 3;
const LABEL_COLUMN = 28;
const HEAT_BG = ["bg-heat-0", "bg-heat-1", "bg-heat-2", "bg-heat-3", "bg-heat-4"] as const;

/** Width of an element, kept up to date as the window resizes. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? 0));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/**
 * SOURCE OF TRUTH KEYWORDS: Heatmap, year heatmap, contribution graph, activity grid, heat levels
 * WHAT:  A GitHub-style grid ending today: one cell per day, shaded by minutes read relative
 *        to the daily goal, month labels in the reader's calendar, hover details, and a text
 *        summary for screen readers.
 * WHY:   Shows consistency at a glance. It shows as many recent weeks as fit (up to a year),
 *        so today is never cut off in a narrow window. Levels follow the reader's own goal.
 * WHERE: Progress page.
 */
export function Heatmap({
  minutes,
  today,
  goalMinutes,
  maxWeeks = 53,
  weekStartsOn = 1,
  monthLabel,
  dayLabel,
  tooltip,
  legend,
  summary,
}: {
  minutes: ReadonlyMap<DayKey, number>;
  today: DayKey;
  goalMinutes: number;
  maxWeeks?: number;
  weekStartsOn?: number;
  /** Month label when a month starts within the column's week, else undefined. */
  monthLabel: (firstDayOfColumn: DayKey) => string | undefined;
  dayLabel: (row: number) => string;
  tooltip: (day: DayKey, minutes: number) => string;
  legend: { less: string; more: string };
  summary: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const fits = Math.floor((width - LABEL_COLUMN + GAP) / (CELL + GAP));
  const weeks = Math.max(1, Math.min(maxWeeks, width === 0 ? maxWeeks : fits));
  const offset = (weekday(today) - weekStartsOn + 7) % 7;
  const firstDay = addDays(today, -offset - (weeks - 1) * 7);
  const columns = Array.from({ length: weeks }, (_week, w) =>
    Array.from({ length: 7 }, (_day, d) => addDays(firstDay, w * 7 + d)),
  );

  // Keep month labels at least three columns apart so short months never overlap.
  let lastLabelAt = -10;
  const labels = columns.map((column, i) => {
    const label = monthLabel(column[0] ?? today);
    if (!label || i - lastLabelAt < 3) return undefined;
    lastLabelAt = i;
    return label;
  });

  return (
    <div className="flex flex-col gap-3" ref={ref}>
      <p className="sr-only">{summary}</p>
      <div aria-hidden className="flex gap-[3px]">
        <div className="mt-5 flex w-[25px] flex-col gap-[3px] text-[10px] text-muted-foreground">
          {Array.from({ length: 7 }, (_label, row) => (
            <span key={row} className="flex h-[11px] items-center leading-none">
              {row % 2 === 0 ? dayLabel(row) : ""}
            </span>
          ))}
        </div>
        {columns.map((column, i) => (
          <div key={column[0]} className="flex flex-col gap-[3px]">
            <span className="h-4 w-[11px] overflow-visible whitespace-nowrap text-[10px] leading-4 text-muted-foreground">
              {labels[i] ?? ""}
            </span>
            {column.map((day) => {
              if (day > today) return <span key={day} className="size-[11px]" />;
              const m = minutes.get(day) ?? 0;
              return (
                <Tooltip key={day}>
                  <TooltipTrigger asChild>
                    <span
                      className={cn(
                        "size-[11px] rounded-[3px] transition-transform hover:scale-125",
                        HEAT_BG[heatLevel(m, goalMinutes)],
                        day === today && "ring-1 ring-foreground/50 ring-offset-1 ring-offset-card",
                      )}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top">{tooltip(day, m)}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        ))}
      </div>
      <div aria-hidden className="flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground">
        <span>{legend.less}</span>
        {HEAT_BG.map((c) => (
          <span key={c} className={cn("size-[11px] rounded-[3px]", c)} />
        ))}
        <span>{legend.more}</span>
      </div>
    </div>
  );
}
