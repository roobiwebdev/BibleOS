import type { ParallelRow } from "@starter/bible-core/parallel";
import type { VerseId } from "@starter/bible-core/verse-id";
import { cn } from "@starter/ui/lib/utils";
import { Fragment, type MouseEvent, type ReactNode } from "react";

import { HIGHLIGHT_BG } from "../../components/highlight-colors";
import type { ChapterHeading, ChapterVerse } from "../../lib/bible/source";
import { useT } from "../../lib/state/preferences";
import type { HighlightColor, VerseRange } from "../../lib/state/study-store";

/**
 * SOURCE OF TRUTH KEYWORDS: VerseDecor, verse decoration, highlight lookup, selection, keyboard cursor
 * WHAT:  What the reader paints on each verse: highlight, note marker, selection, cursor, and
 *        what a click does.
 * WHY:   Single and parallel views share one verse renderer, so both behave identically.
 * WHERE: ChapterText, ParallelText, reader-page.
 */
export interface VerseDecor {
  highlightOf: (verse: ChapterVerse) => HighlightColor | undefined;
  hasNote: (verse: ChapterVerse) => boolean;
  selection: VerseRange | null;
  /** Verse under the keyboard cursor, if any. */
  cursor: VerseId | null;
  onVerseClick: (verse: ChapterVerse, event: MouseEvent) => void;
}

const isSelected = (verse: ChapterVerse, selection: VerseRange | null) =>
  selection !== null && verse.vid <= selection.end && selection.start <= verse.spanEnd;

function VerseSpan({ verse, decor }: { verse: ChapterVerse; decor: VerseDecor }) {
  const t = useT();
  const color = decor.highlightOf(verse);
  const selected = isSelected(verse, decor.selection);
  const lines = verse.text.split("\n");
  return (
    <span
      data-vid={verse.vid}
      onClick={(e) => decor.onVerseClick(verse, e)}
      className={cn(
        "cursor-pointer rounded-[3px] px-[1px] transition-colors [box-decoration-break:clone]",
        color && ["highlighted", HIGHLIGHT_BG[color]],
        !color && !selected && "hover:bg-muted",
        decor.cursor !== null && verse.vid <= decor.cursor && decor.cursor <= verse.spanEnd && "ring-2 ring-ring/60",
      )}
    >
      <span className="sr-only">
        {t.read.verse} {verse.label}.{" "}
      </span>
      <sup aria-hidden className="verse-number mr-1 text-muted-foreground">
        {verse.label}
      </sup>
      <span className={cn(selected && "underline decoration-primary decoration-2 underline-offset-[5px]")}>
        {lines.map((line, i) => (
          <Fragment key={i}>
            {i > 0 && <br />}
            {line}
          </Fragment>
        ))}
      </span>
      {color && (
        <span className="sr-only">
          , {t.read.highlighted}: {t.colors[color]}
        </span>
      )}
      {decor.hasNote(verse) && (
        <>
          <span
            aria-hidden
            className="ml-1 inline-block size-1.5 -translate-y-1.5 rounded-full bg-primary align-middle"
          />
          <span className="sr-only">, {t.read.hasNote}</span>
        </>
      )}{" "}
    </span>
  );
}

function Heading({ heading }: { heading: ChapterHeading }) {
  if (heading.level === "r") {
    return <p className="-mt-3 mb-3 font-sans text-xs text-muted-foreground">{heading.text}</p>;
  }
  if (heading.level === "d") {
    return <p className="mb-3 text-[0.92em] italic text-muted-foreground">{heading.text}</p>;
  }
  return <h3 className="eyebrow mb-2 mt-7 font-sans first:mt-0">{heading.text}</h3>;
}

/**
 * SOURCE OF TRUTH KEYWORDS: ChapterText, single column reader, paragraphs, poetry lines
 * WHAT:  One translation as flowing paragraphs and indented poetry, headings in place.
 * WHY:   Scripture reads as prose and poetry, not a list of numbered lines.
 * WHERE: reader single view.
 */
export function ChapterText({
  verses,
  headings,
  lang,
  decor,
}: {
  verses: ChapterVerse[];
  headings: ChapterHeading[];
  lang: string;
  decor: VerseDecor;
}) {
  const blocks: Array<{ key: number; style: ChapterVerse["style"]; verses: ChapterVerse[]; before: ChapterHeading[] }> =
    [];
  for (const verse of verses) {
    const before = headings.filter((h) => h.vid === verse.vid);
    const last = blocks.at(-1);
    if (!last || verse.style !== "c" || before.length > 0) {
      blocks.push({ key: verse.vid, style: verse.style === "c" ? "p" : verse.style, verses: [verse], before });
    } else {
      last.verses.push(verse);
    }
  }

  return (
    <div lang={lang} className="scripture">
      {blocks.map((block) => (
        <Fragment key={block.key}>
          {block.before.map((h, i) => (
            <Heading key={i} heading={h} />
          ))}
          <p
            className={cn(
              block.style === "p" ? "mb-4" : "mb-0.5",
              block.style === "q1" && "pl-6",
              block.style === "q2" && "pl-12",
            )}
          >
            {block.verses.map((verse) => (
              <VerseSpan key={verse.vid} verse={verse} decor={decor} />
            ))}
          </p>
        </Fragment>
      ))}
    </div>
  );
}

/**
 * SOURCE OF TRUTH KEYWORDS: ParallelText, parallel reader, side by side, verse-aligned rows
 * WHAT:  Two translations, one aligned row per verse span. Side by side when there is room,
 *        stacked pairs when the window is narrow.
 * WHY:   Merged and split verses stay next to their counterparts; headings that fall inside a
 *        merged span still appear before that row.
 * WHERE: reader parallel view.
 */
export function ParallelText({
  rows,
  langs,
  headings,
  decor,
  emptyLabel,
}: {
  rows: ParallelRow<ChapterVerse>[];
  langs: [string, string];
  headings: ChapterHeading[];
  decor: VerseDecor;
  emptyLabel: ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-x-12 @3xl:grid-cols-2">
      {rows.map((row) => {
        const before = headings.filter((h) => h.vid >= row.start && h.vid <= row.end);
        return (
          <Fragment key={row.start}>
            {before.length > 0 && (
              <div className="@3xl:col-span-2">
                {before.map((h, i) => (
                  <Heading key={i} heading={h} />
                ))}
              </div>
            )}
            {row.cells.map((cell, c) => (
              <p
                key={c}
                lang={langs[c]}
                className={cn("scripture mb-3", c === 1 && "@max-3xl:mb-6 @max-3xl:border-l-2 @max-3xl:pl-3")}
              >
                {cell.length === 0 ? (
                  <span className="font-sans text-sm text-muted-foreground">{emptyLabel}</span>
                ) : (
                  cell.map((verse) => <VerseSpan key={verse.vid} verse={verse} decor={decor} />)
                )}
              </p>
            ))}
          </Fragment>
        );
      })}
    </div>
  );
}
