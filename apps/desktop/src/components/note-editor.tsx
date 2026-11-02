import { Button } from "@starter/ui/components/button";
import { Input } from "@starter/ui/components/input";
import { Textarea } from "@starter/ui/components/textarea";
import { useState } from "react";

import { useT } from "../lib/state/preferences";
import type { Note, VerseRange } from "../lib/state/study-store";

/**
 * SOURCE OF TRUTH KEYWORDS: NoteEditor, edit note, write note, note form, tags input
 * WHAT:  Title, body and tags for one note anchored to passages (or none, for journal entries).
 * WHY:   The reader rail, Study page and Today reflection all write notes the same way.
 * WHERE: reader notes rail, Study page, Today reflection (journal kind).
 */
export function NoteEditor({
  note,
  anchors,
  kind = "note",
  onSave,
  onCancel,
}: {
  note?: Note;
  anchors: VerseRange[];
  kind?: Note["kind"];
  onSave: (note: Omit<Note, "id" | "createdAt" | "updatedAt"> & { id?: string }) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const [title, setTitle] = useState(note?.title ?? "");
  const [body, setBody] = useState(note?.body ?? "");
  const [tags, setTags] = useState(note?.tags.join(", ") ?? "");

  const save = () => {
    if (!body.trim() && !title.trim()) return;
    onSave({
      id: note?.id,
      kind: note?.kind ?? kind,
      title: title.trim(),
      body: body.trim(),
      tags: tags
        .split(",")
        .map((x) => x.trim().toLowerCase())
        .filter(Boolean),
      anchors: note?.anchors ?? anchors,
    });
  };

  return (
    <div
      className="flex flex-col gap-2 rounded-xl border bg-card p-3 shadow-xs"
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") save();
        if (e.key === "Escape") onCancel();
      }}
    >
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        className="bg-transparent text-sm font-semibold outline-none placeholder:text-muted-foreground"
      />
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={t.notes.placeholder}
        className="min-h-28 resize-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
      />
      <Input
        value={tags}
        onChange={(e) => setTags(e.target.value)}
        placeholder={t.notes.tagPlaceholder}
        className="h-7 text-xs"
      />
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          {t.notes.cancel}
        </Button>
        <Button size="sm" onClick={save}>
          {t.notes.save}
          <kbd className="ml-1 text-[10px] opacity-70">⌘↵</kbd>
        </Button>
      </div>
    </div>
  );
}
