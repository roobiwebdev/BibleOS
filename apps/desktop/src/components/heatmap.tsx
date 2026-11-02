import { addDays, weekday, type DayKey } from "@starter/bible-core/calendar";
import { heatLevel } from "@starter/bible-core/habits";
import { Tooltip, TooltipContent, TooltipTrigger } from "@starter/ui/components/tooltip";
import { cn } from "@starter/ui/lib/utils";

/**
 * SOURCE OF TRUTH KEYWORDS: Heatmap, year heatmap, contribution graph, activity grid, heat levels
 * WHAT:  A GitHub-style grid of the last N weeks: one cell per day, shaded by minutes read
 *        relative to the daily goal, with month labels and a hover tooltip.
 * WHY:   Shows consistency over a year at a glance. Levels are relative to the reader's own
 *        goal, so a modest goal still fills the grid.
 * WHERE: Progress page; a compact version can sit on Today later.
 */
export function Heatmap({
  minutes,
  today,
  goalMinutes,
  weeks = 53,
  weekStartsOn = 1,
  monthLabel,
  dayLabel,
  tooltip,
  legend,
}: {
  minutes: ReadonlyMap<DayKey, number>;
  today: DayKey;
  goalMinutes: number;
  weeks?: number;
  weekStartsOn?: number;
  /** Month label for the first day of a column, or undefined to leave it blank. */
  monthLabel: (day: DayKey) => string | undefined;
  dayLabel: (row: number) => string;
  tooltip: (day: DayKey, minutes: number) => string;
  legend: { less: string; more: string };
}) {
  const offset = (weekday(today) - weekStartsOn + 7) % 7;
  const firstDay = addDays(today, -offset - (weeks - 1) * 7);
  const columns = Array.from({ length: weeks }, (_week, w) =>
    Array.from({ length: 7 }, (_day, d) => addDays(firstDay, w * 7 + d)),
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <div className="mt-5 grid grid-rows-7 gap-[3px] text-[10px] text-muted-foreground">
          {Array.from({ length: 7 }, (_label, row) => (
            <span key={row} className="flex h-[11px] items-center leading-none">
              {row % 2 === 0 ? dayLabel(row) : ""}
            </span>
          ))}
        </div>
        <div className="flex flex-1 gap-[3px] overflow-hidden">
          {columns.map((column) => {
            const label = monthLabel(column[0] ?? today);
            return (
              <div key={column[0]} className="flex flex-col gap-[3px]">
                <span className="h-4 whitespace-nowrap text-[10px] leading-4 text-muted-foreground">{label ?? ""}</span>
                {column.map((day) => {
                  const future = day > today;
                  const m = minutes.get(day) ?? 0;
                  const level = heatLevel(m, goalMinutes);
                  return future ? (
                    <span key={day} className="size-[11px]" />
                  ) : (
                    <Tooltip key={day}>
                      <TooltipTrigger asChild>
                        <span
                          className={cn(
                            "size-[11px] rounded-[3px] transition-transform hover:scale-125",
                            level === 0 && "bg-heat-0",
                            level === 1 && "bg-heat-1",
                            level === 2 && "bg-heat-2",
                            level === 3 && "bg-heat-3",
                            level === 4 && "bg-heat-4",
                            day === today && "ring-1 ring-foreground/40 ring-offset-1 ring-offset-card",
                          )}
                        />
                      </TooltipTrigger>
                      <TooltipContent side="top">{tooltip(day, m)}</TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground">
        <span>{legend.less}</span>
        {(["bg-heat-0", "bg-heat-1", "bg-heat-2", "bg-heat-3", "bg-heat-4"] as const).map((c) => (
          <span key={c} className={cn("size-[11px] rounded-[3px]", c)} />
        ))}
        <span>{legend.more}</span>
      </div>
    </div>
  );
}
