import { addDays, type DayKey } from "@starter/bible-core/calendar";
import { currentStreak, dailyMinutes, weekDots, type DotState } from "@starter/bible-core/habits";
import { chapterOf, makeVerseId, splitVerseId, type VerseId } from "@starter/bible-core/verse-id";
import { z } from "zod";

import { defineCommand } from "../command";
import { chapterVidSchema, dayKeySchema, verseIdSchema } from "../schemas";
import * as readingService from "../services/reading";
import { loadPreferences } from "./settings";

/**
 * SOURCE OF TRUTH KEYWORDS: ReadingSummary, minutesByDay, streak, weekDots, chaptersRead, lastRead
 * WHAT:  Everything Today and Progress show, computed from stored sessions and chapter reads.
 * WHY:   Daily totals and streaks are derived by bible-core habits from reading_sessions, not
 *        stored twice, so they can never disagree with the sessions.
 * WHERE: reading.summary, desktop Today and Progress pages.
 */
export interface ReadingSummary {
  today: DayKey;
  /** Whole minutes per local day inside the window; days without reading are absent. */
  minutesByDay: Record<DayKey, number>;
  todayMinutes: number;
  goalMinutes: number;
  streak: number;
  weekDots: Array<{ day: DayKey; state: DotState }>;
  /** Chapter VerseIds, most recently read first. */
  chaptersRead: VerseId[];
  lastRead: VerseId | null;
}

/**
 * SOURCE OF TRUTH KEYWORDS: ReadingHistory, HistoryDay, HistoryChapter, ResumePoint, RecentChapters, reading timeline
 * WHAT:  What the History screen shows: reading days (newest first) with the chapters touched,
 *        minutes and translation, where to pick up again, and recently read chapters.
 * WHY:   Derived from reading_sessions and chapter_reads on every call, never stored twice, so
 *        History always agrees with Today and Progress. Day minutes use the same dailyMinutes
 *        rule as the heatmap.
 * WHERE: reading.history, reading.recentChapters, desktop History page.
 */
export interface HistoryChapter {
  chapterVid: VerseId;
  translationId: string;
  /** Whole minutes spent on this chapter that day (a session's time is shared by its chapters). */
  minutes: number;
}
export interface HistoryDay {
  day: DayKey;
  minutes: number;
  /** Chapters in the order they were first opened that day. */
  chapters: HistoryChapter[];
  translations: string[];
  firstStartedAt: number;
  lastEndedAt: number;
}
export interface ResumePoint {
  /** The furthest verse reached in the last session. */
  vid: VerseId;
  translationId: string;
  endedAt: number;
}
export interface ReadingHistory {
  days: HistoryDay[];
  /** Pass as `before` to load older days; null when there are none. */
  nextBefore: DayKey | null;
  /** Only on the first page (no `before`). */
  resume: ResumePoint | null;
}
export interface RecentChapter {
  chapterVid: VerseId;
  lastReadAt: number;
  times: number;
}
export interface RecentChapters {
  items: RecentChapter[];
  nextCursor: string | null;
}

// A session spanning more chapters than this (an import glitch) lists only its ends.
const MAX_CHAPTERS_PER_SESSION = 200;

/** The chapters a session touched, from where it started to the furthest verse reached. */
function chaptersTouched(vidStart: VerseId, vidFurthest: VerseId): VerseId[] {
  const a = splitVerseId(vidStart);
  const b = splitVerseId(Math.max(vidStart, vidFurthest));
  if (a.ord !== b.ord || b.chapter - a.chapter >= MAX_CHAPTERS_PER_SESSION) {
    return [...new Set([chapterOf(vidStart), chapterOf(vidFurthest)])];
  }
  const out: VerseId[] = [];
  for (let c = a.chapter; c <= b.chapter; c++) out.push(makeVerseId(a.ord, c));
  return out;
}

function buildDay(
  day: DayKey,
  sessions: Array<{
    startedAt: number;
    endedAt: number;
    focusedSeconds: number;
    translationId: string;
    vidStart: number;
    vidFurthest: number;
  }>,
): HistoryDay {
  const seconds = new Map<string, { chapterVid: VerseId; translationId: string; seconds: number }>();
  for (const s of sessions) {
    const chapters = chaptersTouched(s.vidStart, s.vidFurthest);
    const share = s.focusedSeconds / chapters.length;
    for (const chapterVid of chapters) {
      const key = `${chapterVid}:${s.translationId}`;
      const entry = seconds.get(key) ?? { chapterVid, translationId: s.translationId, seconds: 0 };
      entry.seconds += share;
      seconds.set(key, entry);
    }
  }
  return {
    day,
    minutes: dailyMinutes(sessions.map((s) => ({ localDay: day, focusedSeconds: s.focusedSeconds }))).get(day) ?? 0,
    chapters: [...seconds.values()].map((c) => ({
      chapterVid: c.chapterVid,
      translationId: c.translationId,
      minutes: Math.round(c.seconds / 60),
    })),
    translations: [...new Set(sessions.map((s) => s.translationId))],
    firstStartedAt: Math.min(...sessions.map((s) => s.startedAt)),
    lastEndedAt: Math.max(...sessions.map((s) => s.endedAt)),
  };
}

const CURSOR = /^(\d{1,15})~([\w-]{1,64})$/;
const encodeCursor = (row: { lastReadAt: number; id: string }) => `${row.lastReadAt}~${row.id}`;
function decodeCursor(cursor: string | undefined): { lastReadAt: number; id: string } | undefined {
  const match = cursor ? CURSOR.exec(cursor) : null;
  return match?.[1] && match[2] ? { lastReadAt: Number(match[1]), id: match[2] } : undefined;
}

/**
 * SOURCE OF TRUTH KEYWORDS: reading.recordSession, reading.markChapterRead, reading.summary, reading sessions
 * WHAT:  Reading commands: store a focused reading session, mark a chapter read (counting
 *        repeat reads), summarize minutes, streak and coverage, and page through history
 *        (days by a `before` day key, recent chapters by an opaque keyset cursor).
 * WHY:   The local day is decided by the UI when the session ends (it knows the reader's time
 *        zone), so habit math works on plain day keys.
 * WHERE: desktop reader (session timer, chapter end), Today, Progress, History.
 */
export const readingCommands = {
  recordSession: defineCommand({
    entity: "reading",
    action: "recordSession",
    kind: "mutation",
    input: z
      .object({
        startedAt: z.number().int().min(0),
        endedAt: z.number().int().min(0),
        focusedSeconds: z.number().int().min(0).max(86_400),
        localDay: dayKeySchema,
        translationId: z.string().min(1).max(64),
        vid: verseIdSchema,
        vidFurthest: verseIdSchema.optional(),
      })
      .refine((s) => s.endedAt >= s.startedAt, { message: "endedAt is before startedAt", path: ["endedAt"] }),
    run: async (ctx, s) => {
      const id = ctx.newId();
      await readingService.insertSession(ctx.db, {
        id,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        focusedSeconds: s.focusedSeconds,
        translationId: s.translationId,
        vidStart: s.vid,
        vidFurthest: Math.max(s.vid, s.vidFurthest ?? s.vid),
        localDay: s.localDay,
        createdAt: ctx.now,
        updatedAt: ctx.now,
      });
      return { id };
    },
    entityId: (s) => s.id,
  }),

  markChapterRead: defineCommand({
    entity: "reading",
    action: "markChapterRead",
    kind: "mutation",
    input: z.object({ chapterVid: chapterVidSchema }),
    run: async (ctx, { chapterVid }) => {
      const existing = await readingService.chapterRead(ctx.db, chapterVid);
      if (existing) {
        await readingService.bumpChapterRead(ctx.db, existing, ctx.now);
        return { id: existing.id, chapterVid, times: existing.times + 1 };
      }
      const id = ctx.newId();
      await readingService.insertChapterRead(ctx.db, {
        id,
        chapterVid,
        firstReadAt: ctx.now,
        lastReadAt: ctx.now,
        times: 1,
        createdAt: ctx.now,
        updatedAt: ctx.now,
      });
      return { id, chapterVid, times: 1 };
    },
    entityId: (r) => r.id,
  }),

  summary: defineCommand({
    entity: "reading",
    action: "summary",
    kind: "query",
    input: z.object({ today: dayKeySchema, days: z.number().int().min(7).max(3_660).default(400) }),
    run: async (ctx, { today, days }): Promise<ReadingSummary> => {
      const prefs = await loadPreferences(ctx.db);
      const sessions = await readingService.sessionsSince(ctx.db, addDays(today, -(days - 1)));
      const minutes = dailyMinutes(sessions);
      const chapters = (await readingService.chaptersRead(ctx.db)).map((c) => c.chapterVid);
      return {
        today,
        minutesByDay: Object.fromEntries(minutes),
        todayMinutes: minutes.get(today) ?? 0,
        goalMinutes: prefs.goalMinutes,
        streak: currentStreak(minutes, today, prefs.rules),
        weekDots: weekDots(minutes, today, prefs.rules),
        chaptersRead: chapters,
        lastRead: chapters[0] ?? null,
      };
    },
  }),

  history: defineCommand({
    entity: "reading",
    action: "history",
    kind: "query",
    input: z.object({ before: dayKeySchema.optional(), limit: z.number().int().min(1).max(90).default(14) }),
    run: async (ctx, { before, limit }): Promise<ReadingHistory> => {
      const page = await readingService.sessionDays(ctx.db, before, limit + 1);
      const days = page.slice(0, limit);
      const byDay = Map.groupBy(await readingService.sessionsOnDays(ctx.db, days), (s) => s.localDay);
      const latest = before ? undefined : await readingService.latestSession(ctx.db);
      return {
        days: days.flatMap((day) => {
          const sessions = byDay.get(day);
          return sessions ? [buildDay(day, sessions)] : [];
        }),
        nextBefore: page.length > limit ? (days.at(-1) ?? null) : null,
        resume: latest
          ? { vid: latest.vidFurthest, translationId: latest.translationId, endedAt: latest.endedAt }
          : null,
      };
    },
  }),

  recentChapters: defineCommand({
    entity: "reading",
    action: "recentChapters",
    kind: "query",
    input: z.object({
      cursor: z.string().regex(CURSOR).optional(),
      limit: z.number().int().min(1).max(200).default(12),
    }),
    run: async (ctx, { cursor, limit }): Promise<RecentChapters> => {
      const rows = await readingService.recentChapterReads(ctx.db, decodeCursor(cursor), limit + 1);
      const items = rows.slice(0, limit);
      const last = items.at(-1);
      return {
        items: items.map((r) => ({ chapterVid: r.chapterVid, lastReadAt: r.lastReadAt, times: r.times })),
        nextCursor: rows.length > limit && last ? encodeCursor(last) : null,
      };
    },
  }),
};
