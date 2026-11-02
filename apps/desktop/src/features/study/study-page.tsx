import { normalizeForSearch } from "@starter/bible-core/normalize";
import { referenceRange } from "@starter/bible-core/reference";
import { chapterOf, splitVerseId } from "@starter/bible-core/verse-id";
import { Button } from "@starter/ui/components/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@starter/ui/components/tabs";
import { cn } from "@starter/ui/lib/utils";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowUpRight, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { linkedReferences, NoteBody } from "../../components/note-body";
import { NoteEditor } from "../../components/note-editor";
import { useChapter } from "../../lib/bible/use-chapter";
import { usePreferences, useT } from "../../lib/state/preferences";
import {
  HIGHLIGHT_COLORS,
  overlaps,
  useStudy,
  type HighlightColor,
  type Note,
  type VerseRange,
} from "../../lib/state/study-store";
import { studyRoute } from "../../router";
import { rangeLabel } from "../reader/notes-rail";

const SWATCH: Record<HighlightColor, string> = {
  promise: "bg-hl-promise",
  command: "bg-hl-command",
  prayer: "bg-hl-prayer",
  insight: "bg-hl-insight",
  question: "bg-hl-question",
};

/** The text of a verse range in the reader's main translation. */
function PassageText({ range, className }: { range: VerseRange; className?: string }) {
  const { prefs } = usePreferences();
  const data = useChapter(prefs.mainTranslation, chapterOf(range.start));
  const text = data?.verses
    .filter((v) => v.vid <= range.end && range.start <= v.spanEnd)
    .map((v) => v.text.replace(/\n/g, " "))
    .join(" ");
  return <p className={cn("scripture", className)}>{text || "…"}</p>;
}

function PassageLink({ range }: { range: VerseRange }) {
  const { prefs } = usePreferences();
  const { verse } = splitVerseId(range.start);
  return (
    <Link
      to="/read"
      search={{ c: chapterOf(range.start), v: verse || undefined }}
      className="inline-flex items-center gap-0.5 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
    >
      {rangeLabel(range, prefs.locale)}
      <ArrowUpRight className="size-3" />
    </Link>
  );
}

function NotesTab({ kind }: { kind: Note["kind"] }) {
  const t = useT();
  const study = useStudy();
  const search = studyRoute.useSearch();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [mode, setMode] = useState<"view" | "edit" | "new">("view");

  const notes = useMemo(() => {
    const q = normalizeForSearch(query);
    return study.notes
      .filter((n) => n.kind === kind)
      .filter((n) => !tag || n.tags.includes(tag))
      .filter((n) => !q || normalizeForSearch(`${n.title} ${n.body} ${n.tags.join(" ")}`).includes(q))
      .toSorted((a, b) => b.updatedAt - a.updatedAt);
  }, [study.notes, kind, tag, query]);
  const tags = [...new Set(study.notes.filter((n) => n.kind === kind).flatMap((n) => n.tags))].toSorted();
  const selected = notes.find((n) => n.id === search.note) ?? notes[0];
  // Other notes that link to a passage this note is about.
  const backlinks = selected
    ? study.notes.filter(
        (n) =>
          n.id !== selected.id &&
          linkedReferences(n.body).some((r) => selected.anchors.some((a) => overlaps(a, referenceRange(r)))),
      )
    : [];

  return (
    <div className="grid h-full grid-cols-[minmax(260px,320px)_1fr] gap-6">
      <div className="flex min-h-0 flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.study.search}
            className="h-8 w-full rounded-lg border bg-card pl-8 pr-2 text-[13px] outline-none focus:ring-2 focus:ring-ring/40"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[null, ...tags].map((x) => (
            <button
              key={x ?? "all"}
              type="button"
              onClick={() => setTag(x)}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                tag === x
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {x ? `#${x}` : t.study.allTags}
            </button>
          ))}
        </div>
        <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-1">
          {notes.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">{t.study.empty}</p>}
          {notes.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => {
                setMode("view");
                void navigate({ to: "/study", search: { tab: kind === "journal" ? "journal" : "notes", note: n.id } });
              }}
              className={cn(
                "rounded-xl border p-3 text-left transition-colors",
                selected?.id === n.id && mode !== "new"
                  ? "border-primary/40 bg-accent/60"
                  : "border-transparent hover:bg-muted",
              )}
            >
              <p className="truncate text-sm font-semibold">{n.title}</p>
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                {n.body.replace(/\[\[([^\]]+)\]\]/g, "$1")}
              </p>
              <p className="mt-1.5 text-[11px] text-muted-foreground/80">
                {new Date(n.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                {n.tags.length > 0 && <span className="ml-2 text-primary">{n.tags.map((x) => `#${x}`).join(" ")}</span>}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 overflow-y-auto">
        {mode === "new" ? (
          <NoteEditor
            kind={kind}
            anchors={[]}
            onSave={(n) => {
              study.saveNote(n);
              setMode("view");
            }}
            onCancel={() => setMode("view")}
          />
        ) : selected && mode === "edit" ? (
          <NoteEditor
            note={selected}
            anchors={selected.anchors}
            onSave={(n) => {
              study.saveNote(n);
              setMode("view");
            }}
            onCancel={() => setMode("view")}
          />
        ) : selected ? (
          <article className="rounded-2xl border bg-card p-8 shadow-xs">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-2xl font-semibold tracking-tight">{selected.title}</h2>
              <Button variant="outline" size="sm" onClick={() => setMode("edit")}>
                {t.notes.edited}
              </Button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {selected.anchors.map((a) => (
                <PassageLink key={a.start} range={a} />
              ))}
              {selected.tags.map((x) => (
                <span key={x} className="text-xs text-primary">
                  #{x}
                </span>
              ))}
            </div>
            {selected.anchors[0] && (
              <div className="mt-6 border-l-2 border-primary/40 pl-4">
                <PassageText range={selected.anchors[0]} className="text-[0.95em] text-foreground/80" />
              </div>
            )}
            <div className="mt-6 text-[15px] leading-relaxed">
              <NoteBody body={selected.body} />
            </div>
            {linkedReferences(selected.body).length > 0 && (
              <div className="mt-8 border-t pt-5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t.notes.linked}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {linkedReferences(selected.body).map((r) => (
                    <span
                      key={`${r.book.code}${r.chapter}${r.verse ?? ""}`}
                      className="rounded-md bg-accent px-2 py-0.5 text-xs text-accent-foreground"
                    >
                      {r.book.en.short} {r.chapter}
                      {r.verse ? `:${r.verse}` : ""}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {backlinks.length > 0 && (
              <div className="mt-6">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t.notes.backlinks}
                </p>
                {backlinks.map((b) => (
                  <p key={b.id} className="text-sm">
                    {b.title}
                  </p>
                ))}
              </div>
            )}
          </article>
        ) : (
          <p className="pt-20 text-center text-sm text-muted-foreground">{t.study.empty}</p>
        )}
      </div>

      <Button className="absolute right-10 top-[3.25rem]" size="sm" onClick={() => setMode("new")}>
        <Plus /> {t.study.newNote}
      </Button>
    </div>
  );
}

function HighlightsTab() {
  const t = useT();
  const study = useStudy();
  const [color, setColor] = useState<HighlightColor | null>(null);
  const list = study.highlights.filter((h) => !color || h.color === color).toSorted((a, b) => a.start - b.start);
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setColor(null)}
          className={cn(
            "rounded-full border px-3 py-1 text-xs",
            color === null ? "border-primary bg-primary text-primary-foreground" : "bg-card",
          )}
        >
          {t.study.allTags}
        </button>
        {HIGHLIGHT_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs",
              color === c ? "border-primary" : "bg-card",
            )}
          >
            <span className={cn("size-2.5 rounded-full", SWATCH[c])} />
            {t.colors[c]}{" "}
            <span className="text-muted-foreground">{study.highlights.filter((h) => h.color === c).length}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-3">
        {list.map((h) => (
          <div key={h.id} className="flex gap-4 rounded-xl border bg-card p-4">
            <span className={cn("w-1 shrink-0 rounded-full", SWATCH[h.color])} />
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex items-center gap-2">
                <PassageLink range={h} />
                <span className="text-[11px] text-muted-foreground">{t.colors[h.color]}</span>
              </div>
              <PassageText range={h} className="text-[0.95em]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CollectionsTab() {
  const t = useT();
  const study = useStudy();
  return (
    <div className="grid grid-cols-2 gap-5">
      {study.collections.map((c) => (
        <section key={c.id} className="rounded-2xl border bg-card p-5 shadow-xs">
          <div className="mb-4 flex items-baseline justify-between">
            <h3 className="font-semibold">{c.name}</h3>
            <span className="text-xs text-muted-foreground">{t.study.items(c.items.length)}</span>
          </div>
          <div className="flex flex-col gap-4">
            {c.items.map((item) => (
              <div key={`${item.start}-${item.end}`}>
                <PassageLink range={item} />
                <PassageText range={item} className="mt-1.5 line-clamp-3 text-[0.9em] text-foreground/80" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function StudyPage() {
  const t = useT();
  const search = studyRoute.useSearch();
  const navigate = useNavigate();
  const tab = search.tab ?? "notes";
  return (
    <div className="relative flex h-full flex-col">
      <div data-tauri-drag-region className="h-11 shrink-0" />
      <Tabs
        value={tab}
        onValueChange={(value) => {
          if (value === "notes" || value === "highlights" || value === "collections" || value === "journal") {
            void navigate({ to: "/study", search: { tab: value } });
          }
        }}
        className="flex min-h-0 flex-1 flex-col px-10 pb-8"
      >
        <div className="mb-6 flex items-center gap-6">
          <h1 className="text-3xl font-semibold tracking-tight">{t.study.title}</h1>
          <TabsList>
            <TabsTrigger value="notes">{t.study.notes}</TabsTrigger>
            <TabsTrigger value="highlights">{t.study.highlights}</TabsTrigger>
            <TabsTrigger value="collections">{t.study.collections}</TabsTrigger>
            <TabsTrigger value="journal">{t.study.journal}</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="notes" className="min-h-0 flex-1">
          <NotesTab kind="note" />
        </TabsContent>
        <TabsContent value="journal" className="min-h-0 flex-1">
          <NotesTab kind="journal" />
        </TabsContent>
        <TabsContent value="highlights" className="min-h-0 flex-1 overflow-y-auto">
          <HighlightsTab />
        </TabsContent>
        <TabsContent value="collections" className="min-h-0 flex-1 overflow-y-auto">
          <CollectionsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
