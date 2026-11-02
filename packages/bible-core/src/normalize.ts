/**
 * SOURCE OF TRUTH KEYWORDS: normalizeForSearch, foldEthiopic, search normalization, homophones, Ethiopic punctuation
 * WHAT:  Turns text into a lowercase, punctuation-free, single-spaced form for matching.
 *        Ethiopic: word separators (፡ ። ፣ ፤ ፥ ፦ ፧ ፨) become spaces and homophone letter
 *        families are folded (ሐ/ኀ→ሀ, ሠ→ሰ, ዐ→አ, ፀ→ጸ) across all vowel orders, and the
 *        same-sounding 4th orders ሃ/ኣ fold to ሀ/አ.
 * WHY:   Amharic spelling varies between editions and typists (ኃጢአት vs ሀጢአት). Folding only
 *        the search copy finds both without ever altering the displayed scripture, where the
 *        letters can carry meaning (ድህነት "poverty" vs ድኅነት "salvation").
 * WHERE: bible-data build (text_norm column), Bible search, notes search, reference parser.
 */
export function normalizeForSearch(text: string): string {
  return foldEthiopic(text.normalize("NFKD"))
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

// [from block start, to block start]; each family is 8 code points (7 vowel orders + labialized).
const FOLDS: ReadonlyArray<readonly [number, number]> = [
  [0x1210, 0x1200], // ሐ → ሀ
  [0x1280, 0x1200], // ኀ → ሀ
  [0x1220, 0x1230], // ሠ → ሰ
  [0x12d0, 0x12a0], // ዐ → አ
  [0x1340, 0x1338], // ፀ → ጸ
];

// After family folding, 4th-order ሃ and ኣ sound the same as 1st-order ሀ and አ.
const SAME_SOUND = new Map([
  [0x1203, 0x1200], // ሃ → ሀ
  [0x12a3, 0x12a0], // ኣ → አ
]);

export function foldEthiopic(text: string): string {
  let out = "";
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    let mapped = cp;
    for (const [from, to] of FOLDS) {
      if (cp >= from && cp < from + 8) {
        mapped = to + (cp - from);
        break;
      }
    }
    out += String.fromCodePoint(SAME_SOUND.get(mapped) ?? mapped);
  }
  return out;
}

/** True when the text contains Ethiopic script (U+1200–U+139F, U+2D80–U+2DDF, U+AB00–U+AB2F). */
export function hasEthiopic(text: string): boolean {
  return /[ሀ-᎟ⶀ-⷟꬀-꬯]/u.test(text);
}
