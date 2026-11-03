import { BOOKS, bookByCode, type BookInfo } from "./books";
import { foldEthiopic, hasEthiopic, normalizeForSearch } from "./normalize";
import type { VerseRange } from "./range";
import type { VerseId } from "./verse-id";

/**
 * SOURCE OF TRUTH KEYWORDS: parseSearchQuery, SearchQuery, SearchTerm, MatchMode, phrase search, excluded words, whole word
 * WHAT:  Reads a Bible search box: plain words (all must appear), "quoted phrases" (« » and “ ” too),
 *        and -excluded words or -"phrases". Every term is put through normalizeForSearch, the same
 *        folding that built each translation's text_norm column.
 * WHY:   Search has no index: it scans the normalized copy of each verse. Parsing once into
 *        normalized terms keeps the database filter, the precise matcher and the highlighter in
 *        agreement, in English and Amharic alike.
 * WHERE: desktop BibleSource.search (Tauri store and browser preview), search page.
 */
export type MatchMode = "partial" | "whole";

export interface SearchTerm {
  /** Normalized text. A phrase keeps single spaces between its words. */
  norm: string;
  phrase: boolean;
  /**
   * Ethiopic terms match inside a word in partial mode, because Amharic attaches prepositions
   * and articles to the word (በፍቅር "in love", የእግዚአብሔር "of God"). Latin terms match a word start.
   */
  ethiopic: boolean;
}

export interface SearchQuery {
  include: SearchTerm[];
  exclude: SearchTerm[];
}

const QUOTE = /["“”„«»‹›]/u;
// Outside quotes, whitespace and Ethiopic word separators (፡ ። ፣ ፤ ፥ ፦ ፧ ፨) end a word.
const BREAK = /[\s፡-፨]/u;
const MINUS = /[-−–]/u;

function toTerm(raw: string, quoted: boolean): SearchTerm | undefined {
  const norm = normalizeForSearch(raw);
  if (!norm) return undefined;
  return { norm, phrase: quoted || norm.includes(" "), ethiopic: hasEthiopic(norm) };
}

export function parseSearchQuery(input: string): SearchQuery {
  const include: SearchTerm[] = [];
  const exclude: SearchTerm[] = [];
  const chars = [...input];
  let i = 0;
  while (i < chars.length) {
    const ch = chars[i] ?? "";
    if (BREAK.test(ch)) {
      i++;
      continue;
    }
    let negate = false;
    if (MINUS.test(ch) && i + 1 < chars.length && !BREAK.test(chars[i + 1] ?? " ")) {
      negate = true;
      i++;
    }
    let raw = "";
    let quoted = false;
    if (QUOTE.test(chars[i] ?? "")) {
      quoted = true;
      i++;
      while (i < chars.length && !QUOTE.test(chars[i] ?? "")) raw += chars[i++];
      i++; // closing quote (or end of input)
    } else {
      while (i < chars.length && !BREAK.test(chars[i] ?? " ")) raw += chars[i++];
    }
    const term = toTerm(raw, quoted);
    if (!term) continue;
    const list = negate ? exclude : include;
    if (!list.some((t) => t.norm === term.norm && t.phrase === term.phrase)) list.push(term);
  }
  return { include, exclude };
}

/** Writes a query back as text a user could type, e.g. after a spelling suggestion. */
const showTerm = (t: SearchTerm) => (t.phrase ? `"${t.norm}"` : t.norm);

export function formatSearchQuery(query: SearchQuery): string {
  return [...query.include.map(showTerm), ...query.exclude.map((t) => `-${showTerm(t)}`)].join(" ");
}

/** [start, end) in UTF-16 code units. */
export type Span = readonly [start: number, end: number];

const SPACE = 32;
const atWordStart = (norm: string, at: number) => at === 0 || norm.charCodeAt(at - 1) === SPACE;
const atWordEnd = (norm: string, end: number) => end === norm.length || norm.charCodeAt(end) === SPACE;

/**
 * SOURCE OF TRUTH KEYWORDS: findTerm, matchesQuery, matchSpans, verse matcher, text_norm scan, prefix match
 * WHAT:  Finds a term in a verse's normalized text. Whole-word mode needs word boundaries on both
 *        sides. Partial mode needs a word start for Latin terms ("love" finds "loved", not
 *        "beloved") and matches anywhere for Ethiopic terms.
 * WHY:   The SQL LIKE filter only narrows candidates; this is the one precise rule, so the
 *        app and the browser preview return the same verses.
 * WHERE: tallyVerse, highlightMatches, suggestQuery.
 */
export function findTerm(norm: string, term: SearchTerm, mode: MatchMode, first = false): Span[] {
  const spans: Span[] = [];
  const anywhere = mode === "partial" && term.ethiopic;
  let from = 0;
  for (;;) {
    const at = norm.indexOf(term.norm, from);
    if (at < 0) break;
    const end = at + term.norm.length;
    if ((anywhere || atWordStart(norm, at)) && (mode === "partial" || atWordEnd(norm, end))) {
      spans.push([at, end]);
      if (first) break;
    }
    from = at + 1;
  }
  return spans;
}

export function matchesQuery(norm: string, query: SearchQuery, mode: MatchMode): boolean {
  if (query.include.length === 0) return false;
  for (const term of query.include) if (findTerm(norm, term, mode, true).length === 0) return false;
  for (const term of query.exclude) if (findTerm(norm, term, mode, true).length > 0) return false;
  return true;
}

/** Every included term's spans in normalized text, widened to whole words, sorted and merged. */
export function matchSpans(norm: string, query: SearchQuery, mode: MatchMode): Span[] {
  const spans: Span[] = [];
  for (const term of query.include) {
    for (const [a, b] of findTerm(norm, term, mode)) {
      const start = norm.lastIndexOf(" ", a - 1) + 1;
      const space = norm.indexOf(" ", Math.max(b - 1, a));
      spans.push([start, space < 0 ? norm.length : space]);
    }
  }
  return mergeSpans(spans);
}

function mergeSpans(spans: Span[]): Span[] {
  const sorted = spans.toSorted((x, y) => x[0] - y[0] || x[1] - y[1]);
  const out: [number, number][] = [];
  for (const [a, b] of sorted) {
    const last = out.at(-1);
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

const LETTER_OR_NUMBER = /^[\p{L}\p{N}]$/u;
const MARK = /^\p{M}$/u;

/**
 * SOURCE OF TRUTH KEYWORDS: normalizeWithMap, highlightMatches, snippet highlight, search highlight, offsets
 * WHAT:  normalizeForSearch with a map from each normalized position back to the original text,
 *        and the highlighter built on it: spans in the ORIGINAL verse text to mark.
 * WHY:   Folding changes lengths (é → e, ፡ → space, dropped punctuation), so normalized offsets
 *        cannot be used on displayed scripture. The map lets the page mark the real letters
 *        while the text itself is shown unchanged. If the map ever disagrees with
 *        normalizeForSearch, nothing is highlighted rather than the wrong letters.
 * WHERE: BibleSource.search results, search page snippets.
 */
export function normalizeWithMap(text: string): { norm: string; from: number[]; to: number[] } {
  let norm = "";
  const from: number[] = [];
  const to: number[] = [];
  let gap = false;
  let i = 0;
  for (const ch of text) {
    const end = i + ch.length;
    const piece = foldEthiopic(ch.normalize("NFKD"))
      .replace(/\p{M}+/gu, "")
      .toLowerCase();
    for (const unit of piece) {
      if (!LETTER_OR_NUMBER.test(unit)) {
        gap = true;
        continue;
      }
      if (gap && norm.length > 0) {
        norm += " ";
        from.push(i);
        to.push(i);
      }
      gap = false;
      norm += unit;
      for (let k = 0; k < unit.length; k++) {
        from.push(i);
        to.push(end);
      }
    }
    i = end;
  }
  return { norm, from, to };
}

export function highlightMatches(text: string, query: SearchQuery, mode: MatchMode): Span[] {
  const map = normalizeWithMap(text);
  if (map.norm !== normalizeForSearch(text)) return [];
  return matchSpans(map.norm, query, mode).flatMap(([a, b]) => {
    const start = map.from[a];
    let end = map.to[b - 1];
    if (start === undefined || end === undefined) return [];
    // Keep combining marks that follow the last letter inside the highlight.
    while (end < text.length && MARK.test(text[end] ?? "")) end++;
    return [[start, end] as const];
  });
}

/** Splits text into plain and highlighted pieces for rendering. */
export function splitBySpans(text: string, spans: readonly Span[]): { text: string; hit: boolean }[] {
  const parts: { text: string; hit: boolean }[] = [];
  let at = 0;
  for (const [a, b] of spans) {
    if (a > at) parts.push({ text: text.slice(at, a), hit: false });
    parts.push({ text: text.slice(a, b), hit: true });
    at = b;
  }
  if (at < text.length) parts.push({ text: text.slice(at), hit: false });
  return parts;
}

/**
 * SOURCE OF TRUTH KEYWORDS: SearchScope, scopeBooks, scopeRange, parseScope, whole Bible, Old Testament, New Testament
 * WHAT:  Where to search: "all", "OT", "NT", or one book by USFM code, as books and a verse-id range.
 * WHY:   Canonical verse ids put every scope in one contiguous range, so the database filter is a
 *        single BETWEEN and the preview loads only the books it needs.
 * WHERE: BibleSource.search, search page scope chips.
 */
/** "all", "OT", "NT" or a USFM book code such as "JHN"; parseScope turns anything else into "all". */
export type SearchScope = string;

export function parseScope(value: string | undefined): SearchScope {
  if (value === "OT" || value === "NT") return value;
  const book = value ? bookByCode(value) : undefined;
  return book ? book.code : "all";
}

export function scopeBooks(scope: SearchScope): BookInfo[] {
  if (scope === "all") return [...BOOKS];
  if (scope === "OT" || scope === "NT") return BOOKS.filter((b) => b.testament === scope);
  const book = bookByCode(scope);
  return book ? [book] : [...BOOKS];
}

export function scopeRange(scope: SearchScope): VerseRange {
  const books = scopeBooks(scope);
  const first = books[0]?.ord ?? 1;
  const last = books.at(-1)?.ord ?? first;
  return { start: first * 1_000_000, end: last * 1_000_000 + 999_999 };
}

/** One SQL LIKE pattern per included term (ESCAPE '\'), for narrowing candidates before matchesQuery. */
export function likePatterns(query: SearchQuery): string[] {
  return query.include.map((t) => `%${t.norm.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
}

/**
 * SOURCE OF TRUTH KEYWORDS: SearchTally, createTally, tallyVerse, result count, matches per book, search limit
 * WHAT:  Counts every matching verse (total and per book) while keeping only the first `limit`.
 * WHY:   Both search back ends scan verses in Bible order; sharing the tally keeps their totals,
 *        per-book counts and cut-off identical.
 * WHERE: BibleSource.search in the Tauri store and the browser preview.
 */
export interface SearchTally<V> {
  limit: number;
  total: number;
  perBook: Map<number, number>;
  hits: V[];
}

export function createTally<V>(limit: number): SearchTally<V> {
  return { limit, total: 0, perBook: new Map(), hits: [] };
}

export function tallyVerse<V extends { vid: VerseId }>(
  tally: SearchTally<V>,
  verse: V,
  norm: string,
  query: SearchQuery,
  mode: MatchMode,
): void {
  if (!matchesQuery(norm, query, mode)) return;
  tally.total++;
  const ord = Math.floor(verse.vid / 1_000_000);
  tally.perBook.set(ord, (tally.perBook.get(ord) ?? 0) + 1);
  if (tally.hits.length < tally.limit) tally.hits.push(verse);
}

/** Word → number of verses it appears in, from normalized verse texts. */
export function addToVocabulary(vocabulary: Map<string, number>, norm: string): void {
  for (const word of new Set(norm.split(" "))) {
    if (word) vocabulary.set(word, (vocabulary.get(word) ?? 0) + 1);
  }
}

// Levenshtein by code point that gives up once every path exceeds `max` (vocabularies are ~15k words).
function boundedDistance(a: readonly string[], b: readonly string[], max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_v, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min((prev[j] ?? i) + 1, (row[j - 1] ?? i) + 1, (prev[j - 1] ?? i) + cost);
      row.push(value);
      best = Math.min(best, value);
    }
    if (best > max) return max + 1;
    prev = row;
  }
  return prev[b.length] ?? max + 1;
}

/**
 * SOURCE OF TRUTH KEYWORDS: suggestQuery, spelling suggestion, did you mean, closest word
 * WHAT:  For a query with no results, replaces each single word the translation never uses with
 *        its closest word there (one edit, two for long words; the commoner word wins ties).
 * WHY:   Typos and unfamiliar spellings ("rightousness", "ፍቅረ") should lead somewhere useful.
 *        Homophone spellings never need it: folding already makes ኃጢአት and ሀጢአት equal.
 * WHERE: BibleSource.search when the total is zero.
 */
export function suggestQuery(
  query: SearchQuery,
  vocabulary: ReadonlyMap<string, number>,
  mode: MatchMode,
): string | undefined {
  let changed = false;
  const include = query.include.map((term) => {
    if (term.phrase || [...term.norm].length < 3) return term;
    for (const word of vocabulary.keys()) if (findTerm(word, term, mode, true).length > 0) return term;
    const target = [...term.norm];
    const max = target.length >= 7 ? 2 : 1;
    let best: { word: string; distance: number; count: number } | undefined;
    for (const [word, count] of vocabulary) {
      const distance = boundedDistance(target, [...word], max);
      if (distance > max) continue;
      if (!best || distance < best.distance || (distance === best.distance && count > best.count)) {
        best = { word, distance, count };
      }
    }
    if (!best) return term;
    changed = true;
    return { ...term, norm: best.word };
  });
  return changed ? formatSearchQuery({ include, exclude: query.exclude }) : undefined;
}

export interface SearchOutcome<V> {
  /** The first `limit` matches in Bible order, each with spans to highlight in its text. */
  results: (V & { matches: Span[] })[];
  total: number;
  /** Matches per book (canonical order number), in Bible order. */
  perBook: { ord: number; count: number }[];
  /** A corrected query to offer when nothing matched. */
  suggestion?: string;
}

/**
 * SOURCE OF TRUTH KEYWORDS: finishSearch, SearchOutcome, search response, highlight results
 * WHAT:  Turns a finished tally into the response screens show: highlighted results, per-book
 *        counts, and a spelling suggestion when nothing matched (given the vocabulary).
 * WHY:   Highlighting runs only on the results that are shown, not on every match.
 * WHERE: BibleSource.search in the Tauri store and the browser preview.
 */
export function finishSearch<V extends { vid: VerseId; text: string }>(
  tally: SearchTally<V>,
  query: SearchQuery,
  mode: MatchMode,
  vocabulary?: ReadonlyMap<string, number>,
): SearchOutcome<V> {
  const outcome: SearchOutcome<V> = {
    results: tally.hits.map((v) => ({ ...v, matches: highlightMatches(v.text, query, mode) })),
    total: tally.total,
    perBook: [...tally.perBook].map(([ord, count]) => ({ ord, count })).toSorted((a, b) => a.ord - b.ord),
  };
  const suggestion = tally.total === 0 && vocabulary ? suggestQuery(query, vocabulary, mode) : undefined;
  if (suggestion) outcome.suggestion = suggestion;
  return outcome;
}
