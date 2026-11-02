import type { HeadingLevel, VerseStyle } from "./schema";

/**
 * SOURCE OF TRUTH KEYWORDS: parseUsfm, UsfmBook, UsfmVerse, UsfmHeading, USFM parser, scripture import
 * WHAT:  Reads one USFM book into verses (with merged-verse spans, paragraph and poetry
 *        style) and section headings. Footnotes, cross-references, figures and word-level
 *        attributes such as Strong's numbers are dropped; character styling keeps its text.
 * WHY:   Every bundled source (eBible, Door43) ships USFM, and a later "import your own
 *        translation" feature needs the same reader. The marker sets below cover every marker
 *        found across the five bundled sources; unknown markers are treated as character
 *        styling so their text is never lost.
 * WHERE: build.ts; later, the desktop USFM import.
 */
export interface UsfmVerse {
  chapter: number;
  verse: number;
  /** Last verse covered; equals verse unless merged ("24-26"). */
  verseEnd: number;
  style: VerseStyle;
  /** Plain text; "\n" marks a paragraph or poetry line break inside the verse. */
  text: string;
}

export interface UsfmHeading {
  chapter: number;
  beforeVerse: number;
  level: HeadingLevel;
  text: string;
}

export interface UsfmBook {
  code: string;
  title: { h?: string; toc1?: string; toc2?: string; toc3?: string };
  verses: UsfmVerse[];
  headings: UsfmHeading[];
}

type LineTarget =
  | { kind: "title"; field: "h" | "toc1" | "toc2" | "toc3" }
  | { kind: "heading"; level: HeadingLevel }
  | { kind: "id" }
  | { kind: "skip" };

const HEADINGS: Record<string, HeadingLevel> = {
  s: "s",
  s1: "s",
  s2: "s",
  s3: "s",
  sp: "s",
  qa: "s",
  ms: "ms",
  ms1: "ms",
  ms2: "ms",
  mr: "r",
  r: "r",
  d: "d",
};

const SKIPPED_LINES = new Set([
  "ide",
  "mt",
  "mt1",
  "mt2",
  "mt3",
  "mte",
  "mte1",
  "imt",
  "imt1",
  "is",
  "is1",
  "ip",
  "ipr",
  "ili",
  "ili1",
  "ie",
  "cl",
  "s5",
  "rem",
  "sts",
  "usfm",
  "toca1",
  "toca2",
  "toca3",
]);

const PARAGRAPHS: Record<string, VerseStyle | "continue"> = {
  p: "p",
  m: "p",
  pmo: "p",
  pi: "p",
  pi1: "p",
  pc: "p",
  mi: "p",
  b: "p",
  cls: "p",
  nb: "continue",
  q: "q1",
  q1: "q1",
  qr: "q1",
  qc: "q1",
  qm1: "q1",
  li: "q1",
  li1: "q1",
  q2: "q2",
  q3: "q2",
  qm2: "q2",
  li2: "q2",
};

const NOTES = /\\(f|fe|x|fig|ef|ex)\s[\s\S]*?\\\1\*/g;
// Word-level attributes such as |strong="H0776" sit just before the closing marker.
const ATTRIBUTES = /\|[^\\|]*?(?=\\\+?[a-z]+\d*\*)/g;
// An opening marker consumes the one space after it; a closing marker ("\\add*") does not.
const TOKENS = /\\(\+?)([a-z]+\d*)(?:(\*)|[ \t]?)|([^\\]+)/g;
const NUMBER = /^\s*(\d+)(?:-(\d+))?[a-z]?\s*/;

function tidy(text: string): string {
  return text
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

export function parseUsfm(source: string): UsfmBook {
  const text = source.replace(/\r\n?/g, "\n").replace(NOTES, "").replace(ATTRIBUTES, "");
  const book: UsfmBook = { code: "", title: {}, verses: [], headings: [] };

  let chapter = 0;
  let verse: UsfmVerse | null = null;
  let pendingNumber: "c" | "v" | null = null;
  let pendingStyle: VerseStyle | null = null;
  let pendingHeadings: Array<{ level: HeadingLevel; text: string }> = [];
  let line: { target: LineTarget; buffer: string } | null = null;

  const finishLine = () => {
    if (!line) return;
    const value = tidy(line.buffer.replace(/\n/g, " "));
    const { target } = line;
    line = null;
    if (target.kind === "id") book.code = value.split(" ")[0]?.toUpperCase() ?? "";
    else if (target.kind === "title" && value) book.title[target.field] = value;
    else if (target.kind === "heading" && value) pendingHeadings.push({ level: target.level, text: value });
  };

  const flushVerse = () => {
    if (verse) {
      verse.text = tidy(verse.text);
      // Some editions (KJV) mark paragraphs with a leading pilcrow instead of \p.
      if (verse.text.startsWith("¶")) {
        verse.text = verse.text.slice(1).trimStart();
        if (verse.style === "c") verse.style = "p";
      }
      book.verses.push(verse);
    }
    verse = null;
  };

  const handleText = (raw: string) => {
    let rest = raw;
    if (pendingNumber) {
      const match = NUMBER.exec(rest);
      if (match) {
        const n = Number(match[1]);
        rest = rest.slice(match[0].length);
        if (pendingNumber === "c") {
          flushVerse();
          chapter = n;
          pendingStyle = "p";
        } else {
          flushVerse();
          verse = {
            chapter,
            verse: n,
            verseEnd: match[2] === undefined ? n : Number(match[2]),
            style: pendingStyle ?? "c",
            text: "",
          };
          pendingStyle = null;
          for (const h of pendingHeadings) book.headings.push({ chapter, beforeVerse: n, ...h });
          pendingHeadings = [];
        }
      }
      pendingNumber = null;
    }

    if (line) {
      const newline = rest.indexOf("\n");
      if (newline < 0) {
        line.buffer += rest;
        return;
      }
      line.buffer += rest.slice(0, newline);
      finishLine();
      rest = rest.slice(newline + 1);
    }

    if (verse) {
      // A paragraph marker followed by more of the same verse is a break inside it.
      if (rest.trim() && pendingStyle) {
        if (verse.text.trim()) verse.text += "\n";
        pendingStyle = null;
      }
      // Whitespace-only text still matters: it is the space between word markers.
      verse.text += rest.replace(/\n/g, " ");
    }
  };

  const handleMarker = (name: string, closing: boolean) => {
    if (closing) return;
    const heading = HEADINGS[name];
    const paragraph = PARAGRAPHS[name];
    const isLine =
      name === "id" || name === "h" || name.startsWith("toc") || heading !== undefined || SKIPPED_LINES.has(name);
    const isStructural = isLine || paragraph !== undefined || name === "c" || name === "v";
    if (!isStructural) return; // character styling: keep its text, drop the marker
    finishLine();

    if (name === "c" || name === "v") {
      pendingNumber = name;
    } else if (name === "id") {
      line = { target: { kind: "id" }, buffer: "" };
    } else if (name === "h" || name === "toc1" || name === "toc2" || name === "toc3") {
      line = { target: { kind: "title", field: name }, buffer: "" };
    } else if (heading !== undefined) {
      line = { target: { kind: "heading", level: heading }, buffer: "" };
    } else if (SKIPPED_LINES.has(name) || name.startsWith("toc")) {
      line = { target: { kind: "skip" }, buffer: "" };
    } else if (paragraph !== undefined && paragraph !== "continue") {
      const current: UsfmVerse | null = verse;
      if (current && !current.text.trim()) current.style = paragraph;
      else pendingStyle = paragraph;
    }
  };

  for (const match of text.matchAll(TOKENS)) {
    const [, , name, star, body] = match;
    if (body !== undefined) handleText(body);
    else if (name !== undefined) handleMarker(name, star === "*");
  }
  finishLine();
  flushVerse();
  return book;
}
