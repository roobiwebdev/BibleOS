import { ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { PlatformIcon } from "../components/platform-icon";
import { SectionHeading } from "../components/section-heading";
import { PLATFORMS, type PlatformId } from "../config";
import { COPY } from "../copy";
import { useReleaseInfo } from "../lib/release-context";

/**
 * SOURCE OF TRUTH KEYWORDS: InstallGuide, install steps, tabs, Gatekeeper, SmartScreen, unsigned app
 * WHAT:  Step-by-step install instructions per platform in keyboard-accessible tabs, opened on
 *        the visitor's system, plus why the one-time security prompt appears.
 * WHY:   The builds aren't signed with paid certificates, so macOS and Windows ask once. Saying
 *        so plainly, with the exact clicks, keeps people from giving up at that prompt.
 * WHERE: app.tsx.
 */
export function InstallGuide() {
  const { platform } = useReleaseInfo();
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
        <SectionHeading id="install-title" eyebrow={g.eyebrow} title={g.title} />

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
          const commands: readonly string[] = "commands" in guide ? guide.commands : [];
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
              <p className="text-[14px] text-muted-foreground">{guide.requirement}</p>
              <ol className="mt-5 flex flex-col gap-4">
                {guide.steps.map((step, i) => (
                  <li key={step} className="flex gap-4">
                    <span className="tabular grid size-7 shrink-0 place-items-center rounded-full bg-accent text-[13px] font-semibold text-accent-foreground">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className="text-[15.5px] leading-relaxed">{step}</p>
                      {commands[i] && (
                        <pre className="mt-2 overflow-x-auto rounded-lg bg-muted px-3.5 py-2.5 font-mono text-[13px] leading-relaxed">
                          <code>{commands[i]}</code>
                        </pre>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
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
