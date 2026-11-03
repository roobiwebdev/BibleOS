import { BOOKS, bookByCode, bookByOrd } from "@starter/bible-core/books";
import { formatRange } from "@starter/bible-core/range";
import { formatReference, matchBooks, parseReference } from "@starter/bible-core/reference";
import { parseScope, splitBySpans, type MatchMode, type SearchScope } from "@starter/bible-core/search";
import { chapterOf, makeVerseId, splitVerseId, type VerseId } from "@starter/bible-core/verse-id";
import { TRANSLATIONS } from "@starter/bible-data/manifest";
import { Button } from "@starter/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@starter/ui/components/dropdown-menu";
import { cn } from "@starter/ui/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, BookOpen, Check, ChevronDown, Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { Page, PageHeader } from "../../components/page";
import { TranslationMenu } from "../../components/translation-menu";
import type { SearchVerse } from "../../lib/bible/source";
import { usePreferences, useT } from "../../lib/state/preferences";
import { searchRoute } from "../../router";
import { useBibleSearch } from "./use-bible-search";

const PAGE_SIZE = 100;
const TOP_BOOKS = 10;

/** The books with the most matches, shown in Bible order as shortcuts to scope the search. */
const topBooks = (perBook: readonly { ord: number; count: number }[]) =>
  perBook
    .toSorted((a, b) => b.count - a.count || a.ord - b.ord)
    .slice(0, TOP_BOOKS)
    .toSorted((a, b) => a.ord - b.ord);
const TYPING_DELAY_MS = 150;

type Language = "am" | "en";

function Chip({
  active,
  onClick,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-card text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

function ScopeChips({
  scope,
  onChange,
  locale,
}: {
  scope: SearchScope;
  onChange: (scope: SearchScope) => void;
  locale: Language;
}) {
  const t = useT();
  const book = bookByCode(scope);
  const fixed = [
    { id: "all", label: t.search.wholeBible },
    { id: "OT", label: t.search.oldTestament },
    { id: "NT", label: t.search.newTestament },
  ] as const;
  return (
    <div role="group" aria-label={t.search.scope} className="flex flex-wrap items-center gap-1.5">
      {fixed.map((s) => (
        <Chip key={s.id} active={scope === s.id} onClick={() => onChange(s.id)}>
          {s.label}
        </Chip>
      ))}
      <DropdownMenu>
        <DropdownMenuTrigger asChild nativeButton>
          <button
            type="button"
            aria-pressed={Boolean(book)}
            className={cn(
              "flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition-colors",
              book
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {book ? book[locale].short : t.search.chooseBook}
            <ChevronDown className="size-3 opacity-70" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-80 w-56 overflow-y-auto">
          {(["OT", "NT"] as const).map((testament, i) => (
            <DropdownMenuGroup key={testament}>
              {i > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel>
                {testament === "OT" ? t.search.oldTestament : t.search.newTestament}
              </DropdownMenuLabel>
              {BOOKS.filter((b) => b.testament === testament).map((b) => (
                <DropdownMenuItem key={b.code} onClick={() => onChange(b.code)} className="gap-2">
                  <span className="flex-1 truncate">{b[locale].short}</span>
                  {b.code === scope && <Check className="size-3.5" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** Verse text with the matched words marked; the scripture itself is shown unchanged. */
function Snippet({
  verse,
  lang,
}: {
  verse: SearchVerse & { matches: readonly (readonly [number, number])[] };
  lang: Language;
}) {
  return (
    <p lang={lang} className="scripture text-[0.92em] text-foreground/90">
      {splitBySpans(verse.text, verse.matches).map((part, i) =>
        part.hit ? (
          <mark key={i} className="rounded-sm bg-primary/15 box-decoration-clone text-foreground">
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </p>
  );
}

/**
 * SOURCE OF TRUTH KEYWORDS: SearchPage, Bible search screen, search results, scope chips, whole words
 * WHAT:  Whole-Bible search: words, "phrases" and -exclusions in any bundled translation, scoped to
 *        the whole Bible, a testament or one book, with highlighted results that open in the reader.
 * WHY:   The query and translation live in the URL (q, t) so back from the reader returns to the
 *        same results. A typed reference ("John 3:16") is offered as a jump instead of a search.
 * WHERE: /search route; ⌘K palette's "Search the Bible for …" option.
 */
export function SearchPage() {
  const t = useT();
  const { prefs } = usePreferences();
  const navigate = useNavigate({ from: "/search" });
  const params = searchRoute.useSearch();
  const q = params.q ?? "";
  const translation =
    TRANSLATIONS.find((x) => x.id === params.t) ?? TRANSLATIONS.find((x) => x.id === prefs.mainTranslation);
  const translationId = translation?.id ?? prefs.mainTranslation;
  const lang: Language = translation?.language ?? "en";
  const locale = prefs.locale;

  const [draft, setDraft] = useState(q);
  const [scope, setScope] = useState<SearchScope>("all");
  const [mode, setMode] = useState<MatchMode>("partial");
  // Paging and the keyboard cursor belong to one search; a new search starts at the top.
  const searchKey = `${q}|${scope}|${mode}|${translationId}`;
  const [paging, setPaging] = useState({ key: searchKey, limit: PAGE_SIZE });
  const limit = paging.key === searchKey ? paging.limit : PAGE_SIZE;
  const [cursor, setCursor] = useState({ key: searchKey, index: -1 });
  const active = cursor.key === searchKey ? cursor.index : -1;
  const setActive = (index: number) => setCursor({ key: searchKey, index });
  const sent = useRef(q);
  const listId = useId();

  // Back/forward changes q in the URL; show it in the box unless it is what we just sent.
  useEffect(() => {
    if (q !== sent.current) {
      sent.current = q;
      setDraft(q);
    }
  }, [q]);

  const commit = (text: string) => {
    sent.current = text;
    void navigate({ search: (prev) => ({ ...prev, q: text.trim() ? text : undefined }), replace: true });
  };

  // Results follow the box as the reader types, a moment after the last key.
  useEffect(() => {
    if (draft === q) return;
    const timer = window.setTimeout(() => {
      sent.current = draft;
      void navigate({ search: (prev) => ({ ...prev, q: draft.trim() ? draft : undefined }), replace: true });
    }, TYPING_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [draft, q, navigate]);

  const ntOnlyMiss = translation?.scope === "nt" && (scope === "OT" || bookByCode(scope)?.testament === "OT");
  const search = useBibleSearch(translationId, ntOnlyMiss ? "" : q, { scope, mode, limit });
  const data = search.data;
  const trimmed = q.trim();

  const ref = trimmed && /\d/.test(trimmed) ? parseReference(trimmed) : undefined;
  const openVerse = (vid: VerseId) =>
    void navigate({ to: "/read", search: { c: chapterOf(vid), v: splitVerseId(vid).verse || undefined } });
  const goToRef = ref ? () => openVerse(makeVerseId(ref.book.ord, ref.chapter, ref.verse ?? 0)) : undefined;

  const results = trimmed && !ntOnlyMiss ? (data?.results ?? []) : [];
  const options: { id: string; run: () => void }[] = [
    ...(goToRef ? [{ id: `${listId}-ref`, run: goToRef }] : []),
    ...results.map((r) => ({ id: `${listId}-${r.vid}`, run: () => openVerse(r.vid) })),
  ];
  const optionIndex = new Map(options.map((o, i) => [o.id, i]));

  const moveTo = (i: number) => {
    setActive(i);
    const option = options[i];
    if (option) document.getElementById(option.id)?.scrollIntoView({ block: "nearest" });
  };

  const bookSuggestion = data && data.total === 0 ? matchBooks(trimmed, 1)[0] : undefined;
  const groups: { ord: number; verses: typeof results }[] = [];
  for (const r of results) {
    const ord = splitVerseId(r.vid).ord;
    const last = groups.at(-1);
    if (last?.ord === ord) last.verses.push(r);
    else groups.push({ ord, verses: [r] });
  }

  const changeTranslation = (id: string) => void navigate({ search: (prev) => ({ ...prev, t: id }) });
  const optionClass = (id: string) =>
    cn(
      "block w-full cursor-pointer rounded-xl px-3 py-2.5 text-left transition-colors",
      optionIndex.get(id) === active ? "bg-accent text-accent-foreground" : "hover:bg-muted/60",
    );

  return (
    <Page>
      <PageHeader
        title={t.search.title}
        actions={
          <TranslationMenu
            value={translationId}
            onChange={changeTranslation}
            variant="outline"
            label={t.search.translation}
          />
        }
      />

      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            autoFocus
            type="search"
            role="combobox"
            aria-label={t.search.label}
            aria-expanded={options.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={options[active]?.id}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setActive(-1);
            }}
            onKeyDown={(e) => {
              // Ignore keys while an input method (e.g. an Amharic keyboard) is composing.
              if (e.nativeEvent.isComposing) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                moveTo(Math.min(active + 1, options.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                moveTo(Math.max(active - 1, -1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                // With nothing selected, a typed reference opens; otherwise search now.
                const option = options[active];
                const typedRef = /\d/.test(draft) ? parseReference(draft.trim()) : undefined;
                if (option) option.run();
                else if (typedRef) openVerse(makeVerseId(typedRef.book.ord, typedRef.chapter, typedRef.verse ?? 0));
                else commit(draft);
              } else if (e.key === "Escape" && active >= 0) {
                e.preventDefault();
                setActive(-1);
              }
            }}
            placeholder={t.search.placeholder}
            className="h-12 w-full rounded-xl border bg-card pr-10 pl-10 text-[15px] shadow-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {draft && (
            <button
              type="button"
              aria-label={t.search.clear}
              onClick={() => {
                setDraft("");
                commit("");
              }}
              className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <ScopeChips scope={scope} onChange={(s) => setScope(parseScope(s))} locale={locale} />
          <Chip active={mode === "whole"} onClick={() => setMode(mode === "whole" ? "partial" : "whole")}>
            {t.search.wholeWords}
          </Chip>
        </div>
      </div>

      <p aria-live="polite" className="mt-5 mb-3 flex min-h-5 flex-wrap gap-x-2 text-sm text-muted-foreground">
        {!trimmed ? (
          t.search.tips
        ) : ntOnlyMiss ? (
          t.search.ntOnly
        ) : search.failed ? (
          t.search.failed
        ) : search.loading && !data ? (
          t.search.searching
        ) : data ? (
          <>
            <span className="font-medium text-foreground">
              {data.total > data.results.length
                ? t.search.showing(data.results.length, data.total)
                : t.search.count(data.total)}
            </span>
            {search.ms !== undefined && <span>· {t.search.elapsed(search.ms)}</span>}
            {search.loading && <span>· {t.search.searching}</span>}
          </>
        ) : null}
      </p>

      {data && data.perBook.length > 1 && !bookByCode(scope) && trimmed && !ntOnlyMiss && (
        <div role="group" aria-label={t.search.byBook} className="mb-4 flex flex-wrap gap-1.5">
          {topBooks(data.perBook).map(({ ord, count }) => {
            const book = bookByOrd(ord);
            if (!book) return null;
            return (
              <button
                key={ord}
                type="button"
                onClick={() => setScope(book.code)}
                className="rounded-full border bg-card px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {book[locale].short} <span className="tabular-nums opacity-70">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      <div id={listId} role="listbox" aria-label={t.search.results} className="flex flex-col gap-1">
        {goToRef && ref && (
          <div
            id={`${listId}-ref`}
            role="option"
            aria-selected={active === 0}
            tabIndex={-1}
            onClick={goToRef}
            onMouseMove={() => setActive(0)}
            className={cn(optionClass(`${listId}-ref`), "mb-3 flex items-center gap-3 border bg-card")}
          >
            <BookOpen aria-hidden className="size-4 text-muted-foreground" />
            <span className="flex-1 font-medium">{t.search.goTo(formatReference(ref, locale))}</span>
            <ArrowRight aria-hidden className="size-4 text-muted-foreground" />
          </div>
        )}

        {groups.map((group) => {
          const book = bookByOrd(group.ord);
          return (
            <div key={group.ord} role="group" aria-label={book?.[locale].name} className="mb-3">
              <p className="eyebrow mb-1 px-3">{book?.[locale].name}</p>
              {group.verses.map((r) => {
                const id = `${listId}-${r.vid}`;
                return (
                  <div
                    key={r.vid}
                    id={id}
                    role="option"
                    aria-selected={optionIndex.get(id) === active}
                    tabIndex={-1}
                    onClick={() => openVerse(r.vid)}
                    onMouseMove={() => setActive(optionIndex.get(id) ?? -1)}
                    className={optionClass(id)}
                  >
                    <p className="mb-0.5 text-xs font-semibold text-muted-foreground tabular-nums">
                      {formatRange({ start: r.vid, end: r.spanEnd }, locale)}
                    </p>
                    <Snippet verse={r} lang={lang} />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {data && data.total > data.results.length && trimmed && !ntOnlyMiss && (
        <Button
          variant="outline"
          className="mt-2 self-start"
          onClick={() => setPaging({ key: searchKey, limit: limit + PAGE_SIZE * 4 })}
        >
          {t.search.showMore}
        </Button>
      )}

      {data && data.total === 0 && trimmed && !search.loading && !ntOnlyMiss && !goToRef && (
        <div className="mt-6 flex flex-col items-start gap-3">
          <p className="text-base font-medium">{t.search.noResults(trimmed)}</p>
          {data.suggestion && (
            <p className="text-sm text-muted-foreground">
              {t.search.didYouMean}{" "}
              <button
                type="button"
                lang={lang}
                onClick={() => {
                  if (data.suggestion) {
                    setDraft(data.suggestion);
                    commit(data.suggestion);
                  }
                }}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {data.suggestion}
              </button>
            </p>
          )}
          {bookSuggestion && (
            <Button variant="outline" size="sm" onClick={() => openVerse(makeVerseId(bookSuggestion.ord, 1))}>
              <BookOpen className="size-4" />
              {t.search.openBook(bookSuggestion[locale].short)}
            </Button>
          )}
        </div>
      )}
    </Page>
  );
}
