import { formatRange, overlaps, type VerseRange } from "@starter/bible-core/range";
import { Button } from "@starter/ui/components/button";
import { cn } from "@starter/ui/lib/utils";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { NoteBody } from "../../components/note-body";
import { NoteEditor } from "../../components/note-editor";
import { usePreferences, useT } from "../../lib/state/preferences";
import { useStudy, type Note } from "../../lib/state/study-store";

/**
 * SOURCE OF TRUTH KEYWORDS: NoteCard, note card, delete note with undo, edit note
 * WHAT:  One note as a card: title, linked body, passages and tags, with edit and delete.
 * WHY:   Deleting asks nothing but can be undone for a few seconds, which is faster and safer
 *        than a confirm dialog. Actions show on hover and on keyboard focus.
 * WHERE: reader notes rail.
 */
export function NoteCard({ note, onEdit }: { note: Note; onEdit: () => void }) {
  const { prefs } = usePreferences();
  const study = useStudy();
  const t = useT();
  return (
    <article className="group rounded-xl border bg-card p-3.5 text-sm shadow-xs">
      <div className="mb-1.5 flex items-start gap-2">
        <h4 className="flex-1 font-semibold leading-snug">
          {note.title || note.anchors.map((a) => formatRange(a, prefs.locale)).join(", ")}
        </h4>
        <div className="flex opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          <Button variant="ghost" size="icon-xs" aria-label={t.notes.edit} onClick={onEdit}>
            <Pencil />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t.notes.delete}
            onClick={() => {
              const undo = study.deleteNote(note.id);
              toast(t.notes.deleted, { action: { label: t.notes.undo, onClick: undo } });
            }}
          >
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
            key={`${a.start}-${a.end}`}
            className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground"
          >
            {formatRange(a, prefs.locale)}
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

/**
 * SOURCE OF TRUTH KEYWORDS: NotesRail, notes panel, notes for passage, draft note
 * WHAT:  Notes for the selected verses (or the whole chapter), plus a draft editor whose
 *        passage is fixed when it opens.
 * WHY:   Notes sit beside the text without leaving the reader. Below a wide window it floats
 *        over the text instead of squeezing the reading column.
 * WHERE: reader page.
 */
export function NotesRail({
  scope,
  draft,
  onDraftChange,
}: {
  /** Selected verses, or the whole chapter. */
  scope: VerseRange;
  /** Anchors of the note being written, or null when not writing. */
  draft: VerseRange[] | null;
  onDraftChange: (draft: VerseRange[] | null) => void;
}) {
  const t = useT();
  const { prefs } = usePreferences();
  const study = useStudy();
  const [editing, setEditing] = useState<string | null>(null);
  const notes = study.notes.filter((n) => n.anchors.some((a) => overlaps(a, scope)));

  return (
    <aside
      aria-label={t.notes.onThisVerse}
      className={cn(
        "flex w-80 shrink-0 flex-col border-l bg-sidebar",
        // Narrow windows: float over the text instead of taking width from it.
        "max-[1180px]:absolute max-[1180px]:bottom-0 max-[1180px]:right-0 max-[1180px]:top-12 max-[1180px]:z-20 max-[1180px]:shadow-2xl",
      )}
    >
      <div data-tauri-drag-region className="flex h-12 shrink-0 items-center justify-between border-b px-4">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold">{t.notes.onThisVerse}</p>
          <p className="truncate text-[11px] text-muted-foreground">{formatRange(scope, prefs.locale)}</p>
        </div>
        <Button variant="ghost" size="icon-sm" aria-label={t.verse.addNote} onClick={() => onDraftChange([scope])}>
          <Plus />
        </Button>
      </div>
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-3">
        {draft && (
          <>
            <p className="px-1 text-[11px] text-muted-foreground">
              {draft.map((a) => formatRange(a, prefs.locale)).join(", ")}
            </p>
            <NoteEditor
              anchors={draft}
              onSave={(note) => {
                study.saveNote(note);
                onDraftChange(null);
              }}
              onCancel={() => onDraftChange(null)}
            />
          </>
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
        {!draft && notes.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-sm text-muted-foreground">
            <p>{t.notes.none}</p>
            <Button variant="outline" size="sm" onClick={() => onDraftChange([scope])}>
              <Plus /> {t.verse.addNote}
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
}
