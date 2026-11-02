import { parseReference, referenceRange } from "@starter/bible-core/reference";
import type { VerseRange } from "@starter/bible-core/range";

/**
 * SOURCE OF TRUTH KEYWORDS: parseNoteLinks, NoteLinkTarget, [[links]], wiki links, verse links, note backlinks
 * WHAT:  Finds `[[…]]` links in a note body. Text containing a digit that parses as a Bible
 *        reference ("[[Romans 5:8]]", "[[ዮሐ 10፥11]]") becomes a verse-range link; anything else
 *        is a link to another note by title.
 * WHY:   The reference parser is forgiving (it fixes typos in book names), so requiring a digit
 *        stops a title like "[[Love goes first]]" from being read as a book. Duplicates collapse.
 * WHERE: notes.save (derives note_links rows).
 */
export type NoteLinkTarget =
  | { label: string; kind: "verse"; range: VerseRange }
  | { label: string; kind: "note"; title: string };

const LINK = /\[\[([^[\]\n]{1,200})\]\]/gu;

export function parseNoteLinks(body: string): NoteLinkTarget[] {
  const seen = new Set<string>();
  const links: NoteLinkTarget[] = [];
  for (const match of body.matchAll(LINK)) {
    const label = (match[1] ?? "").trim();
    if (!label || seen.has(label)) continue;
    seen.add(label);
    const ref = /\d/u.test(label) ? parseReference(label) : undefined;
    links.push(ref ? { label, kind: "verse", range: referenceRange(ref) } : { label, kind: "note", title: label });
  }
  return links;
}
