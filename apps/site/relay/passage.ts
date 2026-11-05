import type { RelayPassage } from "@starter/bible-data/online";

type Verse = RelayPassage["verses"][number];
type Heading = RelayPassage["headings"][number];
type Style = Verse["style"];

/**
 * SOURCE OF TRUTH KEYWORDS: createPassageBuilder, PassageBuilder, verse accumulator, poetry lines, omitted verse
 * WHAT:  Collects verses, paragraph styles and headings while a publisher's HTML is walked, and
 *        returns them in the reader's shape (one entry per canonical VerseId).
 * WHY:   Both publisher parsers only need to say "a verse starts", "a block starts", "a heading"
 *        and "text"; how those become styles and line breaks is decided once, here, the same way
 *        the bundled build does: a verse's style comes from the block it starts in, poetry lines
 *        inside a verse are joined with "\n". A verse with no text (the NLT's empty Matthew
 *        17:21, which it moves to a footnote) is left out, so the reader shows the gap.
 * WHERE: relay/esv.ts, relay/nlt.ts.
 */
export function createPassageBuilder(range: { start: number; end: number }) {
  const verses: { vid: number; style: Style; text: string; started: boolean }[] = [];
  const headings: Heading[] = [];
  let pendingBlock: Style | null = null;
  let waiting: Omit<Heading, "vid">[] = [];

  const current = () => verses.at(-1);
  const inRange = (vid: number) => vid >= range.start && vid <= range.end;

  return {
    startVerse(vid: number) {
      const existing = verses.find((v) => v.vid === vid);
      if (existing) {
        // A verse split by a heading continues where it stopped.
        verses.splice(verses.indexOf(existing), 1);
        verses.push(existing);
      } else verses.push({ vid, style: "c", text: "", started: false });
      for (const heading of waiting) headings.push({ ...heading, vid });
      waiting = [];
    },
    startBlock(style: Style) {
      pendingBlock = style;
    },
    addHeading(level: Heading["level"], raw: string) {
      const text = raw.replace(/[\s ]+/g, " ").trim();
      if (!text) return;
      const verse = current();
      // A heading before a verse's first words belongs to that verse; otherwise to the next one.
      if (verse && !verse.started) headings.push({ vid: verse.vid, level, text });
      else waiting.push({ level, text });
    },
    addText(raw: string) {
      const verse = current();
      if (!verse) return;
      const text = raw.replace(/[\s ]+/g, " ");
      if (text.trim() === "") {
        if (verse.started && pendingBlock === null) verse.text += " ";
        return;
      }
      if (!verse.started) {
        verse.style = pendingBlock ?? "c";
        verse.started = true;
      } else if (pendingBlock !== null) {
        verse.text += pendingBlock === "q1" || pendingBlock === "q2" ? "\n" : " ";
      }
      pendingBlock = null;
      verse.text += text;
    },
    finish(): Pick<RelayPassage, "verses" | "headings"> {
      const out: Verse[] = verses
        .map((v) => ({
          vid: v.vid,
          style: v.style,
          text: v.text
            .split("\n")
            .map((line) => line.replace(/ +/g, " ").trim())
            .filter((line) => line.length > 0)
            .join("\n"),
        }))
        .filter((v) => v.text.length > 0 && inRange(v.vid))
        .toSorted((a, b) => a.vid - b.vid);
      // A heading on a left-out verse moves to the next verse that has text.
      const moved = headings.flatMap((h) => {
        const next = inRange(h.vid) ? out.find((v) => v.vid >= h.vid) : undefined;
        return next ? [{ ...h, vid: next.vid }] : [];
      });
      return { verses: out, headings: moved };
    },
  };
}

export type PassageBuilder = ReturnType<typeof createPassageBuilder>;
