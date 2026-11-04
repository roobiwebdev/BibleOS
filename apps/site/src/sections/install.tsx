import { Download, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { OneCommandInstall } from "../components/one-command-install";
import { InstallSteps } from "../components/install-steps";
import { PlatformIcon } from "../components/platform-icon";
import { SectionHeading } from "../components/section-heading";
import { PLATFORMS, type PlatformId } from "../config";
import { COPY } from "../copy";
import { useReleaseInfo } from "../lib/release-context";
import { downloadsFor, formatSize } from "../lib/releases";

/**
 * SOURCE OF TRUTH KEYWORDS: InstallGuide, install steps, tabs, Gatekeeper, SmartScreen, unsigned app
 * WHAT:  The short install steps per platform (shared with the after-download dialog) in
 *        keyboard-accessible tabs, opened on the visitor's system, plus why the prompt appears.
 * WHY:   The builds aren't signed with paid certificates, so macOS and Windows ask once. Saying
 *        so plainly, with the exact clicks, keeps people from giving up at that prompt.
 * WHERE: app.tsx.
 */
export function InstallGuide() {
  const { platform, release } = useReleaseInfo();
  const [tab, setTab] = useState<PlatformId>("mac");
  const chosen = useRef(false);
  const tabs = useRef<Partial<Record<PlatformId, HTMLButtonElement | null>>>({});
  const g = COPY.install;

  // Open on the visitor's system unless they already picked a tab.
  useEffect(() => {
    if (platform && !chosen.current) setTab(platform);
  }, [platform]);

  const select = (id: PlatformId, focus = false) => {
    chosen.current = true;
    setTab(id);
    if (focus) tabs.current[id]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const index = PLATFORMS.findIndex((p) => p.id === tab);
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      const target = e.key === "Home" ? PLATFORMS[0] : PLATFORMS[PLATFORMS.length - 1];
      if (target) select(target.id, true);
      return;
    }
    if (!step) return;
    e.preventDefault();
    const next = PLATFORMS[(index + step + PLATFORMS.length) % PLATFORMS.length];
    if (next) select(next.id, true);
  };

  return (
    <section id="install" aria-labelledby="install-title" className="py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <SectionHeading id="install-title" eyebrow={g.eyebrow} title={g.title}>
          <p>{g.lead}</p>
        </SectionHeading>

        <div
          role="tablist"
          aria-label={g.title}
          onKeyDown={onKeyDown}
          className="mx-auto mt-10 flex w-full max-w-md rounded-full border bg-card p-1"
        >
          {PLATFORMS.map((p) => {
            const active = p.id === tab;
            return (
              <button
                key={p.id}
                ref={(el) => {
                  tabs.current[p.id] = el;
                }}
                type="button"
                role="tab"
                id={`tab-${p.id}`}
                aria-selected={active}
                aria-controls={`panel-${p.id}`}
                tabIndex={active ? 0 : -1}
                onClick={() => select(p.id)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2 text-[14px] font-medium transition-colors ${
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <PlatformIcon platform={p.id} className="size-4" />
                {p.name}
              </button>
            );
          })}
        </div>

        {PLATFORMS.map((p) => {
          const guide = g.platforms[p.id];
          return (
            <div
              key={p.id}
              role="tabpanel"
              id={`panel-${p.id}`}
              aria-labelledby={`tab-${p.id}`}
              hidden={p.id !== tab}
              tabIndex={0}
              className="mt-8 rounded-2xl border bg-card p-6 sm:p-8"
            >
              <p className="mb-5 text-[14px] text-muted-foreground">{guide.requirement}</p>
              <OneCommandInstall platform={p.id} />
              <p className="mt-6 mb-4 text-[13px] font-medium tracking-wide text-muted-foreground uppercase">
                {COPY.oneCommand.usual}
              </p>
              {(() => {
                // Visitors arriving from the hero haven't downloaded yet; the usual way starts here.
                const file = downloadsFor(release, p.id).find((l) => l.recommended);
                if (!file) return null;
                return (
                  <a
                    href={file.url}
                    className="mb-5 inline-flex items-center gap-2 rounded-full border bg-background px-4 py-2 text-[14px] font-medium transition-colors hover:bg-muted"
                  >
                    <Download className="size-4" aria-hidden />
                    {COPY.hero.downloadFor(p.name)}
                    {file.id !== "page" && (
                      <span className="text-muted-foreground">
                        {[file.format, file.size ? formatSize(file.size) : undefined].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </a>
                );
              })()}
              <InstallSteps platform={p.id} />
              <p className="mt-6 border-t pt-4 text-[14px] leading-relaxed text-muted-foreground">{guide.tip}</p>
            </div>
          );
        })}

        <aside className="mt-6 flex gap-4 rounded-2xl border border-dashed p-6">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <div>
            <h3 className="text-[15.5px] font-semibold">{g.why.title}</h3>
            <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted-foreground">{g.why.body}</p>
          </div>
        </aside>
      </div>
    </section>
  );
}
