import { Plus } from "lucide-react";

import { SectionHeading } from "../components/section-heading";
import { COPY } from "../copy";

/**
 * SOURCE OF TRUTH KEYWORDS: FAQ, questions, details, accordion
 * WHAT:  Common questions, each a native <details> so it works without script and with a
 *        keyboard.
 * WHY:   Answers the questions people ask before installing: price, data, offline, Amharic.
 * WHERE: app.tsx.
 */
export function Faq() {
  const f = COPY.faq;
  return (
    <section id="faq" aria-labelledby="faq-title" className="border-t py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <SectionHeading id="faq-title" eyebrow={f.eyebrow} title={f.title} />
        <div className="mt-12 divide-y border-y">
          {f.items.map((item) => (
            <details key={item.q} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-[16.5px] font-medium [&::-webkit-details-marker]:hidden">
                {item.q}
                <Plus
                  className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-45"
                  aria-hidden
                />
              </summary>
              <p className="pb-6 text-[15.5px] leading-relaxed text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
