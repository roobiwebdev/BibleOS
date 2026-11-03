import type { Locale } from "@starter/bible-core/books";
import type { CalendarSystem } from "@starter/bible-core/calendar";
import { DEFAULT_STREAK_RULES } from "@starter/bible-core/habits";
import type { VerseRange } from "@starter/bible-core/range";
import { z } from "zod";

/**
 * SOURCE OF TRUTH KEYWORDS: verseIdSchema, verseRangeSchema, chapterVidSchema, dayKeySchema, input limits
 * WHAT:  Zod schemas for the values every command shares: canonical VerseIds, inclusive
 *        verse ranges, chapter ids and local day keys, plus the size limits.
 * WHY:   The desktop has no rate limits; size caps are the protection against bad input and
 *        bad imports (plan §6). One definition keeps every command's limits identical.
 * WHERE: src/commands/*.ts, backup import.
 */
export const LIMITS = {
  title: 200,
  noteBody: 100_000,
  tags: 32,
  tagName: 40,
  anchors: 50,
  collectionName: 120,
  listLimit: 1_000,
  /** Characters in a backup JSON file (about 50 MB). */
  backupChars: 50_000_000,
  /** Rows per table in a backup. */
  backupRows: 500_000,
} as const;

// Largest VerseId: book ord < 1000 (extension books included), chapter < 1000, verse < 1000.
export const verseIdSchema = z.number().int().min(1_000_000).max(999_999_999);

export const verseRangeSchema = z
  .object({ start: verseIdSchema, end: verseIdSchema })
  .refine((r) => r.start <= r.end, { message: "start must not be after end", path: ["end"] });

/** A chapter's VerseId (verse 0). */
export const chapterVidSchema = verseIdSchema.refine((v) => v % 1000 === 0, { message: "Not a chapter id" });

export const dayKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

/**
 * SOURCE OF TRUTH KEYWORDS: HIGHLIGHT_COLORS, HighlightColor, highlightColorSchema, isHighlightColor
 * WHAT:  The highlight colour keys (meaning-based: promise, command, prayer, insight, question).
 * WHY:   Stored as text keys in highlights.color; a highlight_colors table arrives with custom
 *        colours. The desktop study store should import this list instead of keeping its own.
 * WHERE: highlights commands, backup import, desktop reader (after wiring).
 */
export const HIGHLIGHT_COLORS = ["promise", "command", "prayer", "insight", "question"] as const;
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];
export const highlightColorSchema = z.enum(HIGHLIGHT_COLORS);
export function isHighlightColor(value: string): value is HighlightColor {
  return HIGHLIGHT_COLORS.some((c) => c === value);
}

export const NOTE_KINDS = ["note", "journal", "reflection"] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];
export const noteKindSchema = z.enum(NOTE_KINDS);
export function isNoteKind(value: string): value is NoteKind {
  return NOTE_KINDS.some((k) => k === value);
}

const LOCALES = ["en", "am"] as const satisfies readonly Locale[];
const CALENDARS = ["gregorian", "ethiopian"] as const satisfies readonly CalendarSystem[];
export const THEME_IDS = ["system", "paper", "sepia", "night"] as const;
export const ACCENTS = ["ink", "forest", "clay", "plum", "teal", "gold"] as const;
export const LINE_WIDTH_IDS = ["narrow", "normal", "wide"] as const;

/**
 * SOURCE OF TRUTH KEYWORDS: preferencesSchema, Preferences, DEFAULT_PREFERENCES, preferencesPatchSchema, settings schema, StreakRules
 * WHAT:  The reader's preferences as stored under settings key "app", with their defaults.
 * WHY:   The settings table holds JSON, so this schema is what makes it typed and safe. The
 *        shape matches apps/desktop preferences.tsx (Preferences, DEFAULTS); the desktop should
 *        switch to these exports when it moves to the database.
 * WHERE: settings.get/set, reading.summary (goal and streak rules), backup import.
 */
export const preferencesSchema = z.object({
  locale: z.enum(LOCALES),
  calendar: z.enum(CALENDARS),
  theme: z.enum(THEME_IDS),
  accent: z.enum(ACCENTS),
  /** Scripture size in px. */
  textSize: z.number().int().min(12).max(40),
  lineSpacing: z.number().min(1).max(2.5),
  lineWidth: z.enum(LINE_WIDTH_IDS),
  mainTranslation: z.string().min(1).max(64),
  parallelTranslation: z.string().min(1).max(64),
  parallel: z.boolean(),
  focusMode: z.boolean(),
  notesRail: z.boolean(),
  goalMinutes: z.number().int().min(1).max(600),
  rules: z.object({
    gracePerWeek: z.number().int().min(0).max(3),
    restWeekdays: z.array(z.number().int().min(0).max(6)).max(7),
    weekStartsOn: z.number().int().min(0).max(6),
  }),
});
export type Preferences = z.output<typeof preferencesSchema>;
export const preferencesPatchSchema = preferencesSchema.partial().strict();

export const DEFAULT_PREFERENCES: Preferences = {
  locale: "en",
  calendar: "gregorian",
  // Warm sepia paper is the house look; "system" (follow macOS light/dark) stays a choice.
  theme: "sepia",
  accent: "ink",
  textSize: 19,
  lineSpacing: 1.65,
  lineWidth: "normal",
  mainTranslation: "en-bsb",
  parallelTranslation: "am-1962-nt",
  parallel: true,
  focusMode: false,
  notesRail: true,
  goalMinutes: 15,
  rules: { ...DEFAULT_STREAK_RULES, restWeekdays: [...DEFAULT_STREAK_RULES.restWeekdays] },
};

export function rangeOf(row: { startVid: number; endVid: number }): VerseRange {
  return { start: row.startVid, end: row.endVid };
}
