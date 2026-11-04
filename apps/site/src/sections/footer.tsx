import { TRANSLATIONS } from "@starter/bible-data/manifest";

import { AppIcon } from "../components/logo";
import { REPO } from "../config";
import { COPY } from "../copy";

/**
 * SOURCE OF TRUTH KEYWORDS: SiteFooter, licences, translation notices, attribution, third-party notices
 * WHAT:  Links, and the licence and notice of every bundled Bible text.
 * WHY:   The notices come verbatim from bible-data's manifest, the same source the app's
 *        Licences page uses; the 1962 New Testament requires its full statement wherever it is
 *        used, and the ULB's CC BY-SA licence requires attribution.
 * WHERE: app.tsx.
 */
export function SiteFooter() {
  const f = COPY.footer;
  return (
    <footer className="border-t bg-sidebar">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <div className="flex items-center gap-2.5">
              <AppIcon size={32} />
              <span className="text-[16px] font-semibold tracking-tight">BibleOS</span>
            </div>
            <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">{f.tagline}</p>
          </div>
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-[14px]">
            <li>
              <a href="#download" className="hover:underline">
                {COPY.nav.download}
              </a>
            </li>
            <li>
              <a href="#install" className="hover:underline">
                {COPY.nav.install}
              </a>
            </li>
            <li>
              <a href={REPO.releasesUrl} className="hover:underline">
                {f.releases}
              </a>
            </li>
            <li>
              <a href={REPO.url} className="hover:underline">
                {f.github}
              </a>
            </li>
            <li>
              <a href={REPO.noticesUrl} className="hover:underline">
                {f.notices}
              </a>
            </li>
          </ul>
        </div>

        <div className="mt-12 border-t pt-8">
          <h2 className="eyebrow">{f.texts}</h2>
          <p className="mt-3 text-[13.5px] text-muted-foreground">{f.textsIntro}</p>
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {TRANSLATIONS.map((tr) => (
              <li key={tr.id} className="rounded-xl border bg-background/50 p-4 text-[13.5px]">
                <p lang={tr.language} className="font-semibold">
                  {tr.name}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {f.licence}:{" "}
                  <a href={tr.licence.url} className="underline underline-offset-2 hover:text-foreground">
                    {tr.licence.name}
                  </a>{" "}
                  ·{" "}
                  <a href={tr.sourceUrl} className="underline underline-offset-2 hover:text-foreground">
                    {f.source}
                  </a>
                </p>
                <details className="mt-2">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">{f.notice}</summary>
                  <p className="mt-2 text-[12.5px] leading-relaxed whitespace-pre-line text-muted-foreground">
                    {tr.notice}
                  </p>
                </details>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
