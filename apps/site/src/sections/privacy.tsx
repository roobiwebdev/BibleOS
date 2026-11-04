import { HardDrive, UserX, WifiOff } from "lucide-react";

import { Reveal } from "../components/reveal";
import { SectionHeading } from "../components/section-heading";
import { COPY } from "../copy";

const ICONS = [UserX, WifiOff, HardDrive] as const;

/**
 * SOURCE OF TRUTH KEYWORDS: Privacy, local first, offline, no account, your data
 * WHAT:  Why BibleOS keeps everything on the reader's computer.
 * WHY:   For many readers, notes and prayers are private; this says plainly where they live.
 * WHERE: app.tsx.
 */
export function Privacy() {
  const p = COPY.privacy;
  return (
    <section id="privacy" aria-labelledby="privacy-title" className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading id="privacy-title" eyebrow={p.eyebrow} title={p.title}>
          <p>{p.body}</p>
        </SectionHeading>
        <Reveal>
          <ul className="mt-14 grid gap-4 sm:grid-cols-3">
            {p.points.map((point, i) => {
              const Icon = ICONS[i] ?? HardDrive;
              return (
                <li key={point.title} className="rounded-2xl border bg-card p-6">
                  <span className="grid size-10 place-items-center rounded-full bg-accent text-accent-foreground">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="mt-4 text-[16px] font-semibold">{point.title}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">{point.body}</p>
                </li>
              );
            })}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
