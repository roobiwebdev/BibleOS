import { bookByOrd } from "@starter/bible-core/books";
import { formatReference } from "@starter/bible-core/reference";
import { splitVerseId, type VerseId } from "@starter/bible-core/verse-id";
import { Button } from "@starter/ui/components/button";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { NoteBody } from "../../components/note-body";
import { NoteEditor } from "../../components/note-editor";
import { usePreferences, useT } from "../../lib/state/preferences";
import { overlaps, useStudy, type Note, type VerseRange } from "../../lib/state/study-store";

export function rangeLabel(range: VerseRange, locale: "en" | "am"): string {
  const a = splitVerseId(range.start);
  const b = splitVerseId(range.end);
  const book = bookByOrd(a.ord);
  if (!book) return "";
  return formatReference(
    {
      book,
      chapter: a.chapter,
      verse: a.verse || undefined,
      endChapter: b.chapter !== a.chapter ? b.chapter : undefined,
      endVerse: b.verse !== a.verse || b.chapter !== a.chapter ? b.verse : undefined,
    },
    locale,
  );
}

function NoteCard({ note, onEdit }: { note: Note; onEdit: () => void }) {
  const { prefs } = usePreferences();
  const study = useStudy();
  const t = useT();
  return (
    <article className="group rounded-xl border bg-card p-3.5 text-sm shadow-xs">
      <div className="mb-1.5 flex items-start gap-2">
        <h4 className="flex-1 font-semibold leading-snug">
          {note.title || note.anchors.map((a) => rangeLabel(a, prefs.locale)).join(", ")}
        </h4>
        <div className="flex opacity-0 transition-opacity group-hover:opacity-100">
          <Button variant="ghost" size="icon-xs" aria-label={t.notes.edited} onClick={onEdit}>
            <Pencil />
          </Button>
          <Button variant="ghost" size="icon-xs" aria-label={t.notes.delete} onClick={() => study.deleteNote(note.id)}>
            <Trash2 />
          </Button>
        </div>
      </div>
      <div className="leading-relaxed text-foreground/85">
        <NoteBody body={note.body} />
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {note.anchors.map((a) => (
          <span
            key={a.start}
            className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground"
          >
            {rangeLabel(a, prefs.locale)}
          </span>
        ))}
        {note.tags.map((tag) => (
          <span key={tag} className="text-[11px] text-primary">
            #{tag}
          </span>
        ))}
      </div>
    </article>
  );
}

/** Notes for the selected verses, or for the whole chapter when nothing is selected. */
export function NotesRail({
  chapterId,
  selection,
  selectionLabel,
  writing,
  onWritingChange,
}: {
  chapterId: VerseId;
  selection: VerseRange | null;
  selectionLabel: string;
  writing: boolean;
  onWritingChange: (writing: boolean) => void;
}) {
  const t = useT();
  const { prefs } = usePreferences();
  const study = useStudy();
  const [editing, setEditing] = useState<string | null>(null);
  const scope: VerseRange = selection ?? { start: chapterId, end: chapterId + 999 };
  const notes = study.notes.filter((n) => n.anchors.some((a) => overlaps(a, scope)));
  const chapterLabel = rangeLabel({ start: chapterId, end: chapterId }, prefs.locale);

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l bg-sidebar">
      <div data-tauri-drag-region className="flex h-12 shrink-0 items-center justify-between border-b px-4">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold">{t.notes.onThisVerse}</p>
          <p className="truncate text-[11px] text-muted-foreground">{selection ? selectionLabel : chapterLabel}</p>
        </div>
        <Button variant="ghost" size="icon-sm" aria-label={t.verse.addNote} onClick={() => onWritingChange(true)}>
          <Plus />
        </Button>
      </div>
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-3">
        {writing && (
          <NoteEditor
            anchors={[scope]}
            onSave={(note) => {
              study.saveNote(note);
              onWritingChange(false);
            }}
            onCancel={() => onWritingChange(false)}
          />
        )}
        {notes.map((note) =>
          editing === note.id ? (
            <NoteEditor
              key={note.id}
              note={note}
              anchors={note.anchors}
              onSave={(n) => {
                study.saveNote(n);
                setEditing(null);
              }}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <NoteCard key={note.id} note={note} onEdit={() => setEditing(note.id)} />
          ),
        )}
        {!writing && notes.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-sm text-muted-foreground">
            <p>{t.notes.none}</p>
            <Button variant="outline" size="sm" onClick={() => onWritingChange(true)}>
              <Plus /> {t.verse.addNote}
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
}
