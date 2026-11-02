import { Button } from "@starter/ui/components/button";
import { Input } from "@starter/ui/components/input";
import { Textarea } from "@starter/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";

import { useT } from "../lib/state/preferences";
import type { Note, NoteDraft, VerseRange } from "../lib/state/study-store";

/**
 * SOURCE OF TRUTH KEYWORDS: NoteEditor, noteFormSchema, edit note, write note, note form, tags input
 * WHAT:  Title, body and tags for one note anchored to passages (or none, for journal entries).
 * WHY:   The reader rail, Study page and Today reflection all write notes the same way. Input is
 *        validated with Zod before it reaches the store, as at every boundary. Tags split on the
 *        Latin comma and the Ethiopic comma ፣ so Amharic keyboards work.
 * WHERE: reader notes rail, Study page.
 */
export const noteFormSchema = z
  .object({
    title: z.string().max(200),
    body: z.string().max(20_000),
    tags: z.string().max(500),
  })
  .refine((v) => v.title.trim() !== "" || v.body.trim() !== "", { path: ["body"] });

export function NoteEditor({
  note,
  anchors,
  kind = "note",
  onSave,
  onCancel,
}: {
  note?: Note;
  /** Fixed when the editor opens, so moving to another chapter never re-anchors the draft. */
  anchors: VerseRange[];
  kind?: Note["kind"];
  onSave: (note: NoteDraft) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const form = useForm({
    defaultValues: { title: note?.title ?? "", body: note?.body ?? "", tags: note?.tags.join(", ") ?? "" },
    validators: { onSubmit: noteFormSchema },
    onSubmit: ({ value }) =>
      onSave({
        id: note?.id,
        kind: note?.kind ?? kind,
        title: value.title.trim(),
        body: value.body.trim(),
        tags: [
          ...new Set(
            value.tags
              .split(/[,፣]/)
              .map((x) => x.trim().toLowerCase())
              .filter(Boolean),
          ),
        ],
        anchors: note?.anchors ?? anchors,
      }),
  });

  return (
    <form
      className="flex flex-col gap-2 rounded-xl border bg-card p-3 shadow-xs"
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void form.handleSubmit();
        if (e.key === "Escape") onCancel();
      }}
    >
      <form.Field name="title">
        {(field) => (
          <input
            autoFocus
            aria-label={t.notes.titlePlaceholder}
            value={field.state.value}
            onChange={(e) => field.handleChange(e.target.value)}
            onBlur={field.handleBlur}
            placeholder={t.notes.titlePlaceholder}
            className="bg-transparent text-sm font-semibold placeholder:text-muted-foreground"
          />
        )}
      </form.Field>
      <form.Field name="body">
        {(field) => (
          <Textarea
            aria-label={t.notes.placeholder}
            value={field.state.value}
            onChange={(e) => field.handleChange(e.target.value)}
            onBlur={field.handleBlur}
            placeholder={t.notes.placeholder}
            aria-invalid={field.state.meta.errors.length > 0}
            className="min-h-28 resize-none border-0 bg-transparent p-0 text-sm shadow-none"
          />
        )}
      </form.Field>
      <form.Field name="tags">
        {(field) => (
          <Input
            aria-label={t.notes.tags}
            value={field.state.value}
            onChange={(e) => field.handleChange(e.target.value)}
            onBlur={field.handleBlur}
            placeholder={t.notes.tagPlaceholder}
            className="h-7 text-xs"
          />
        )}
      </form.Field>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          {t.notes.cancel}
        </Button>
        <Button type="submit" size="sm">
          {t.notes.save}
          <kbd className="ml-1 text-[10px]">⌘↵</kbd>
        </Button>
      </div>
    </form>
  );
}
