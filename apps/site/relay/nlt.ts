import { BOOKS, bookByCode } from "@starter/bible-core/books";
import { MAX_VERSE } from "@starter/bible-core/reference";
import { makeVerseId } from "@starter/bible-core/verse-id";
import { ONLINE_LIMITS, type RelayPassage, type RelaySearch } from "@starter/bible-data/online";

import { decodeEntities, tokenizeHtml } from "./html";
import { createPassageBuilder } from "./passage";
import type { PassageRequest } from "./types";
import { classStartsWith, hasClass, walkPassage } from "./walk";

const API = "https://api.nlt.to/api";

/**
 * SOURCE OF TRUTH KEYWORDS: nltPassageUrl, nltSearchUrl, NLT API, api.nlt.to, NLT key query parameter
 * WHAT:  The two NLT API calls the relay may make: passages (HTML) and search (HTML).
 * WHY:   The NLT API takes its key as a query parameter, so these URLs are secret and are
 *        never logged. Its reference parser accepts our catalogue's English book names
 *        (checked for all 66 books against /api/parse on 2026-11-05).
 * WHERE: relay handler.
 */
export function nltPassageUrl(request: PassageRequest, key: string): string {
  const name = bookByCode(request.book)?.en.name ?? request.book;
  const ref =
    request.kind === "verses"
      ? `${name} ${request.chapter}:${request.from}-${request.to}`
      : `${name} ${request.chapter}`;
  return `${API}/passages?${new URLSearchParams({ ref, version: "NLT", key }).toString()}`;
}

export function nltSearchUrl(text: string, key: string): string {
  return `${API}/search?${new URLSearchParams({ text, version: "NLT", type: "keyword", key }).toString()}`;
}

/**
 * SOURCE OF TRUTH KEYWORDS: parseNltPassage, NLT html parser, verse_export, poet1, poet2, NLT footnote
 * WHAT:  Turns the NLT passages HTML into verses (by canonical VerseId), styles and headings.
 * WHY:   Verses start at the printed verse numbers (span.vn), not at the <verse_export ch vn>
 *        wrappers: the NLT often combines verses ("20-21"), and in tables (Numbers 1:5-15) it puts
 *        a whole run of verses inside the last wrapper and leaves the others empty. The wrappers
 *        only tell which chapter the text belongs to. Verses the NLT moves to a footnote
 *        (Matthew 17:21) have no number and are left out. Footnotes (a.a-tn, span.tn) are dropped,
 *        and the reader draws its own verse numbers; table rows become lines.
 * WHERE: relay handler.
 */
export function parseNltPassage(
  html: string,
  request: PassageRequest,
  range: { start: number; end: number },
): Omit<RelayPassage, "translation"> {
  const ord = bookByCode(request.book)?.ord ?? 0;
  const builder = createPassageBuilder(range);
  // The verse number moves into an attribute, so the tag alone says which verses start here;
  // a space after each table cell keeps "Reuben" and "Elizur" apart.
  const marked = html
    .replace(/<span class="vn">\s*([^<]*?)\s*<\/span>/g, (_, n: string) => `<span class="vn" data-vn="${n}"></span>`)
    .replace(/<\/(td|th)>/g, "</$1> ");
  walkPassage(tokenizeHtml(marked), builder, (tag) => {
    if (tag.tag === "verse_export") {
      // Only the chapter asked for; anything else is skipped whole.
      return Number(tag.attrs.ch) === request.chapter ? { kind: "none" } : { kind: "skip" };
    }
    if (tag.tag === "span" && hasClass(tag, "vn")) {
      // "5", "20-21", or "4:1" for a first verse printed before the chapter heading (1 Samuel 4).
      const match = /^(?:(\d+):)?(\d+)(?:[-–](\d+))?$/.exec(tag.attrs["data-vn"] ?? "");
      const chapter = Number(match?.[1] ?? request.chapter);
      const first = Number(match?.[2]);
      const last = Number(match?.[3] ?? match?.[2]);
      if (!match || chapter !== request.chapter || first < 1 || last < first || last > MAX_VERSE) {
        return { kind: "skip" };
      }
      return {
        kind: "verse",
        vid: makeVerseId(ord, request.chapter, first),
        spanEnd: makeVerseId(ord, request.chapter, last),
        skipContent: true,
      };
    }
    if (tag.tag === "head" || tag.tag === "title" || tag.tag === "h1" || tag.tag === "h2") return { kind: "skip" };
    if (hasClass(tag, "a-tn") || hasClass(tag, "tn") || hasClass(tag, "chapter-number")) return { kind: "skip" };
    if (tag.tag === "tr") return { kind: "block", style: "q1" };
    if (tag.tag === "h3" || tag.tag === "h4") return { kind: "heading", level: hasClass(tag, "subhead") ? "s" : "d" };
    if (tag.tag === "p" && hasClass(tag, "psa-title")) return { kind: "heading", level: "d" };
    // Psalm 119's Hebrew letter stanzas ("Aleph", "Beth"…); the bundled BSB stores these as section headings too.
    if (tag.tag === "h5" && hasClass(tag, "psa-hebrew")) return { kind: "heading", level: "s" };
    if (tag.tag === "p") {
      if (classStartsWith(tag, "poet2")) return { kind: "block", style: "q2" };
      if (classStartsWith(tag, "poet")) return { kind: "block", style: "q1" };
      return { kind: "block", style: "p" };
    }
    return { kind: "none" };
  });
  return builder.finish();
}

// Book abbreviations in NLT search links ("2Sam.14.14", "Pr.3.5"), mapped to our codes.
const NLT_ABBREVIATIONS: Readonly<Record<string, string>> = {
  gen: "GEN",
  exod: "EXO",
  lev: "LEV",
  num: "NUM",
  deut: "DEU",
  josh: "JOS",
  judg: "JDG",
  ruth: "RUT",
  "1sam": "1SA",
  "2sam": "2SA",
  "1kgs": "1KI",
  "2kgs": "2KI",
  "1chr": "1CH",
  "2chr": "2CH",
  ezra: "EZR",
  neh: "NEH",
  esth: "EST",
  job: "JOB",
  ps: "PSA",
  pr: "PRO",
  prov: "PRO",
  eccl: "ECC",
  song: "SNG",
  isa: "ISA",
  jer: "JER",
  lam: "LAM",
  ezek: "EZK",
  dan: "DAN",
  hos: "HOS",
  joel: "JOL",
  amos: "AMO",
  obad: "OBA",
  jonah: "JON",
  mic: "MIC",
  nah: "NAM",
  hab: "HAB",
  zeph: "ZEP",
  hag: "HAG",
  zech: "ZEC",
  mal: "MAL",
  matt: "MAT",
  mark: "MRK",
  luke: "LUK",
  john: "JHN",
  acts: "ACT",
  rom: "ROM",
  "1cor": "1CO",
  "2cor": "2CO",
  gal: "GAL",
  eph: "EPH",
  phil: "PHP",
  col: "COL",
  "1thess": "1TH",
  "2thess": "2TH",
  "1tim": "1TI",
  "2tim": "2TI",
  titus: "TIT",
  phlm: "PHM",
  heb: "HEB",
  jas: "JAS",
  "1pet": "1PE",
  "2pet": "2PE",
  "1john": "1JN",
  "2john": "2JN",
  "3john": "3JN",
  jude: "JUD",
  rev: "REV",
};

/** "2Sam.14.14" → its VerseId; unknown abbreviations fall back to the catalogue's aliases. */
export function nltReferenceToVerseId(ref: string): number | undefined {
  const match = /^([1-3]?[A-Za-z]+)\.(\d+)\.(\d+)$/.exec(ref.trim());
  if (!match?.[1]) return undefined;
  const abbreviation = match[1].toLowerCase();
  const code =
    NLT_ABBREVIATIONS[abbreviation] ??
    BOOKS.find(
      (b) => b.en.aliases.includes(abbreviation) || b.en.name.replace(/\s/g, "").toLowerCase() === abbreviation,
    )?.code;
  const book = code ? bookByCode(code) : undefined;
  const chapter = Number(match[2]);
  const verse = Number(match[3]);
  if (!book || chapter < 1 || chapter > book.chapters || verse < 1) return undefined;
  return makeVerseId(book.ord, chapter, verse);
}

const stripTags = (html: string) =>
  decodeEntities(html.replace(/<[^>]*>/g, ""))
    .replace(/[\s ]+/g, " ")
    .trim();

/**
 * SOURCE OF TRUTH KEYWORDS: parseNltSearch, NLT search results, result rows, NLT search count
 * WHAT:  Reads the NLT search HTML: one table row per verse (a link named "Book.ch.vs" and the
 *        verse text with highlight spans), plus the "N result(s)" count.
 * WHERE: relay handler.
 */
export function parseNltSearch(html: string): Omit<RelaySearch, "translation"> {
  const results: RelaySearch["results"] = [];
  for (const row of html.matchAll(/<tr>\s*<td>\s*<a [^>]*>([^<]+)<\/a>\s*<\/td>\s*<td>([\s\S]*?)<\/td>\s*<\/tr>/g)) {
    const vid = nltReferenceToVerseId(row[1] ?? "");
    const text = stripTags(row[2] ?? "");
    if (vid !== undefined && text) results.push({ vid, text });
  }
  const count = /(\d[\d,]*)\s*result\(s\)/.exec(html)?.[1];
  const total = count ? Number(count.replace(/,/g, "")) : results.length;
  return { total: Math.max(total, results.length), results: results.slice(0, ONLINE_LIMITS.searchResults) };
}
