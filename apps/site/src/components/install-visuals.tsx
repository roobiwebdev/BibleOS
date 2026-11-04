import { ArrowRight, Folder, MousePointer2, ShieldAlert, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

import type { InstallVisual } from "../copy";
import { AppIcon } from "./logo";

// The control the visitor should click, ringed and with a pointer on it.
function Target({ children }: { children: ReactNode }) {
  return (
    <span className="relative inline-flex">
      <span className="rounded-md bg-primary px-3 py-1 text-[12px] font-medium whitespace-nowrap text-primary-foreground ring-4 ring-primary/25">
        {children}
      </span>
      <MousePointer2
        aria-hidden
        className="absolute -right-3 -bottom-3 size-4 fill-foreground text-background drop-shadow-sm"
      />
    </span>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return <span className="rounded-md border px-3 py-1 text-[12px] text-muted-foreground">{children}</span>;
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <div aria-hidden className="mt-3 rounded-xl border bg-background/70 p-4 text-[12.5px] select-none">
      {children}
    </div>
  );
}

/**
 * SOURCE OF TRUTH KEYWORDS: InstallVisualPicture, install pictures, Gatekeeper mock, SmartScreen mock, Open Anyway
 * WHAT:  Small drawings of what the visitor sees at an install step (the macOS warning, Privacy &
 *        Security's Open Anyway, Windows SmartScreen), with the button to click highlighted.
 * WHY:   People stop at a warning they don't recognise. Showing it ahead of time, drawn in the
 *        site's own tokens rather than as OS screenshots, keeps it clear in light and dark and
 *        free of Apple or Microsoft artwork. Decorative: the step text says the same thing.
 * WHERE: InstallSteps (install guide section and the next-steps dialog).
 */
export function InstallVisualPicture({ visual }: { visual: InstallVisual }) {
  switch (visual) {
    case "mac-drag":
      return (
        <Frame>
          <div className="flex items-center justify-center gap-5">
            <span className="flex flex-col items-center gap-1">
              <AppIcon size={36} />
              <span>BibleOS</span>
            </span>
            <ArrowRight className="size-5 text-primary" />
            <span className="flex flex-col items-center gap-1">
              <Folder className="size-9 fill-primary/15 text-primary" />
              <span>Applications</span>
            </span>
          </div>
        </Frame>
      );
    case "mac-alert":
      return (
        <Frame>
          <div className="mx-auto flex max-w-60 flex-col items-center gap-2 text-center">
            <ShieldAlert className="size-6 text-muted-foreground" />
            <p className="font-semibold">“BibleOS” Not Opened</p>
            <p className="text-muted-foreground">Apple could not verify “BibleOS”…</p>
            <div className="mt-1 flex gap-2">
              <Muted>Move to Trash</Muted>
              <Target>Done</Target>
            </div>
          </div>
        </Frame>
      );
    case "mac-settings":
      return (
        <Frame>
          <p className="font-semibold">Privacy &amp; Security</p>
          <p className="mt-1 text-muted-foreground">Security</p>
          <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2.5">
            <span>“BibleOS” was blocked to protect your Mac.</span>
            <Target>Open Anyway</Target>
          </div>
        </Frame>
      );
    case "win-smartscreen":
      return (
        <Frame>
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Windows protected your PC</p>
              <p className="mt-1 text-muted-foreground">
                <span className="rounded px-1 font-medium text-primary underline underline-offset-2 ring-2 ring-primary/25">
                  More info
                </span>
              </p>
              <div className="mt-3 flex justify-end gap-2">
                <Target>Run anyway</Target>
                <Muted>Don't run</Muted>
              </div>
            </div>
          </div>
        </Frame>
      );
  }
}
