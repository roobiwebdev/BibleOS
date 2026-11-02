import type { DayKey } from "@starter/bible-core/calendar";
import type { SessionLike } from "@starter/bible-core/habits";
import { overlaps, type VerseRange } from "@starter/bible-core/range";
import { chapterOf, type VerseId } from "@starter/bible-core/verse-id";
import { commands } from "@starter/local-api/api";
import type { Collection } from "@starter/local-api/commands/collections";
import type { Highlight } from "@starter/local-api/commands/highlights";
import type { Note } from "@starter/local-api/commands/notes";
import { HIGHLIGHT_COLORS, type HighlightColor, type NoteKind } from "@starter/local-api/schemas";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { callCommand, CommandFailedError } from "../data/local-api";
import { useToday } from "./clock";

export { HIGHLIGHT_COLORS, overlaps };
export type { Collection, Highlight, HighlightColor, Note, VerseRange };

/** What the note editor hands back: a new note, or an edit when `id` is set. */
export interface NoteDraft {
  id?: string;
  kind: NoteKind;
  title: string;
  body: string;
  tags: string[];
  anchors: VerseRange[];
}

export interface StudyState {
  /** False until the first load from the study database finishes. */
  ready: boolean;
  highlights: Highlight[];
  notes: Note[];
  collections: Collection[];
  /** One entry per day with reading, for the habit engine. */
  sessions: SessionLike[];
  chaptersRead: Set<VerseId>;
  lastRead: VerseId;
}

interface StudyContext extends StudyState {
  setHighlight: (range: VerseRange, color: HighlightColor) => void;
  removeHighlight: (range: VerseRange) => void;
  saveNote: (note: NoteDraft) => void;
  /** Removes a note and returns a function that puts it back (for Undo). */
  deleteNote: (id: string) => () => void;
  addToCollection: (collectionId: string, range: VerseRange) => void;
  createCollection: (name: string, first?: VerseRange) => void;
  markRead: (chapterId: VerseId) => void;
  /** Stores a stretch of focused reading time. */
  recordReading: (session: {
    startedAt: number;
    endedAt: number;
    seconds: number;
    vid: VerseId;
    translationId: string;
    day: DayKey;
  }) => void;
}

const DEFAULT_LAST_READ: VerseId = 43_003_000; // John 3
// The widest range commands accept: every possible verse id.
const EVERYTHING: VerseRange = { start: 1_000_000, end: 999_999_999 };

const Context = createContext<StudyContext | null>(null);

function reportFailure(error: unknown) {
  // The message never contains note text; local-api maps database errors to generic codes.
  console.error("[study]", error instanceof CommandFailedError ? error.failure.code : error);
  toast.error(error instanceof CommandFailedError ? error.failure.message : "Something went wrong saving that.");
}

/**
 * SOURCE OF TRUTH KEYWORDS: StudyProvider, useStudy, study store, highlights, notes, collections, reading history
 * WHAT:  The reader's study data, loaded from the study database through local-api commands,
 *        with actions that run a command and then refresh what it changed.
 * WHY:   Screens keep one simple interface while all reads and writes pass the command
 *        checkpoint (validation, transaction, change log). Data persists in the app; the
 *        browser preview uses an in-memory database filled with sample content.
 * WHERE: reader, Study, Today, Progress, chapter picker.
 */
export function StudyProvider({ children }: { children: ReactNode }) {
  const today = useToday();
  const [state, setState] = useState<StudyState>({
    ready: false,
    highlights: [],
    notes: [],
    collections: [],
    sessions: [],
    chaptersRead: new Set(),
    lastRead: DEFAULT_LAST_READ,
  });

  const fetchReading = useCallback(async () => {
    const summary = await callCommand(commands.reading.summary, { today, days: 400 });
    return {
      sessions: Object.entries(summary.minutesByDay).map(([localDay, m]) => ({ localDay, focusedSeconds: m * 60 })),
      chaptersRead: new Set(summary.chaptersRead),
      lastRead: summary.lastRead ?? DEFAULT_LAST_READ,
    };
  }, [today]);

  const loadHighlights = useCallback(async () => {
    const highlights = await callCommand(commands.highlights.list, { range: EVERYTHING });
    setState((s) => ({ ...s, highlights }));
  }, []);
  const loadNotes = useCallback(async () => {
    const notes = await callCommand(commands.notes.list, { includeDeleted: false, limit: 1000 });
    setState((s) => ({ ...s, notes }));
  }, []);
  const loadCollections = useCallback(async () => {
    const collections = await callCommand(commands.collections.list, {});
    setState((s) => ({ ...s, collections }));
  }, []);
  const loadReading = useCallback(async () => {
    const reading = await fetchReading();
    setState((s) => ({ ...s, ...reading }));
  }, [fetchReading]);

  // First load: read everything from the study database, then show it in one update.
  useEffect(() => {
    let live = true;
    const load = async () => {
      const [highlights, notes, collections, reading] = await Promise.all([
        callCommand(commands.highlights.list, { range: EVERYTHING }),
        callCommand(commands.notes.list, { includeDeleted: false, limit: 1000 }),
        callCommand(commands.collections.list, {}),
        fetchReading(),
      ]);
      if (live) setState({ ready: true, highlights, notes, collections, ...reading });
    };
    load().catch(reportFailure);
    return () => {
      live = false;
    };
  }, [fetchReading]);

  // Run a command, then refresh what it changed. Failures surface as a quiet toast.
  const act = useCallback(
    (task: () => Promise<unknown>, ...reloads: Array<() => Promise<void>>) =>
      void task()
        .then(() => Promise.all(reloads.map((r) => r())))
        .catch(reportFailure),
    [],
  );

  const actions = useMemo<Omit<StudyContext, keyof StudyState>>(
    () => ({
      setHighlight: (range, color) => act(() => callCommand(commands.highlights.set, { range, color }), loadHighlights),
      removeHighlight: (range) => act(() => callCommand(commands.highlights.remove, { range }), loadHighlights),
      saveNote: (draft) => act(() => callCommand(commands.notes.save, draft), loadNotes),
      deleteNote: (id) => {
        act(() => callCommand(commands.notes.delete, { id }), loadNotes);
        return () => act(() => callCommand(commands.notes.restore, { id }), loadNotes);
      },
      addToCollection: (collectionId, range) =>
        act(() => callCommand(commands.collections.addItem, { collectionId, range }), loadCollections),
      createCollection: (name, first) =>
        act(() => callCommand(commands.collections.create, { name, first }), loadCollections),
      markRead: (chapterId) =>
        act(() => callCommand(commands.reading.markChapterRead, { chapterVid: chapterOf(chapterId) }), loadReading),
      recordReading: (s) =>
        act(
          () =>
            callCommand(commands.reading.recordSession, {
              startedAt: s.startedAt,
              endedAt: s.endedAt,
              focusedSeconds: s.seconds,
              localDay: s.day,
              translationId: s.translationId,
              vid: s.vid,
            }),
          loadReading,
        ),
    }),
    [act, loadHighlights, loadNotes, loadCollections, loadReading],
  );

  const value = useMemo<StudyContext>(() => ({ ...state, ...actions }), [state, actions]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useStudy(): StudyContext {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useStudy must be used inside StudyProvider");
  return ctx;
}
