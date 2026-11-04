import { CircleCheck, X } from "lucide-react";
import { useEffect, useRef } from "react";

import { PLATFORMS } from "../config";
import { COPY } from "../copy";
import { useNextSteps } from "../lib/next-steps";
import { InstallSteps } from "./install-steps";

/**
 * SOURCE OF TRUTH KEYWORDS: NextStepsDialog, download started, post-download guide, install help, modal
 * WHAT:  A dialog that opens as a download starts, with that platform's short install steps and
 *        a picture of each security prompt.
 * WHY:   The one-time macOS and Windows prompt is where people give up. Showing the exact clicks
 *        while the file downloads gets them past it. Native <dialog> gives focus trapping,
 *        Escape to close and a backdrop for free.
 * WHERE: app.tsx, once for the whole page.
 */
export function NextStepsDialog() {
  const { open, close } = useNextSteps();
  const ref = useRef<HTMLDialogElement>(null);
  const info = PLATFORMS.find((p) => p.id === open);
  const t = COPY.nextSteps;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={close}
      onClick={(e) => {
        // A click on the backdrop lands on the dialog element itself.
        if (e.target === e.currentTarget) close();
      }}
      aria-labelledby="next-steps-title"
      className="m-auto w-[min(34rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl border bg-card p-0 text-foreground shadow-2xl backdrop:bg-foreground/30 backdrop:backdrop-blur-sm"
    >
      {open && info && (
        <div className="p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-[13px] font-medium text-primary">
                <CircleCheck className="size-4" aria-hidden />
                {t.title}
              </p>
              <h2 id="next-steps-title" className="mt-2 text-[20px] font-semibold tracking-tight">
                {t.lead(info.name)}
              </h2>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label={t.closeLabel}
              className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-[18px]" />
            </button>
          </div>

          <div className="mt-6">
            <InstallSteps platform={open} compact />
          </div>
          <p className="mt-5 text-[13.5px] leading-relaxed text-muted-foreground">{COPY.install.platforms[open].tip}</p>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <a
              href="#install"
              onClick={close}
              className="text-center text-[14px] font-medium underline decoration-border underline-offset-4 hover:decoration-foreground"
            >
              {t.fullGuide}
            </a>
            <button
              type="button"
              onClick={close}
              className="rounded-full bg-primary px-6 py-2.5 text-[15px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              {t.close}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
