import { addDays, type DayKey } from "@starter/bible-core/calendar";
import { currentStreak, dailyMinutes, weekDots, type DotState } from "@starter/bible-core/habits";
import type { VerseId } from "@starter/bible-core/verse-id";
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
 * SOURCE OF TRUTH KEYWORDS: reading.recordSession, reading.markChapterRead, reading.summary, reading sessions
 * WHAT:  Reading commands: store a focused reading session, mark a chapter read (counting
 *        repeat reads), and summarize minutes, streak and coverage.
 * WHY:   The local day is decided by the UI when the session ends (it knows the reader's time
 *        zone), so habit math works on plain day keys.
 * WHERE: desktop reader (session timer, chapter end), Today, Progress.
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
};
