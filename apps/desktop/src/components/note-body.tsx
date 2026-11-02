import { makeVerseId } from "@starter/bible-core/verse-id";
import { formatReference, parseReference } from "@starter/bible-core/reference";
import { Link } from "@tanstack/react-router";
import { Fragment } from "react";

import { usePreferences } from "../lib/state/preferences";

/**
 * SOURCE OF TRUTH KEYWORDS: NoteBody, note links, [[reference]] links, wiki links, note rendering
 * WHAT:  Renders note text, turning [[John 3:16]] or [[ዮሐ 3፥16]] into links that open the reader.
 * WHY:   Notes become a web of passages. Unreadable references stay as plain text, never lost.
 * WHERE: reader notes rail, Study notes list and note detail, Today recent notes.
 */
export function NoteBody({ body, clamp }: { body: string; clamp?: boolean }) {
  const { prefs } = usePreferences();
  const parts = body.split(/(\[\[[^\]]+\]\])/g);
  return (
    <p className={clamp ? "line-clamp-3" : "whitespace-pre-wrap"}>
      {parts.map((part, i) => {
        const match = /^\[\[([^\]]+)\]\]$/.exec(part);
        const ref = match?.[1] ? parseReference(match[1]) : undefined;
        if (!ref) return <Fragment key={i}>{part}</Fragment>;
        return (
          <Link
            key={i}
            to="/read"
            search={{ c: makeVerseId(ref.book.ord, ref.chapter), v: ref.verse }}
            className="rounded bg-accent px-1 py-px font-medium text-accent-foreground decoration-1 hover:underline"
          >
            {formatReference(ref, prefs.locale)}
          </Link>
        );
      })}
    </p>
  );
}

/** Every reference mentioned in a note body, for "Linked passages" and backlinks. */
export function linkedReferences(body: string) {
  return [...body.matchAll(/\[\[([^\]]+)\]\]/g)]
    .map((m) => (m[1] ? parseReference(m[1]) : undefined))
    .filter((r) => r !== undefined);
}
