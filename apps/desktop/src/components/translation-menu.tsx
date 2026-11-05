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
import { Check, ChevronDown } from "lucide-react";

import { findTranslation, ORDERED_TRANSLATIONS } from "../lib/bible/translations";

/**
 * SOURCE OF TRUTH KEYWORDS: TranslationMenu, translation picker, choose translation, Bible version menu
 * WHAT:  A compact menu to choose a translation, grouped by language (Amharic, then English),
 *        each language's featured text first (the 2005 for Amharic).
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
  const current = findTranslation(value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild nativeButton>
        <Button variant={variant} size="sm" className="gap-1 font-semibold" aria-label={label}>
          {current?.abbreviation ?? value}
          <ChevronDown className="size-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {(["am", "en"] as const).map((lang, i) => (
          // Base UI requires a group label to sit inside a menu group.
          <DropdownMenuGroup key={lang}>
            {i > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel>{lang === "am" ? "አማርኛ · Amharic" : "English"}</DropdownMenuLabel>
            {ORDERED_TRANSLATIONS.filter((t) => t.language === lang).map((t) => (
              <DropdownMenuItem key={t.id} onClick={() => onChange(t.id)} className="gap-2">
                <span className="w-9 text-xs font-semibold text-muted-foreground">{t.abbreviation}</span>
                <span lang={t.language} className="flex-1 truncate">
                  {t.name}
                </span>
                {t.id === value && <Check className="size-3.5" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
