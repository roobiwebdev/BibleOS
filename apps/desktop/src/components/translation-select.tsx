import { ChevronDown } from "lucide-react";

import { isOnline, READER_TRANSLATIONS } from "../lib/bible/catalog";
import { useT } from "../lib/state/preferences";

/**
 * SOURCE OF TRUTH KEYWORDS: TranslationSelect, translation dropdown, choose translation
 * WHAT:  A native select listing every translation by abbreviation and name, Amharic first with
 *        the 2005 at the top, online ones marked.
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
  const t = useT();
  return (
    <div className="relative">
      <select
        aria-labelledby={labelledBy}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 max-w-64 appearance-none truncate rounded-lg border border-input bg-background pl-3 pr-8 text-[13px]"
      >
        {READER_TRANSLATIONS.map((tr) => (
          <option key={tr.id} value={tr.id} lang={tr.language}>
            {tr.abbreviation} · {tr.name}
            {isOnline(tr) ? ` (${t.online.online})` : ""}
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
