import { cn } from "@starter/ui/lib/utils";
import type { ReactNode } from "react";

/**
 * SOURCE OF TRUTH KEYWORDS: Segmented, segmented control, radio group, option picker
 * WHAT:  A compact row of mutually exclusive options (a radio group styled as segments).
 * WHY:   Settings and the first-run Welcome offer the same short choices the same way.
 * WHERE: settings page, Welcome.
 */
export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  labelledBy,
}: {
  value: T;
  options: ReadonlyArray<{ value: T; label: ReactNode }>;
  onChange: (value: T) => void;
  labelledBy: string;
}) {
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="flex rounded-lg bg-muted p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-3 py-1 text-[13px] font-medium transition-colors",
            value === o.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
