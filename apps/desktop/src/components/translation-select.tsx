import { TRANSLATIONS } from "@starter/bible-data/manifest";
import { ChevronDown } from "lucide-react";

/**
 * SOURCE OF TRUTH KEYWORDS: TranslationSelect, translation dropdown, choose translation
 * WHAT:  A native select listing every bundled translation by abbreviation and name.
 * WHY:   Settings and the first-run Welcome choose the main and side-by-side translations
 *        from the same list (the manifest).
 * WHERE: settings page, Welcome.
 */
export function TranslationSelect({
  value,
  onChange,
  labelledBy,
}: {
  value: string;
  onChange: (id: string) => void;
  labelledBy: string;
}) {
  return (
    <div className="relative">
      <select
        aria-labelledby={labelledBy}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 max-w-64 appearance-none truncate rounded-lg border border-input bg-background pl-3 pr-8 text-[13px]"
      >
        {TRANSLATIONS.map((t) => (
          <option key={t.id} value={t.id}>
            {t.abbreviation} · {t.name}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}
