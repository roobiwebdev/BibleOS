import type { OnlineTranslation } from "@starter/bible-data/online";
import { Button } from "@starter/ui/components/button";
import { cn } from "@starter/ui/lib/utils";
import { Globe, RotateCw, WifiOff } from "lucide-react";

import type { OnlineErrorReason } from "../lib/bible/online-source";
import { openExternal } from "../lib/native";
import { useT } from "../lib/state/preferences";

/**
 * SOURCE OF TRUTH KEYWORDS: OnlineAttribution, ESV attribution, NLT attribution, esv.org link, online marker, publisher link
 * WHAT:  The line shown with online text: the abbreviation ("ESV", "NLT"), where it is read
 *        from, and the publisher's site as a link.
 * WHY:   The ESV terms require "ESV" with each quotation and a link to www.esv.org on each page
 *        that shows the text; the NLT asks for "(NLT)" with quotations. The full notices are in
 *        Settings → Translations and licences. The link must stay in the opener allow-list
 *        (src-tauri/capabilities/default.json).
 * WHERE: reader (each online chapter), Today (verse of the day), study passages, search.
 */
export function OnlineAttribution({ translation, className }: { translation: OnlineTranslation; className?: string }) {
  const t = useT();
  return (
    <p
      lang="en"
      className={cn("flex flex-wrap items-center gap-x-1.5 font-sans text-[11px] text-muted-foreground", className)}
    >
      <Globe aria-hidden className="size-3" />
      <span className="font-semibold text-foreground/80">{translation.abbreviation}</span>
      <span aria-hidden>·</span>
      <span>{t.online.readOnline(translation.publisher)}</span>
      <span aria-hidden>·</span>
      <a
        href={translation.link.url}
        aria-label={t.online.visit(translation.link.label)}
        onClick={(e) => {
          e.preventDefault();
          openExternal(translation.link.url);
        }}
        className="underline decoration-muted-foreground/50 underline-offset-2 hover:text-foreground"
      >
        {translation.link.label}
      </a>
    </p>
  );
}

/**
 * SOURCE OF TRUTH KEYWORDS: OnlineUnavailable, needs internet, offline message, retry online text, not configured
 * WHAT:  A calm message when online text cannot be shown (no internet, not set up yet, too many
 *        requests) with a retry button. `compact` fits inside a card or list row.
 * WHY:   Online translations must never block or crash a screen; the reader keeps every
 *        bundled translation and the person can retry once they are connected.
 * WHERE: reader chapters, Today, study passages, search.
 */
export function OnlineUnavailable({
  abbreviation,
  reason,
  onRetry,
  compact = false,
  className,
}: {
  abbreviation: string;
  reason: OnlineErrorReason;
  onRetry: () => void;
  compact?: boolean;
  className?: string;
}) {
  const t = useT();
  const message =
    reason === "offline"
      ? t.online.offline(abbreviation)
      : reason === "not-configured"
        ? t.online.notConfigured(abbreviation)
        : reason === "rate-limited"
          ? t.online.rateLimited
          : t.online.failed(abbreviation);
  if (compact) {
    return (
      <div
        role="status"
        className={cn("flex flex-wrap items-center gap-2 font-sans text-xs text-muted-foreground", className)}
      >
        <WifiOff aria-hidden className="size-3.5" />
        <span>{message}</span>
        <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={onRetry}>
          {t.online.retry}
        </Button>
      </div>
    );
  }
  return (
    <div
      role="status"
      className={cn(
        "mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl border bg-card px-6 py-8 text-center font-sans",
        className,
      )}
    >
      <WifiOff aria-hidden className="size-5 text-muted-foreground" />
      <p className="text-sm font-semibold">
        {reason === "offline" ? t.online.needsInternet(abbreviation) : t.online.unavailable(abbreviation)}
      </p>
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RotateCw /> {t.online.retry}
      </Button>
    </div>
  );
}
