import { normalizeForSearch } from "@starter/bible-core/normalize";
import { formatRange, overlaps, type VerseRange } from "@starter/bible-core/range";
import { referenceRange } from "@starter/bible-core/reference";
import { chapterOf, splitVerseId } from "@starter/bible-core/verse-id";
import { TRANSLATIONS } from "@starter/bible-data/manifest";
import { Button } from "@starter/ui/components/button";
import { Input } from "@starter/ui/components/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@starter/ui/components/tabs";
import { cn } from "@starter/ui/lib/utils";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowUpRight, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { HIGHLIGHT_BG } from "../../components/highlight-colors";
import { linkedReferences, NoteBody } from "../../components/note-body";
import { NoteEditor } from "../../components/note-editor";
import { Page, PageHeader } from "../../components/page";
import { useChapter } from "../../lib/bible/use-chapter";
import { useFormatDate } from "../../lib/format";
import { usePreferences, useT } from "../../lib/state/preferences";
import { HIGHLIGHT_COLORS, useStudy, type HighlightColor, type Note } from "../../lib/state/study-store";
import { studyRoute } from "../../router";

/**
 * SOURCE OF TRUTH KEYWORDS: PassageText, passage text, verse text for a range
 * WHAT:  The text of a verse range in the reader's main translation, with its language set.
 * WHY:   Study lists show the words themselves, not just references.
 * WHERE: Study notes, highlights and collections.
 */
function PassageText({ range, className }: { range: VerseRange; className?: string }) {
  const { prefs } = usePreferences();
  const data = useChapter(prefs.mainTranslation, chapterOf(range.start));
  const lang = TRANSLATIONS.find((x) => x.id === prefs.mainTranslation)?.language ?? "en";
  const text = data?.verses
    .filter((v) => overlaps(range, { start: v.vid, end: v.spanEnd }))
    .map((v) => v.text.replace(/\n/g, " "))
    .join(" ");
  return (
    <p lang={lang} className={cn("scripture", className)}>
      {text || "…"}
    </p>
  );
}

/**
 * SOURCE OF TRUTH KEYWORDS: PassageLink, passage chip, open passage in reader
 * WHAT:  A small chip naming a passage in the interface language that opens it in the reader.
 * WHERE: Study notes (anchors and linked passages), highlights, collections.
 */
function PassageLink({ range }: { range: VerseRange }) {
  const { prefs } = usePreferences();
  const { verse } = splitVerseId(range.start);
  return (
    <Link
      to="/read"
      search={{ c: chapterOf(range.start), v: verse || undefined }}
      className="inline-flex items-center gap-0.5 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
    >
      {formatRange(range, prefs.locale)}
      <ArrowUpRight aria-hidden className="size-3" />
    </Link>
  );
}

function NotesTab({ kind }: { kind: Note["kind"] }) {
  const t = useT();
  const study = useStudy();
  const formatDate = useFormatDate();
  const search = studyRoute.useSearch();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  // Which note is being edited is pinned by id, so filtering the list can never swap it.
  const [mode, setMode] = useState<{ kind: "view" } | { kind: "new" } | { kind: "edit"; id: string }>({ kind: "view" });

  const notes = useMemo(() => {
    const q = normalizeForSearch(query);
    return study.notes
      .filter((n) => n.kind === kind)
      .filter((n) => !tag || n.tags.includes(tag))
      .filter((n) => {
        if (!q) return true;
        // Passages are searchable by name in both languages ("john 3", "ዮሐንስ").
        const passages = n.anchors.map((a) => `${formatRange(a, "en")} ${formatRange(a, "am")}`).join(" ");
        return normalizeForSearch(`${n.title} ${n.body} ${n.tags.join(" ")} ${passages}`).includes(q);
      })
      .toSorted((a, b) => b.updatedAt - a.updatedAt);
  }, [study.notes, kind, tag, query]);
  const tags = [...new Set(study.notes.filter((n) => n.kind === kind).flatMap((n) => n.tags))].toSorted();
  const selected = notes.find((n) => n.id === search.note) ?? notes[0];
  const editing = mode.kind === "edit" ? study.notes.find((n) => n.id === mode.id) : undefined;

  // Other notes that link to a passage this note is about.
  const linked = selected ? linkedReferences(selected.body) : [];
  const backlinks = selected
    ? study.notes.filter(
        (n) =>
          n.id !== selected.id &&
          linkedReferences(n.body).some((r) => selected.anchors.some((a) => overlaps(a, referenceRange(r)))),
      )
    : [];

  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(220px,300px)_1fr] gap-6">
      <div className="flex min-h-0 flex-col gap-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search aria-hidden className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.study.search}
              aria-label={t.study.search}
              className="h-8 pl-8 text-[13px]"
            />
          </div>
          <Button size="sm" onClick={() => setMode({ kind: "new" })}>
            <Plus /> {kind === "journal" ? t.study.newEntry : t.study.newNote}
          </Button>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t.notes.tags}>
            {[null, ...tags].map((x) => (
              <button
                key={x ?? "all"}
                type="button"
                aria-pressed={tag === x}
                onClick={() => setTag(tag === x ? null : x)}
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
        )}
        <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-1">
          {notes.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">{t.study.empty}</p>}
          {notes.map((n) => (
            <button
              key={n.id}
              type="button"
              aria-current={selected?.id === n.id ? "true" : undefined}
              onClick={() => {
                setMode({ kind: "view" });
                void navigate({ to: "/study", search: { tab: kind === "journal" ? "journal" : "notes", note: n.id } });
              }}
              className={cn(
                "rounded-xl border p-3 text-left transition-colors",
                selected?.id === n.id && mode.kind === "view"
                  ? "border-primary/40 bg-accent/60"
                  : "border-transparent hover:bg-muted",
              )}
            >
              <p className="truncate text-sm font-semibold">{n.title}</p>
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                {n.body.replace(/\[\[([^\]]+)\]\]/g, "$1")}
              </p>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                {formatDate(n.updatedAt)}
                {n.tags.length > 0 && <span className="ml-2 text-primary">{n.tags.map((x) => `#${x}`).join(" ")}</span>}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 overflow-y-auto">
        {mode.kind === "new" ? (
          <NoteEditor
            kind={kind}
            anchors={[]}
            onSave={(n) => {
              study.saveNote(n);
              setMode({ kind: "view" });
            }}
            onCancel={() => setMode({ kind: "view" })}
          />
        ) : editing ? (
          <NoteEditor
            key={editing.id}
            note={editing}
            anchors={editing.anchors}
            onSave={(n) => {
              study.saveNote(n);
              setMode({ kind: "view" });
            }}
            onCancel={() => setMode({ kind: "view" })}
          />
        ) : selected ? (
          <article className="rounded-2xl border bg-card p-8 shadow-xs">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-2xl font-semibold tracking-tight">{selected.title}</h2>
              <Button variant="outline" size="sm" onClick={() => setMode({ kind: "edit", id: selected.id })}>
                {t.notes.edit}
              </Button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{formatDate(selected.updatedAt)}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {selected.anchors.map((a) => (
                <PassageLink key={`${a.start}-${a.end}`} range={a} />
              ))}
              {selected.tags.map((x) => (
                <span key={x} className="text-xs text-primary">
                  #{x}
                </span>
              ))}
            </div>
            {selected.anchors[0] && (
              <div className="mt-6 border-l-2 border-primary/40 pl-4">
                <PassageText range={selected.anchors[0]} className="text-[0.95em] text-foreground/85" />
              </div>
            )}
            <div className="mt-6 text-[15px] leading-relaxed">
              <NoteBody body={selected.body} />
            </div>
            {linked.length > 0 && (
              <div className="mt-8 border-t pt-5">
                <h3 className="eyebrow mb-2">{t.notes.linked}</h3>
                <div className="flex flex-wrap gap-1.5">
                  {linked.map((r, i) => (
                    <PassageLink key={i} range={referenceRange(r)} />
                  ))}
                </div>
              </div>
            )}
            {backlinks.length > 0 && (
              <div className="mt-6">
                <h3 className="eyebrow mb-2">{t.notes.backlinks}</h3>
                {backlinks.map((b) => (
                  <Link key={b.id} to="/study" search={{ note: b.id }} className="block text-sm hover:underline">
                    {b.title}
                  </Link>
                ))}
              </div>
            )}
          </article>
        ) : (
          <p className="pt-20 text-center text-sm text-muted-foreground">{t.study.empty}</p>
        )}
      </div>
    </div>
  );
}

function HighlightsTab() {
  const t = useT();
  const study = useStudy();
  const [color, setColor] = useState<HighlightColor | null>(null);
  const list = study.highlights.filter((h) => !color || h.color === color).toSorted((a, b) => a.start - b.start);
  if (study.highlights.length === 0)
    return <p className="pt-16 text-center text-sm text-muted-foreground">{t.study.emptyHighlights}</p>;
  return (
    <div className="max-w-3xl">
      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label={t.study.highlights}>
        <button
          type="button"
          aria-pressed={color === null}
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
            aria-pressed={color === c}
            onClick={() => setColor(color === c ? null : c)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs",
              color === c ? "border-primary" : "bg-card",
            )}
          >
            <span aria-hidden className={cn("size-2.5 rounded-full", HIGHLIGHT_BG[c])} />
            {t.colors[c]}{" "}
            <span className="text-muted-foreground">{study.highlights.filter((h) => h.color === c).length}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-3">
        {list.map((h) => (
          <div key={h.id} className="flex gap-4 rounded-xl border bg-card p-4">
            <span aria-hidden className={cn("w-1 shrink-0 rounded-full", HIGHLIGHT_BG[h.color])} />
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
  if (study.collections.length === 0)
    return <p className="pt-16 text-center text-sm text-muted-foreground">{t.study.emptyCollections}</p>;
  return (
    <div className="grid grid-cols-1 gap-5 @3xl:grid-cols-2">
      {study.collections.map((c) => (
        <section key={c.id} className="rounded-2xl border bg-card p-5 shadow-xs">
          <div className="mb-4 flex items-baseline justify-between">
            <h3 className="font-semibold">{c.name}</h3>
            <span className="text-xs text-muted-foreground">{t.study.items(c.items.length)}</span>
          </div>
          <div className="flex flex-col gap-4">
            {c.items.length === 0 && <p className="text-sm text-muted-foreground">{t.study.emptyCollections}</p>}
            {c.items.map((item) => (
              <div key={`${item.start}-${item.end}`}>
                <PassageLink range={item} />
                <PassageText range={item} className="mt-1.5 line-clamp-3 text-[0.9em] text-foreground/85" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

const TABS = ["notes", "highlights", "collections", "journal"] as const;

export function StudyPage() {
  const t = useT();
  const search = studyRoute.useSearch();
  const navigate = useNavigate();
  const tab = search.tab ?? "notes";
  return (
    <Page scroll={false}>
      <Tabs
        value={tab}
        onValueChange={(value) => {
          const next = TABS.find((x) => x === value);
          if (next) void navigate({ to: "/study", search: { tab: next } });
        }}
        className="flex min-h-0 flex-1 flex-col"
      >
        <PageHeader
          title={t.study.title}
          actions={
            <TabsList>
              <TabsTrigger value="notes">{t.study.notes}</TabsTrigger>
              <TabsTrigger value="highlights">{t.study.highlights}</TabsTrigger>
              <TabsTrigger value="collections">{t.study.collections}</TabsTrigger>
              <TabsTrigger value="journal">{t.study.journal}</TabsTrigger>
            </TabsList>
          }
        />
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
    </Page>
  );
}
