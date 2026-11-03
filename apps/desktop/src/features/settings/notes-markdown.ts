import type { Locale } from "@starter/bible-core/books";
import { dayKeyOf } from "@starter/bible-core/calendar";
import { formatRange } from "@starter/bible-core/range";

import type { Note } from "../../lib/state/study-store";

/**
 * SOURCE OF TRUTH KEYWORDS: notesToMarkdown, export notes, Markdown export, notes file
 * WHAT:  All notes as one Markdown document: a heading per note (its title, or its passages),
 *        then passages, tags, date and the body as written.
 * WHY:   Notes are the reader's own writing and should open in any editor. Bodies are already
 *        Markdown, so they are copied as they are; [[John 3:16]] links stay readable.
 * WHERE: Settings → Your data → Export notes as Markdown.
 */
export function notesToMarkdown(
  notes: readonly Note[],
  locale: Locale,
  labels: { title: string; passages: string; tags: string; updated: string },
): string {
  const lines = [`# ${labels.title}`, ""];
  for (const note of notes.toSorted((a, b) => b.updatedAt - a.updatedAt)) {
    const passages = note.anchors.map((a) => formatRange(a, locale)).join(", ");
    lines.push(`## ${note.title.trim() || passages || "—"}`, "");
    if (passages) lines.push(`- **${labels.passages}:** ${passages}`);
    if (note.tags.length > 0) lines.push(`- **${labels.tags}:** ${note.tags.map((tag) => `#${tag}`).join(" ")}`);
    lines.push(`- **${labels.updated}:** ${dayKeyOf(new Date(note.updatedAt))}`, "");
    lines.push(note.body.trim(), "", "---", "");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}
