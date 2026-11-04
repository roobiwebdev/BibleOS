/*
 * The player layout (scaled stage, play/pause and replay, chapter scrubber with progress bars)
 * follows bible-rs (site/src/lib/demo/Showcase.svelte), https://github.com/michaelshimeles/bible-rs
 * Copyright (c) 2026 Micky (github.com/michaelshimeles). MIT License; full text in
 * apps/site/THIRD_PARTY_NOTICES.md.
 */
import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { span } from "./ease";
import { DemoScene } from "./scene";
import { CAPTIONS, CHAPTERS, DURATION, STAGE } from "./script";
import { useDemoClock } from "./use-clock";

const SPANS = CHAPTERS.map((c, i) => ({ ...c, end: CHAPTERS[i + 1]?.t ?? DURATION }));

/**
 * SOURCE OF TRUTH KEYWORDS: DemoShowcase, hero demo player, chapters, captions, scrubber, scaled stage
 * WHAT:  The hero demo: the scene scaled to the frame's width, a caption line, and controls to
 *        pause, replay or jump to a chapter.
 * WHY:   Visitors can watch the whole loop or go straight to the part they care about; the
 *        caption says in words what the frame shows. The frame is described for screen readers.
 * WHERE: sections/hero.tsx (lazy-loaded behind the poster image).
 */
export default function DemoShowcase({ label }: { label: string }) {
  const frame = useRef<HTMLDivElement>(null);
  const clock = useDemoClock(frame);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const node = frame.current;
    if (!node) return;
    const observer = new ResizeObserver(() => setScale(node.clientWidth / STAGE.w));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const t = clock.time;
  const caption = CAPTIONS.find((c) => t >= c.start - 200 && t < c.end + 1200);

  return (
    <div className="flex w-full flex-col gap-4">
      <div
        ref={frame}
        role="img"
        aria-label={label}
        className="lift relative w-full overflow-hidden rounded-2xl border bg-stage"
        style={{ aspectRatio: `${STAGE.w} / ${STAGE.h}` }}
      >
        <div className="absolute top-0 left-0 origin-top-left" style={{ transform: `scale(${scale})` }} aria-hidden>
          <DemoScene t={t} />
        </div>
      </div>

      <p className="min-h-[1.6em] text-center text-[15px] text-pretty sm:text-base" aria-hidden>
        {caption?.words.map((w, i) => (
          <span key={i} className="transition-opacity" style={{ opacity: 0.3 + 0.7 * span(t, w.at - 60, w.at + 160) }}>
            {w.text}{" "}
          </span>
        ))}
      </p>

      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={clock.toggle}
          aria-label={clock.paused ? "Play demo" : "Pause demo"}
          className="grid size-8 shrink-0 place-items-center rounded-full bg-foreground/[0.07] transition-colors hover:bg-foreground/[0.12]"
        >
          {clock.paused ? <Play className="size-3.5 fill-current" /> : <Pause className="size-3.5 fill-current" />}
        </button>
        <button
          type="button"
          onClick={clock.replay}
          aria-label="Replay demo"
          className="grid size-8 shrink-0 place-items-center rounded-full bg-foreground/[0.07] transition-colors hover:bg-foreground/[0.12]"
        >
          <RotateCcw className="size-3.5" />
        </button>
        <ol className="ml-2 flex min-w-0 flex-1 gap-1.5">
          {SPANS.map((c, i) => {
            const active = t >= c.t && t < c.end;
            return (
              <li key={c.label} className="min-w-0 basis-0" style={{ flexGrow: c.end - c.t }}>
                <button
                  type="button"
                  onClick={() => clock.seek(c.t)}
                  aria-label={`Chapter ${i + 1}: ${c.label}`}
                  aria-current={active ? "step" : undefined}
                  className={`flex w-full flex-col gap-2 pt-3.5 text-left text-xs transition-colors hover:text-foreground ${
                    active ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <span className="block h-1 overflow-hidden rounded-full bg-foreground/[0.12]">
                    <span
                      className="block h-full origin-left bg-foreground"
                      style={{ transform: `scaleX(${span(t, c.t, c.end)})` }}
                    />
                  </span>
                  <span className="hidden truncate sm:block">
                    <span className="tabular mr-1.5 text-[11px] opacity-70">{i + 1}</span>
                    {c.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
