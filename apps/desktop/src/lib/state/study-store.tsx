import { addDays, dayKeyOf, type DayKey } from "@starter/bible-core/calendar";
import type { SessionLike } from "@starter/bible-core/habits";
import { BOOKS } from "@starter/bible-core/books";
import { overlaps, subtractRange, type VerseRange } from "@starter/bible-core/range";
import { chapterOf, makeVerseId, verseIdFromCode, type VerseId } from "@starter/bible-core/verse-id";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

/**
 * SOURCE OF TRUTH KEYWORDS: StudyStore, useStudy, Highlight, Note, Collection, ReadingSession, HighlightColor, sample study data
 * WHAT:  The reader's personal study data (highlights, notes, journal, collections, reading
 *        sessions, chapters read) and the actions that change it.
 * WHY:   The preview keeps this in memory with realistic sample data so every screen can be
 *        judged with content in it. Shapes match the planned study database (ids, verse ranges
 *        on canonical VerseIds, timestamps), so the backend phase swaps storage, not screens.
 * WHERE: reader (highlights, notes rail), Study, Today, Progress.
 */
export const HIGHLIGHT_COLORS = ["promise", "command", "prayer", "insight", "question"] as const;
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];

export type { VerseRange };

export interface Highlight extends VerseRange {
  id: string;
  color: HighlightColor;
  createdAt: number;
}

export interface Note {
  id: string;
  kind: "note" | "journal";
  title: string;
  body: string;
  tags: string[];
  anchors: VerseRange[];
  createdAt: number;
  updatedAt: number;
}

export interface Collection {
  id: string;
  name: string;
  items: VerseRange[];
}

export interface ReadingSession extends SessionLike {
  vid: VerseId;
}

export interface StudyState {
  highlights: Highlight[];
  notes: Note[];
  collections: Collection[];
  sessions: ReadingSession[];
  chaptersRead: Set<VerseId>;
  lastRead: VerseId;
}

interface StudyContext extends StudyState {
  setHighlight: (range: VerseRange, color: HighlightColor) => void;
  removeHighlight: (range: VerseRange) => void;
  saveNote: (note: Omit<Note, "id" | "createdAt" | "updatedAt"> & { id?: string }) => void;
  /** Removes a note and returns a function that puts it back (for Undo). */
  deleteNote: (id: string) => () => void;
  addToCollection: (collectionId: string, range: VerseRange) => void;
  createCollection: (name: string, first?: VerseRange) => void;
  markRead: (chapterId: VerseId) => void;
}

const v = (code: string, chapter: number, verse = 0): VerseId => verseIdFromCode(code, chapter, verse) ?? 0;
const range = (code: string, chapter: number, start: number, end = start): VerseRange => ({
  start: v(code, chapter, start),
  end: v(code, chapter, end),
});

let nextId = 1;
const newId = () => `local-${nextId++}`;

/** Deterministic pseudo-random numbers so the sample year looks the same on every load. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1_103_515_245 + 12_345) % 2_147_483_648;
    return s / 2_147_483_648;
  };
}

function sampleSessions(today: DayKey): ReadingSession[] {
  const random = seeded(7);
  const sessions: ReadingSession[] = [];
  for (let back = 330; back >= 0; back--) {
    const day = addDays(today, -back);
    const recent = back <= 9;
    // Earlier months are patchier; the last ten days show a steady rhythm with one missed day.
    const reads = recent ? back !== 4 : random() < 0.58 + (back < 120 ? 0.15 : 0);
    if (!reads) continue;
    const minutes = back === 0 ? 9 : Math.round(4 + random() * 30);
    sessions.push({ localDay: day, focusedSeconds: minutes * 60, vid: v("JHN", 3) });
  }
  return sessions;
}

function sampleChaptersRead(): Set<VerseId> {
  const read = new Set<VerseId>();
  const whole = ["MRK", "JHN", "ROM", "GAL", "EPH", "PHP", "COL", "JAS", "1JN", "RUT", "JON"];
  for (const book of BOOKS) {
    const all = whole.includes(book.code);
    const partial =
      book.code === "GEN" ? 25 : book.code === "PSA" ? 60 : book.code === "MAT" ? 14 : book.code === "PRO" ? 10 : 0;
    const upTo = all ? book.chapters : partial;
    for (let c = 1; c <= upTo; c++) read.add(makeVerseId(book.ord, c));
  }
  return read;
}

function sampleState(): StudyState {
  const now = Date.now();
  const day = 86_400_000;
  return {
    highlights: [
      { id: newId(), ...range("JHN", 3, 16), color: "promise", createdAt: now - 20 * day },
      { id: newId(), ...range("JHN", 1, 1), color: "insight", createdAt: now - 40 * day },
      { id: newId(), ...range("JHN", 1, 14), color: "insight", createdAt: now - 39 * day },
      { id: newId(), ...range("PSA", 23, 1), color: "promise", createdAt: now - 12 * day },
      { id: newId(), ...range("PSA", 23, 4), color: "prayer", createdAt: now - 12 * day },
      { id: newId(), ...range("PSA", 91, 1, 2), color: "prayer", createdAt: now - 6 * day },
      { id: newId(), ...range("ROM", 8, 28), color: "insight", createdAt: now - 3 * day },
      { id: newId(), ...range("ROM", 8, 38, 39), color: "promise", createdAt: now - 3 * day },
      { id: newId(), ...range("1CO", 13, 4, 7), color: "command", createdAt: now - 30 * day },
      { id: newId(), ...range("GEN", 1, 1), color: "question", createdAt: now - 60 * day },
    ],
    notes: [
      {
        id: newId(),
        kind: "note",
        title: "Love goes first",
        body: "God's love is not a reward for being lovable. He gave before anyone asked. Compare [[Romans 5:8]] and [[1 John 4:19]].",
        tags: ["love", "gospel"],
        anchors: [range("JHN", 3, 16)],
        createdAt: now - 20 * day,
        updatedAt: now - 2 * day,
      },
      {
        id: newId(),
        kind: "note",
        title: "እረኛዬ",
        body: "«እግዚአብሔር እረኛዬ ነው» — እረኛ መንገዱን ያውቃል፤ በጨለማው ሸለቆም አብሮ ይሄዳል። ከ[[ዮሐ 10፥11]] ጋር አወዳድር።",
        tags: ["trust", "psalms"],
        anchors: [range("PSA", 23, 1, 4)],
        createdAt: now - 12 * day,
        updatedAt: now - 12 * day,
      },
      {
        id: newId(),
        kind: "note",
        title: "All things, not some things",
        body: "Verse 28 doesn't say all things are good. It says God works in all things for good. The chapter ends with nothing able to separate us ([[Romans 8:38-39]]).",
        tags: ["hope", "suffering"],
        anchors: [range("ROM", 8, 28)],
        createdAt: now - 3 * day,
        updatedAt: now - 3 * day,
      },
      {
        id: newId(),
        kind: "note",
        title: "The Word was there",
        body: 'John starts where Genesis starts: "In the beginning". Read with [[Genesis 1:1]].',
        tags: ["gospel", "creation"],
        anchors: [range("JHN", 1, 1, 3)],
        createdAt: now - 40 * day,
        updatedAt: now - 40 * day,
      },
      {
        id: newId(),
        kind: "journal",
        title: "Psalm 91 before the exam",
        body: 'Read Psalm 91 slowly this morning. "Under his wings" stayed with me all day.',
        tags: ["journal"],
        anchors: [range("PSA", 91, 4)],
        createdAt: now - 6 * day,
        updatedAt: now - 6 * day,
      },
    ],
    collections: [
      {
        id: "comfort",
        name: "Comfort",
        items: [range("PSA", 23, 1, 6), range("PSA", 91, 1, 2), range("ROM", 8, 38, 39)],
      },
      {
        id: "memorize",
        name: "Memorize this year",
        items: [range("JHN", 3, 16), range("ROM", 8, 28), range("1CO", 13, 4, 7)],
      },
      { id: "creation", name: "Creation and new creation", items: [range("GEN", 1, 1), range("JHN", 1, 1, 5)] },
    ],
    sessions: sampleSessions(dayKeyOf(new Date())),
    chaptersRead: sampleChaptersRead(),
    lastRead: v("JHN", 3, 14),
  };
}

/** Cuts `range` out of every highlight, keeping the parts before and after it. */
const cutHighlights = (highlights: Highlight[], cut: VerseRange): Highlight[] =>
  highlights.flatMap((h) =>
    overlaps(h, cut)
      ? subtractRange(h, cut).map((piece, i) => ({ ...h, ...piece, id: i === 0 ? h.id : newId() }))
      : [h],
  );

const Context = createContext<StudyContext | null>(null);

export function StudyProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(sampleState);

  // Actions never change identity, so effects and memos can depend on them safely.
  const actions = useMemo<Omit<StudyContext, keyof StudyState>>(
    () => ({
      setHighlight: (r, color) =>
        setState((s) => ({
          ...s,
          highlights: [...cutHighlights(s.highlights, r), { id: newId(), ...r, color, createdAt: Date.now() }],
        })),
      removeHighlight: (r) => setState((s) => ({ ...s, highlights: cutHighlights(s.highlights, r) })),
      saveNote: (input) =>
        setState((s) => {
          const now = Date.now();
          const existing = input.id ? s.notes.find((n) => n.id === input.id) : undefined;
          const note: Note = {
            ...input,
            id: existing?.id ?? newId(),
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
          };
          return { ...s, notes: [note, ...s.notes.filter((n) => n.id !== note.id)] };
        }),
      deleteNote: (id) => {
        let removed: Note | undefined;
        setState((s) => {
          removed = s.notes.find((n) => n.id === id);
          return { ...s, notes: s.notes.filter((n) => n.id !== id) };
        });
        return () =>
          setState((s) => {
            const note = removed;
            return note && !s.notes.some((n) => n.id === note.id) ? { ...s, notes: [note, ...s.notes] } : s;
          });
      },
      addToCollection: (collectionId, r) =>
        setState((s) => ({
          ...s,
          collections: s.collections.map((c) =>
            c.id === collectionId && !c.items.some((i) => i.start === r.start && i.end === r.end)
              ? { ...c, items: [...c.items, r] }
              : c,
          ),
        })),
      createCollection: (name, first) =>
        setState((s) => ({
          ...s,
          collections: [...s.collections, { id: newId(), name, items: first ? [first] : [] }],
        })),
      markRead: (chapterId) =>
        setState((s) => {
          const known = s.chaptersRead.has(chapterId);
          if (known && chapterOf(s.lastRead) === chapterId) return s; // unchanged: no re-render
          return known
            ? { ...s, lastRead: chapterId }
            : { ...s, chaptersRead: new Set([...s.chaptersRead, chapterId]), lastRead: chapterId };
        }),
    }),
    [],
  );
  const value = useMemo<StudyContext>(() => ({ ...state, ...actions }), [state, actions]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useStudy(): StudyContext {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useStudy must be used inside StudyProvider");
  return ctx;
}

export { overlaps };
