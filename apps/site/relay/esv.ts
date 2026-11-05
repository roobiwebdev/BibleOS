import { bookByCode } from "@starter/bible-core/books";
import { parseReference } from "@starter/bible-core/reference";
import { makeVerseId } from "@starter/bible-core/verse-id";
import { ONLINE_LIMITS, type RelayPassage, type RelaySearch } from "@starter/bible-data/online";
import { z } from "zod";

import { tokenizeHtml } from "./html";
import { createPassageBuilder } from "./passage";
import type { PassageRequest } from "./types";
import { classStartsWith, hasClass, walkPassage } from "./walk";

const API = "https://api.esv.org/v3/passage";

// Crossway's book names, where they differ from our catalogue's English names.
const ESV_NAMES: Readonly<Record<string, string>> = { SNG: "Song of Solomon" };

/**
 * SOURCE OF TRUTH KEYWORDS: esvPassageUrl, esvSearchUrl, ESV API, passage html endpoint, ESV options
 * WHAT:  The two ESV API calls the relay may make: passage HTML for one chapter (or a verse
 *        range inside it) and passage search.
 * WHY:   HTML keeps headings and poetry lines, and its verse markers carry Crossway's ids
 *        (BBCCCVVV), which use the same canonical numbering as our VerseId. Everything the
 *        reader does not show (references, footnotes, audio links, the trailing "(ESV)") is
 *        turned off at the source; the app shows "ESV", the notice and the esv.org link itself.
 * WHERE: relay handler.
 */
export function esvPassageUrl(request: PassageRequest): string {
  const book = bookByCode(request.book);
  const name = ESV_NAMES[request.book] ?? book?.en.name ?? request.book;
  // In one-chapter books (OBA, PHM, 2JN, 3JN, JUD) Crossway reads "3 John 1" as verse 1, so
  // ask for the whole book; verse ranges stay explicit ("3 John 1:1-4" works as expected).
  const q =
    request.kind === "verses"
      ? `${name} ${request.chapter}:${request.from}-${request.to}`
      : book?.chapters === 1
        ? name
        : `${name} ${request.chapter}`;
  const params = new URLSearchParams({
    q,
    "include-passage-references": "false",
    "include-verse-numbers": "true",
    "include-first-verse-numbers": "true",
    "include-footnotes": "false",
    "include-footnote-body": "false",
    "include-headings": "true",
    "include-subheadings": "true",
    "include-short-copyright": "false",
    "include-copyright": "false",
    "include-audio-link": "false",
    "include-chapter-numbers": "true",
    "include-book-titles": "false",
    "include-crossrefs": "false",
    "include-surrounding-chapters": "false",
    "include-surrounding-chapters-below": "false",
    "include-css-link": "false",
    "inline-styles": "false",
    "wrapping-div": "false",
    "include-verse-anchors": "false",
  });
  return `${API}/html/?${params.toString()}`;
}

export function esvSearchUrl(q: string): string {
  const params = new URLSearchParams({ q, "page-size": String(ONLINE_LIMITS.searchResults), page: "1" });
  return `${API}/search/?${params.toString()}`;
}

export const esvHeaders = (key: string): Record<string, string> => ({ Authorization: `Token ${key}` });

const passageResponse = z.object({ passages: z.array(z.string()) });
const searchResponse = z.object({
  total_results: z.number().int().min(0),
  results: z.array(z.object({ reference: z.string(), content: z.string() })),
});

/** Crossway's ids are "v" + BBCCCVVV (+ "-n"), e.g. "v43003016-1". */
const verseIdOf = (id: string | undefined): number | undefined => {
  const match = id ? /^v(\d{7,8})(?:-\d+)?$/.exec(id) : null;
  return match?.[1] ? Number(match[1]) : undefined;
};

/**
 * SOURCE OF TRUTH KEYWORDS: parseEsvPassage, ESV html parser, verse-num, chapter-num, ESV poetry line
 * WHAT:  Turns the ESV passage HTML into verses (by canonical VerseId), styles and headings.
 * WHY:   Verses the ESV omits (it moves Matthew 17:21 to a footnote) never get a marker, so
 *        they are simply absent; bracketed passages keep their brackets as text.
 * WHERE: relay handler.
 */
export function parseEsvPassage(
  json: unknown,
  range: { start: number; end: number },
): Omit<RelayPassage, "translation"> {
  const { passages } = passageResponse.parse(json);
  const builder = createPassageBuilder(range);
  for (const html of passages) {
    // The short "(ESV)" line, if the API adds it anyway; the app shows "ESV" itself.
    const text = html.replace(/<p>\s*\(\s*<a [^>]*class="copyright"[^>]*>[^<]*<\/a>\s*\)\s*<\/p>/g, "");
    walkPassage(tokenizeHtml(text), builder, (tag) => {
      if (tag.tag === "b" && (hasClass(tag, "verse-num") || hasClass(tag, "chapter-num"))) {
        const vid = verseIdOf(tag.attrs.id);
        return vid === undefined ? { kind: "skip" } : { kind: "verse", vid, skipContent: true };
      }
      if (tag.tag === "h2" || tag.tag === "sup" || tag.tag === "small" || hasClass(tag, "footnotes")) {
        return { kind: "skip" };
      }
      if (hasClass(tag, "extra_text")) return { kind: "skip" };
      if (tag.tag === "h3") return { kind: "heading", level: "s" };
      if (tag.tag === "h4" || tag.tag === "h5") return { kind: "heading", level: "d" };
      if (tag.tag === "span" && hasClass(tag, "line")) {
        return { kind: "block", style: classStartsWith(tag, "indent") ? "q2" : "q1" };
      }
      if (tag.tag === "p") return { kind: "block", style: "p" };
      return { kind: "none" };
    });
  }
  return builder.finish();
}

export function parseEsvSearch(json: unknown): Omit<RelaySearch, "translation"> {
  const { total_results, results } = searchResponse.parse(json);
  const hits = results.flatMap((r) => {
    const ref = parseReference(r.reference);
    const text = r.content.replace(/\s+/g, " ").trim();
    if (!ref || ref.verse === undefined || !text) return [];
    return [{ vid: makeVerseId(ref.book.ord, ref.chapter, ref.verse), text }];
  });
  return { total: total_results, results: hits.slice(0, ONLINE_LIMITS.searchResults) };
}
