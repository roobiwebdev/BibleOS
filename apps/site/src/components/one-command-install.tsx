import { Check, Copy, Zap } from "lucide-react";
import { useEffect, useState } from "react";

import { INSTALL_COMMANDS, type PlatformId } from "../config";
import { COPY } from "../copy";

/**
 * SOURCE OF TRUTH KEYWORDS: OneCommandInstall, one-line install, copy command, terminal, PowerShell, no warnings
 * WHAT:  The platform's one-line install command, where to paste it, and a copy button.
 * WHY:   The fastest warning-free install for testers: the scripts fetch the release outside the
 *        browser, so SmartScreen and Gatekeeper don't ask. Shown before the usual steps.
 * WHERE: sections/install.tsx and components/next-steps-dialog.tsx.
 */
export function OneCommandInstall({ platform }: { platform: PlatformId }) {
  const t = COPY.oneCommand;
  const command = INSTALL_COMMANDS[platform];
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = () => {
    void navigator.clipboard
      .writeText(command)
      .then(() => setCopied(true))
      .catch(() => undefined);
  };

  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 sm:p-5">
      <p className="flex items-center gap-2 text-[14.5px] font-semibold">
        <Zap className="size-4 text-primary" aria-hidden />
        {t.title}
      </p>
      <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">{t.how[platform]}</p>
      <div className="mt-3 flex items-stretch gap-2">
        <code className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-background px-3.5 py-2.5 font-mono text-[13px] whitespace-nowrap">
          {command}
        </code>
        <button
          type="button"
          onClick={copy}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-[13.5px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          <span aria-live="polite">{copied ? t.copied : t.copy}</span>
        </button>
      </div>
      <p className="mt-2 text-[12.5px] text-muted-foreground">{t.note}</p>
    </div>
  );
}
