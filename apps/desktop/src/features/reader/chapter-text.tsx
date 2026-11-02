import type { ParallelRow } from "@starter/bible-core/parallel";
import { cn } from "@starter/ui/lib/utils";
import { Fragment, type MouseEvent, type ReactNode } from "react";

import type { ChapterHeading, ChapterVerse } from "../../lib/bible/source";
import type { HighlightColor, VerseRange } from "../../lib/state/study-store";

const HIGHLIGHT_CLASS: Record<HighlightColor, string> = {
  promise: "bg-hl-promise",
  command: "bg-hl-command",
  prayer: "bg-hl-prayer",
  insight: "bg-hl-insight",
  question: "bg-hl-question",
};

export interface VerseDecor {
  highlightOf: (verse: ChapterVerse) => HighlightColor | undefined;
  hasNote: (verse: ChapterVerse) => boolean;
  selection: VerseRange | null;
  onVerseClick: (verse: ChapterVerse, event: MouseEvent) => void;
}

const isSelected = (verse: ChapterVerse, selection: VerseRange | null) =>
  selection !== null && verse.vid <= selection.end && selection.start <= verse.spanEnd;

function VerseSpan({ verse, decor }: { verse: ChapterVerse; decor: VerseDecor }) {
  const color = decor.highlightOf(verse);
  const selected = isSelected(verse, decor.selection);
  const lines = verse.text.split("\n");
  return (
    <span
      data-vid={verse.vid}
      onClick={(e) => decor.onVerseClick(verse, e)}
      className={cn(
        "cursor-pointer rounded-[3px] px-[1px] transition-colors [box-decoration-break:clone]",
        color && HIGHLIGHT_CLASS[color],
        selected && "underline decoration-primary decoration-2 underline-offset-[5px]",
        !color && !selected && "hover:bg-muted",
      )}
    >
      <sup className="verse-number mr-1 text-muted-foreground">{verse.label}</sup>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {line}
        </Fragment>
      ))}
      {decor.hasNote(verse) && (
        <span className="ml-1 inline-block size-1.5 -translate-y-1.5 rounded-full bg-primary align-middle" />
      )}{" "}
    </span>
  );
}

function Heading({ heading }: { heading: ChapterHeading }) {
  if (heading.level === "r") {
    return <p className="-mt-3 mb-3 text-xs italic text-muted-foreground">{heading.text}</p>;
  }
  if (heading.level === "d") {
    return <p className="mb-3 text-[0.92em] italic text-muted-foreground">{heading.text}</p>;
  }
  return (
    <h3 className="mb-2 mt-7 font-sans text-[13px] font-semibold uppercase tracking-wide text-muted-foreground first:mt-0">
      {heading.text}
    </h3>
  );
}

/** One translation as flowing paragraphs and poetry lines, with headings in place. */
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

/** Two translations side by side, one aligned row per verse span. */
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
    <div className="grid grid-cols-2 gap-x-12">
      {rows.map((row) => {
        const before = headings.filter((h) => h.vid === row.start);
        return (
          <Fragment key={row.start}>
            {before.length > 0 && (
              <div className="col-span-2">
                {before.map((h, i) => (
                  <Heading key={i} heading={h} />
                ))}
              </div>
            )}
            {row.cells.map((cell, c) => (
              <p key={c} lang={langs[c]} className="scripture mb-3">
                {cell.length === 0 ? (
                  <span className="text-sm text-muted-foreground">{emptyLabel}</span>
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
