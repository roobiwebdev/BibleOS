import { cn } from "@starter/ui/lib/utils";
import type { ReactNode } from "react";

import { TitleBarStrip } from "./title-bar-strip";

/**
 * SOURCE OF TRUTH KEYWORDS: Page, PageHeader, page frame, page container, Eyebrow, Card
 * WHAT:  The frame every top-level screen sits in: the title bar strip (TitleBarStrip), one
 *        scroll area, and a content column with the same width and left edge everywhere.
 * WHY:   Screens jumped between different left offsets; one frame keeps them aligned and
 *        lets them adapt to narrow windows in one place.
 * WHERE: Today, Study, Progress, Settings.
 */
export function Page({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  return (
    <div className={cn("@container flex h-full flex-col", scroll && "overflow-y-auto")}>
      <TitleBarStrip />
      <div className="mx-auto flex w-full max-w-5xl min-h-0 flex-1 flex-col px-6 pb-16 @3xl:px-10">{children}</div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end gap-x-6 gap-y-3">
      <div className="min-w-0 flex-1">
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{title}</h1>
      </div>
      {actions}
    </header>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("eyebrow mb-3", className)}>{children}</p>;
}

export function Card({ className, children, label }: { className?: string; children: ReactNode; label?: string }) {
  return (
    <section aria-label={label} className={cn("rounded-2xl border bg-card p-6 shadow-xs", className)}>
      {children}
    </section>
  );
}
