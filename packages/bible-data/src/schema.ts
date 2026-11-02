/**
 * SOURCE OF TRUTH KEYWORDS: TRANSLATION_DB_SCHEMA, TRANSLATION_DB_VERSION, translation database, verses table, headings table, VerseStyle
 * WHAT:  The layout of one read-only translation database (one .sqlite file per translation).
 * WHY:   The build writes it and the desktop app reads it; both must agree on one definition.
 *        Verses are keyed by canonical VerseId so study data and parallel view never depend on
 *        a translation. Merged verses ("24-26") are one row at the first id with span_end and
 *        label set. text_norm is the search copy (see bible-core normalizeForSearch).
 * WHERE: build.ts (writer), desktop translation store (reader), tests.
 */
export const TRANSLATION_DB_VERSION = 1;

export const TRANSLATION_DB_SCHEMA = `
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE books (
  code TEXT PRIMARY KEY,
  ord INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  chapters INTEGER NOT NULL
);
CREATE TABLE verses (
  vid INTEGER PRIMARY KEY,
  span_end INTEGER NOT NULL,
  label TEXT NOT NULL,
  style TEXT NOT NULL,
  text TEXT NOT NULL,
  text_norm TEXT NOT NULL
);
CREATE TABLE headings (
  vid INTEGER NOT NULL,
  seq INTEGER NOT NULL,
  level TEXT NOT NULL,
  text TEXT NOT NULL,
  PRIMARY KEY (vid, seq)
);
`;

/**
 * How a verse starts on the page: "p" new paragraph, "c" continues the paragraph,
 * "q1"/"q2" poetry indent levels.
 */
export type VerseStyle = "p" | "c" | "q1" | "q2";

/** Heading kinds: "s" section, "ms" major section, "d" psalm title, "r" parallel passage note. */
export type HeadingLevel = "s" | "ms" | "d" | "r";
