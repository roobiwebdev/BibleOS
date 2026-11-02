import type { VerseId } from "./verse-id";

/**
 * SOURCE OF TRUTH KEYWORDS: alignParallel, ParallelRow, parallel view, merged verses, verse spans, compare translations
 * WHAT:  Lines up the verses of several translations into rows. A row grows until no column
 *        has a verse that overlaps it, so a merged verse ("14-16") sits beside its parts.
 * WHY:   Editions merge and split verses differently (the 1962 Amharic NT prints John 3:14-16
 *        as one verse). Aligning by span keeps the same words side by side.
 * WHERE: desktop parallel reader; later compare view and export.
 */
export interface Spanned {
  vid: VerseId;
  spanEnd: VerseId;
}

export interface ParallelRow<T extends Spanned> {
  start: VerseId;
  end: VerseId;
  /** One list per input column; empty where a translation has nothing for this range. */
  cells: T[][];
}

export function alignParallel<T extends Spanned>(columns: readonly (readonly T[])[]): ParallelRow<T>[] {
  const cursors = columns.map(() => 0);
  const head = (c: number): T | undefined => columns[c]?.[cursors[c] ?? 0];
  const rows: ParallelRow<T>[] = [];

  for (;;) {
    const starts = columns.map((_col, c) => head(c)?.vid).filter((v): v is number => v !== undefined);
    if (starts.length === 0) return rows;
    const start = Math.min(...starts);
    let end = start;
    const cells: T[][] = columns.map(() => []);

    let grew = true;
    while (grew) {
      grew = false;
      columns.forEach((_col, c) => {
        const verse = head(c);
        if (verse && verse.vid <= end) {
          cells[c]?.push(verse);
          cursors[c] = (cursors[c] ?? 0) + 1;
          end = Math.max(end, verse.spanEnd);
          grew = true;
        }
      });
    }
    rows.push({ start, end, cells });
  }
}
