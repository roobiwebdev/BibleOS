import { classesOf, VOID_TAGS, type HtmlToken } from "./html";
import type { PassageBuilder } from "./passage";

type Open = Extract<HtmlToken, { kind: "open" }>;

/**
 * SOURCE OF TRUTH KEYWORDS: walkPassage, PassageRules, skip element, heading element, block element, verse marker
 * WHAT:  Walks a token stream and feeds a PassageBuilder, asking a publisher's rules what each
 *        open tag means: a verse marker, a block (paragraph or poetry line), a heading, an
 *        element to skip with everything inside it (footnotes, verse numbers), or nothing.
 * WHY:   The ESV and NLT differ only in which tags mean what; skipping nested content and
 *        collecting heading text is the same for both and easy to get wrong twice.
 * WHERE: relay/esv.ts, relay/nlt.ts.
 */
export type TagMeaning =
  | { kind: "verse"; vid: number; spanEnd?: number; skipContent: boolean }
  | { kind: "block"; style: "p" | "q1" | "q2" }
  | { kind: "heading"; level: "s" | "ms" | "d" | "r" }
  | { kind: "skip" }
  | { kind: "none" };

export function walkPassage(tokens: readonly HtmlToken[], builder: PassageBuilder, meaning: (tag: Open) => TagMeaning) {
  let skip: { tag: string; depth: number } | null = null;
  let heading: { tag: string; depth: number; level: "s" | "ms" | "d" | "r"; text: string } | null = null;

  const endHeading = () => {
    if (heading) builder.addHeading(heading.level, heading.text);
    heading = null;
  };

  for (const token of tokens) {
    if (skip) {
      if (token.kind === "open" && token.tag === skip.tag && !token.selfClosing) skip.depth++;
      if (token.kind === "close" && token.tag === skip.tag && --skip.depth === 0) skip = null;
      continue;
    }
    if (token.kind === "text") {
      if (heading) heading.text += token.text;
      else builder.addText(token.text);
      continue;
    }
    if (token.kind === "close") {
      if (heading && token.tag === heading.tag && --heading.depth === 0) endHeading();
      continue;
    }
    const isVoid = token.selfClosing || VOID_TAGS.has(token.tag);
    if (heading) {
      // The NLT does not always close its <p>: a new <p> ends a paragraph-style heading.
      const endsHeading = token.tag === heading.tag && token.tag === "p";
      if (token.tag === heading.tag && !isVoid && !endsHeading) heading.depth++;
      if (!endsHeading) continue;
      endHeading();
    }
    const what = meaning(token);
    switch (what.kind) {
      case "verse":
        builder.startVerse(what.vid, what.spanEnd);
        if (what.skipContent && !isVoid) skip = { tag: token.tag, depth: 1 };
        break;
      case "block":
        builder.startBlock(what.style);
        break;
      case "heading":
        if (isVoid) break;
        heading = { tag: token.tag, depth: 1, level: what.level, text: "" };
        break;
      case "skip":
        if (!isVoid) skip = { tag: token.tag, depth: 1 };
        break;
      case "none":
        break;
    }
  }
  endHeading();
}

export const hasClass = (tag: Open, name: string): boolean => classesOf(tag.attrs).includes(name);
export const classStartsWith = (tag: Open, prefix: string): boolean =>
  classesOf(tag.attrs).some((c) => c.startsWith(prefix));
