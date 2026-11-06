import { Button } from "@starter/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@starter/ui/components/dropdown-menu";
import { Check, ChevronDown, Globe } from "lucide-react";

import { findReaderTranslation, isOnline, READER_TRANSLATIONS } from "../lib/bible/catalog";
import { useT } from "../lib/state/preferences";

/**
 * SOURCE OF TRUTH KEYWORDS: TranslationMenu, translation picker, choose translation, Bible version menu
 * WHAT:  A compact menu to choose a translation, grouped by language (Amharic, then English),
 *        each language's featured text first (the 2005 for Amharic). Online translations (ESV,
 *        NLT) are listed after the bundled ones with an "Online" marker.
 * WHY:   The reader header and the search page pick translations the same way.
 * WHERE: reader header (main and parallel translation), search page.
 */
export function TranslationMenu({
  value,
  onChange,
  variant = "ghost",
  label,
}: {
  value: string;
  onChange: (id: string) => void;
  variant?: "ghost" | "outline";
  /** Accessible name when the button shows only the abbreviation. */
  label?: string;
}) {
  const t = useT();
  const current = findReaderTranslation(value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild nativeButton>
        <Button variant={variant} size="sm" className="gap-1 font-semibold" aria-label={label}>
          {current?.abbreviation ?? value}
          {isOnline(current) && <Globe aria-label={t.online.online} className="size-3 opacity-60" />}
          <ChevronDown className="size-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {(["am", "en"] as const).map((lang, i) => (
          // Base UI requires a group label to sit inside a menu group.
          <DropdownMenuGroup key={lang}>
            {i > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel>{lang === "am" ? "አማርኛ · Amharic" : "English"}</DropdownMenuLabel>
            {READER_TRANSLATIONS.filter((tr) => tr.language === lang).map((tr) => (
              <DropdownMenuItem key={tr.id} onClick={() => onChange(tr.id)} className="gap-2">
                <span className="w-9 text-xs font-semibold text-muted-foreground">{tr.abbreviation}</span>
                <span lang={tr.language} className="flex-1 truncate">
                  {tr.name}
                </span>
                {isOnline(tr) && (
                  <span className="inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[10px] text-muted-foreground">
                    <Globe aria-hidden className="size-2.5" />
                    {t.online.online}
                  </span>
                )}
                {tr.id === value && <Check className="size-3.5" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
