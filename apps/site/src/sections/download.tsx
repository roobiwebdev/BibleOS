import { Download as DownloadIcon, ExternalLink } from "lucide-react";

import { PlatformIcon } from "../components/platform-icon";
import { SectionHeading } from "../components/section-heading";
import { PLATFORMS, REPO } from "../config";
import { COPY } from "../copy";
import { useNextSteps } from "../lib/next-steps";
import { useReleaseInfo } from "../lib/release-context";
import { downloadsFor, formatSize } from "../lib/releases";

/**
 * SOURCE OF TRUTH KEYWORDS: DownloadSection, platform cards, installers, release links, fallback
 * WHAT:  One card per platform with its recommended installer and the other formats; the
 *        visitor's own system is marked.
 * WHY:   Links come from the latest GitHub release. Until one exists, or if GitHub can't be
 *        reached, every button opens the releases page instead of a dead link.
 * WHERE: app.tsx.
 */
export function DownloadSection() {
  const { release, platform } = useReleaseInfo();
  const d = COPY.download;
  const { show } = useNextSteps();
  return (
    <section id="download" aria-labelledby="download-title" className="border-y bg-sidebar py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading id="download-title" eyebrow={d.eyebrow} title={d.title}>
          <p>{d.body}</p>
        </SectionHeading>

        <ul className="mt-14 grid gap-4 md:grid-cols-3">
          {PLATFORMS.map((p) => {
            const links = downloadsFor(release, p.id);
            const [main, ...rest] = links.toSorted((a, b) => Number(b.recommended) - Number(a.recommended));
            const mine = p.id === platform;
            return (
              <li
                key={p.id}
                data-platform={p.id}
                className={`relative flex flex-col rounded-2xl border bg-card p-6 ${mine ? "ring-2 ring-primary" : ""}`}
              >
                {mine && (
                  <span className="absolute -top-3 left-6 rounded-full bg-primary px-2.5 py-0.5 text-[12px] font-medium text-primary-foreground">
                    {d.yourSystem}
                  </span>
                )}
                <div className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-xl bg-muted">
                    <PlatformIcon platform={p.id} className="size-5" />
                  </span>
                  <div>
                    <h3 className="text-[18px] font-semibold">{p.name}</h3>
                    <p className="text-[13px] text-muted-foreground">{p.requirement}</p>
                  </div>
                </div>
                {main && (
                  <a
                    href={main.url}
                    onClick={() => main.id !== "page" && show(p.id)}
                    className={`mt-6 inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-[15px] font-medium transition-opacity hover:opacity-90 ${
                      mine ? "bg-primary text-primary-foreground" : "bg-foreground text-background"
                    }`}
                  >
                    <DownloadIcon className="size-4" aria-hidden />
                    {COPY.hero.downloadFor(p.name)}
                  </a>
                )}
                <p className="mt-2 text-center text-[12.5px] text-muted-foreground">
                  {main?.id === "page"
                    ? COPY.hero.allOnGitHub
                    : [main?.format, main?.size ? formatSize(main.size) : undefined].filter(Boolean).join(" · ")}
                </p>
                {rest.length > 0 && (
                  <div className="mt-5 border-t pt-4 text-[13.5px]">
                    <span className="text-muted-foreground">{d.alsoAs} </span>
                    {rest.map((link, i) => (
                      <span key={link.id}>
                        {i > 0 && <span className="text-muted-foreground"> · </span>}
                        <a
                          href={link.url}
                          onClick={() => show(p.id)}
                          className="font-medium underline decoration-border underline-offset-4 hover:decoration-foreground"
                        >
                          {link.format}
                        </a>
                      </span>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <div className="mt-8 flex flex-col items-center gap-2 text-center text-[14px]">
          {release.status === "fallback" && <p className="max-w-xl text-muted-foreground">{d.notYet}</p>}
          <a
            href={release.status === "ready" ? release.pageUrl : REPO.releasesUrl}
            className="inline-flex items-center gap-1.5 font-medium underline decoration-border underline-offset-4 hover:decoration-foreground"
          >
            {d.allReleases}
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        </div>
      </div>
    </section>
  );
}
