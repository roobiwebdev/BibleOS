import { BOOKS, type BookInfo } from "@starter/bible-core/books";
import { MAX_PLAN_DAYS } from "@starter/bible-core/plans";
import { Button } from "@starter/ui/components/button";
import { Input } from "@starter/ui/components/input";
import { cn } from "@starter/ui/lib/utils";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";

import { Card, Eyebrow } from "../../components/page";
import type { CustomPlanDraft } from "../../lib/state/plans-store";
import { usePreferences, useT } from "../../lib/state/preferences";

const customPlanFormSchema = z.object({
  title: z.string().trim().min(1).max(200),
  books: z.array(z.string()).min(1),
  days: z.number().int().min(1).max(MAX_PLAN_DAYS),
});

const TESTAMENTS = [
  { key: "oldTestament", books: BOOKS.filter((b) => b.testament === "OT") },
  { key: "newTestament", books: BOOKS.filter((b) => b.testament === "NT") },
] as const;

const chapterCount = (codes: readonly string[]) =>
  BOOKS.filter((b) => codes.includes(b.code)).reduce((sum, b) => sum + b.chapters, 0);

/** "Make your own plan": a name, the books (tap to toggle) and the number of days. */
export function CustomPlanForm({ onCreate }: { onCreate: (draft: CustomPlanDraft) => void }) {
  const t = useT();
  const { prefs } = usePreferences();
  const form = useForm({
    defaultValues: { title: "", books: new Array<string>(), days: 30 },
    validators: { onSubmit: customPlanFormSchema },
    onSubmit: ({ value }) => onCreate({ title: value.title.trim(), books: value.books, days: value.days }),
  });

  return (
    <Card>
      <Eyebrow>{t.plans.makeYourOwn}</Eyebrow>
      <p className="mb-4 text-sm text-muted-foreground">{t.plans.makeYourOwnHint}</p>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void form.handleSubmit();
        }}
      >
        <div className="flex flex-wrap gap-4">
          <form.Field name="title">
            {(field) => (
              <label className="flex min-w-60 flex-1 flex-col gap-1.5 text-sm font-medium">
                {t.plans.planName}
                <Input
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder={t.plans.planNamePlaceholder}
                  aria-invalid={field.state.meta.errors.length > 0}
                />
              </label>
            )}
          </form.Field>
          <form.Field name="days">
            {(field) => (
              <label className="flex w-36 flex-col gap-1.5 text-sm font-medium">
                {t.plans.numberOfDays}
                <Input
                  type="number"
                  min={1}
                  max={MAX_PLAN_DAYS}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.valueAsNumber || 0)}
                  onBlur={field.handleBlur}
                  aria-invalid={field.state.meta.errors.length > 0}
                />
              </label>
            )}
          </form.Field>
        </div>

        <form.Field name="books">
          {(field) => {
            const selected = new Set(field.state.value);
            const toggle = (book: BookInfo) =>
              field.handleChange(
                BOOKS.filter((b) => (b.code === book.code ? !selected.has(b.code) : selected.has(b.code))).map(
                  (b) => b.code,
                ),
              );
            return (
              <fieldset className="flex flex-col gap-3" aria-invalid={field.state.meta.errors.length > 0}>
                <legend className="mb-2 text-sm font-medium">{t.plans.books}</legend>
                {TESTAMENTS.map((group) => (
                  <div key={group.key}>
                    <p className="mb-1.5 text-xs text-muted-foreground">{t.plans[group.key]}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {group.books.map((book) => (
                        <button
                          key={book.code}
                          type="button"
                          aria-pressed={selected.has(book.code)}
                          onClick={() => toggle(book)}
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-xs transition-colors",
                            selected.has(book.code)
                              ? "border-primary bg-primary text-primary-foreground"
                              : "bg-background hover:bg-muted",
                          )}
                        >
                          {book[prefs.locale].short}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  {t.plans.chaptersSelected(chapterCount(field.state.value))}
                </p>
              </fieldset>
            );
          }}
        </form.Field>

        <form.Subscribe selector={(s) => s.errorMap.onSubmit}>
          {(error) => error && <p className="text-sm text-destructive">{t.plans.chooseBooks}</p>}
        </form.Subscribe>
        <div className="flex justify-end">
          <Button type="submit">{t.plans.create}</Button>
        </div>
      </form>
    </Card>
  );
}
