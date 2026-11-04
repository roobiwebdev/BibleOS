import { ArrowDown, Download } from "lucide-react";
import { lazy, Suspense, useSyncExternalStore } from "react";

import { AppIcon } from "../components/logo";
import { PlatformIcon } from "../components/platform-icon";
import { PLATFORMS } from "../config";
import { COPY } from "../copy";
import { STAGE } from "../demo/script";
import { useReleaseInfo } from "../lib/release-context";
import { downloadsFor } from "../lib/releases";

const DemoShowcase = lazy(() => import("../demo/showcase"));

const noSubscribe = () => () => undefined;

function Poster() {
  return (
    <div className="flex w-full flex-col gap-4">
      <img
        src="./demo-poster.webp"
        alt={COPY.hero.demoLabel}
        width={STAGE.w}
        height={STAGE.h}
        className="lift h-auto w-full rounded-2xl border bg-stage"
      />
      <div className="h-[1.6em]" />
      <div className="h-8" />
    </div>
  );
}

/**
 * SOURCE OF TRUTH KEYWORDS: Hero, headline, primary download, detected platform, hero demo
 * WHAT:  The first screen: icon, headline, the download button for the visitor's system, and
 *        the animated demo of the app.
 * WHY:   Most visitors want to see the app and get it. The demo code loads separately, behind
 *        a still poster of the same frame, so the headline and button paint first.
 * WHERE: app.tsx.
 */
export function Hero() {
  const { release, platform } = useReleaseInfo();
  const info = PLATFORMS.find((p) => p.id === platform);
  const primary = platform ? downloadsFor(release, platform).find((l) => l.recommended) : undefined;
  // The prerendered page shows the poster; the live demo mounts after hydration.
  const inBrowser = useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
  const version = release.status === "ready" ? COPY.hero.version(release.version) : undefined;

  return (
    <section id="top" aria-labelledby="hero-title" className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[640px]"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 900px 520px at 50% -60px, color-mix(in oklch, var(--primary) 12%, transparent), transparent)",
        }}
      />
      <div className="relative mx-auto max-w-6xl px-4 pt-32 pb-20 sm:px-6 sm:pt-40">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <AppIcon size={88} className="drop-shadow-sm" />
          <p className="eyebrow mt-6">{COPY.hero.eyebrow}</p>
          <h1
            id="hero-title"
            className="scripture mt-4 text-[2.4rem] leading-[1.08] font-medium tracking-tight text-balance sm:text-[3.6rem]"
          >
            {COPY.hero.title}
          </h1>
          <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-muted-foreground text-pretty sm:text-lg">
            {COPY.hero.lead}
          </p>

          <div className="mt-9 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
            <a
              href={primary?.url ?? "#download"}
              className="inline-flex w-full items-center justify-center gap-2.5 rounded-full bg-primary px-6 py-3.5 text-[15px] font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90 sm:w-auto"
            >
              {platform ? (
                <PlatformIcon platform={platform} className="size-[18px]" />
              ) : (
                <Download className="size-[18px]" aria-hidden />
              )}
              {info ? COPY.hero.downloadFor(info.name) : COPY.hero.downloadAny}
            </a>
            <a
              href="#download"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border bg-card/60 px-6 py-3.5 text-[15px] font-medium transition-colors hover:bg-card sm:w-auto"
            >
              {COPY.hero.otherPlatforms}
              <ArrowDown className="size-4" aria-hidden />
            </a>
          </div>
          <p className="mt-4 min-h-5 text-[13px] text-muted-foreground" aria-live="polite">
            {release.status === "loading"
              ? COPY.hero.checking
              : [version ?? COPY.hero.allOnGitHub, info?.requirement].filter(Boolean).join(" · ")}
          </p>
        </div>

        <div className="mx-auto mt-14 max-w-5xl sm:mt-16">
          {inBrowser ? (
            <Suspense fallback={<Poster />}>
              <DemoShowcase label={COPY.hero.demoLabel} />
            </Suspense>
          ) : (
            <Poster />
          )}
        </div>
      </div>
    </section>
  );
}
