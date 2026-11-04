import { cn } from "@starter/ui/lib/utils";

import { openExternal } from "../lib/native";
import { useT } from "../lib/state/preferences";

/** Who makes BibleOS. The URL must stay in the opener allow-list in capabilities/default.json. */
const AUTHOR = { name: "Roobi", url: "https://roobi.dev/" } as const;

/**
 * SOURCE OF TRUTH KEYWORDS: BuiltBy, author credit, Roobi, roobi.dev, built by, portfolio link
 * WHAT:  "Built by Roobi." with the name underlined; clicking it opens roobi.dev in the browser.
 * WHY:   Credits the maker in the app the same way the landing page footer does.
 * WHERE: AppShell sidebar footer and Settings → About.
 */
export function BuiltBy({ className }: { className?: string }) {
  const t = useT();
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      {t.settings.builtBy}{" "}
      <a
        href={AUTHOR.url}
        onClick={(e) => {
          e.preventDefault();
          openExternal(AUTHOR.url);
        }}
        className="underline decoration-muted-foreground/60 underline-offset-4 transition-colors hover:text-foreground hover:decoration-foreground"
      >
        {AUTHOR.name}
      </a>
      .
    </p>
  );
}
