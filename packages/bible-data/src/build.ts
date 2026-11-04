import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

import { bookByCode } from "@starter/bible-core/books";
import { normalizeForSearch } from "@starter/bible-core/normalize";
import { makeVerseId } from "@starter/bible-core/verse-id";
import { unzipSync } from "fflate";

import { ARCHIVE_MIRROR, archiveFileName, TRANSLATIONS, type TranslationSource } from "./manifest";
import { TRANSLATION_DB_SCHEMA, TRANSLATION_DB_VERSION } from "./schema";
import { parseUsfm, type UsfmBook } from "./usfm";

/**
 * SOURCE OF TRUTH KEYWORDS: buildBibles, buildTranslation, translation catalog, bible-data build, verify sha256
 * WHAT:  Build step: fetch each pinned archive (local cache, then the project mirror, then
 *        upstream), verify its SHA-256, parse every
 *        USFM book, and write one read-only SQLite file per translation plus catalog.json.
 *        Then compare each translation's verse coverage with the KJV grid and report gaps.
 * WHY:   Scripture ships as data built from verified upstream files, never hand-edited.
 *        A hash mismatch stops the build so an upstream change is reviewed before release.
 * WHERE: `pnpm --filter @starter/bible-data build:bibles [--out <dir>]`; output is bundled by apps/desktop.
 */
const PACKAGE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE_DIR = join(PACKAGE_DIR, ".cache");

export interface CatalogEntry {
  id: string;
  language: TranslationSource["language"];
  name: string;
  abbreviation: string;
  scope: TranslationSource["scope"];
  licence: TranslationSource["licence"];
  notice: string;
  sourceUrl: string;
  file: string;
  sha256: string;
  verses: number;
}

const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

async function download(url: string): Promise<Uint8Array | undefined> {
  try {
    const response = await fetch(url);
    return response.ok ? new Uint8Array(await response.arrayBuffer()) : undefined;
  } catch {
    return undefined;
  }
}

// The first copy whose SHA-256 matches the manifest wins: cache, then mirror, then upstream.
async function fetchArchive(source: TranslationSource): Promise<Uint8Array> {
  const name = archiveFileName(source);
  const cached = join(CACHE_DIR, name);
  if (existsSync(cached)) {
    const bytes = readFileSync(cached);
    if (sha256(bytes) === source.archive.sha256) return bytes;
  }
  const seen: string[] = [];
  for (const url of [`${ARCHIVE_MIRROR}${name}`, source.archive.url]) {
    const bytes = await download(url);
    if (!bytes) {
      seen.push(`${url}: download failed`);
      continue;
    }
    const actual = sha256(bytes);
    if (actual === source.archive.sha256) {
      mkdirSync(CACHE_DIR, { recursive: true });
      writeFileSync(cached, bytes);
      return bytes;
    }
    seen.push(`${url}: SHA-256 ${actual}`);
  }
  throw new Error(
    `${source.id}: no copy matches the pinned SHA-256 ${source.archive.sha256}.\n  ${seen.join("\n  ")}\n` +
      "If upstream changed, review the new file, then update manifest.ts and the mirror.",
  );
}

function readBooks(source: TranslationSource, archive: Uint8Array): UsfmBook[] {
  const files = unzipSync(archive, { filter: (f) => /\.(usfm|sfm)$/i.test(f.name) });
  const decoder = new TextDecoder("utf-8");
  const books: UsfmBook[] = [];
  for (const [name, data] of Object.entries(files)) {
    const book = parseUsfm(decoder.decode(data));
    if (!bookByCode(book.code)) {
      if (!["FRT", "BAK", "GLO", "INT", "OTH", "XXA", "XXB"].includes(book.code)) {
        console.warn(`${source.id}: skipping ${name} (book ${book.code || "?"} is not in the catalogue yet)`);
      }
      continue;
    }
    books.push(book);
  }
  return books;
}

function writeTranslation(source: TranslationSource, books: UsfmBook[], file: string): Set<number> {
  rmSync(file, { force: true });
  const db = new DatabaseSync(file);
  const covered = new Set<number>();
  try {
    db.exec(TRANSLATION_DB_SCHEMA);
    db.exec(`PRAGMA user_version = ${TRANSLATION_DB_VERSION}`);
    db.exec("BEGIN");
    const meta = db.prepare("INSERT INTO meta (key, value) VALUES (?, ?)");
    const entries: Array<[string, string]> = [
      ["id", source.id],
      ["language", source.language],
      ["name", source.name],
      ["abbreviation", source.abbreviation],
      ["scope", source.scope],
      ["licence", JSON.stringify(source.licence)],
      ["notice", source.notice],
      ["source_url", source.sourceUrl],
      ["source_sha256", source.archive.sha256],
      ["versification", "eng"],
    ];
    for (const [key, value] of entries) meta.run(key, value);

    const bookRow = db.prepare("INSERT INTO books (code, ord, name, short_name, chapters) VALUES (?, ?, ?, ?, ?)");
    const verseRow = db.prepare(
      "INSERT INTO verses (vid, span_end, label, style, text, text_norm) VALUES (?, ?, ?, ?, ?, ?)",
    );
    const headingRow = db.prepare("INSERT INTO headings (vid, seq, level, text) VALUES (?, ?, ?, ?)");

    for (const book of books.toSorted((a, b) => (bookByCode(a.code)?.ord ?? 0) - (bookByCode(b.code)?.ord ?? 0))) {
      const info = bookByCode(book.code);
      if (!info) continue;
      const chapters = Math.max(0, ...book.verses.map((v) => v.chapter));
      const own = source.bookNames === "source";
      const name = (own ? (book.title.toc1 ?? book.title.h) : undefined) ?? info[source.language].name;
      const shortName = (own ? (book.title.toc2 ?? book.title.h) : undefined) ?? info[source.language].short;
      bookRow.run(info.code, info.ord, name, shortName, chapters);

      for (const v of book.verses) {
        if (!v.text) continue;
        const vid = makeVerseId(info.ord, v.chapter, v.verse);
        const spanEnd = makeVerseId(info.ord, v.chapter, v.verseEnd);
        const label = v.verseEnd === v.verse ? String(v.verse) : `${v.verse}-${v.verseEnd}`;
        try {
          verseRow.run(vid, spanEnd, label, v.style, v.text, normalizeForSearch(v.text));
        } catch (error) {
          throw new Error(`${source.id}: duplicate verse ${info.code} ${v.chapter}:${v.verse}`, { cause: error });
        }
        for (let n = v.verse; n <= v.verseEnd; n++) covered.add(makeVerseId(info.ord, v.chapter, n));
      }

      const seqByVid = new Map<number, number>();
      for (const h of book.headings) {
        const vid = makeVerseId(info.ord, h.chapter, h.beforeVerse);
        const seq = seqByVid.get(vid) ?? 0;
        seqByVid.set(vid, seq + 1);
        headingRow.run(vid, seq, h.level, h.text);
      }
    }
    db.exec("COMMIT");
    db.exec("VACUUM");
  } finally {
    db.close();
  }
  return covered;
}

/** First few verse ids of a list as "book:chapter:verse", for the build log. */
function showVerses(list: number[]): string {
  return list
    .slice(0, 8)
    .map((vid) => `${Math.floor(vid / 1_000_000)}:${Math.floor((vid % 1_000_000) / 1000)}:${vid % 1000}`)
    .join(", ");
}

function describeGaps(id: string, covered: Set<number>, reference: Set<number>, scope: TranslationSource["scope"]) {
  const inScope = (vid: number) => scope === "bible" || Math.floor(vid / 1_000_000) >= 40;
  const missing = [...reference].filter((vid) => inScope(vid) && !covered.has(vid));
  const extra = [...covered].filter((vid) => !reference.has(vid));

  console.info(
    `  ${id}: ${missing.length} KJV verses not present${missing.length ? ` (${showVerses(missing)}…)` : ""}; ` +
      `${extra.length} extra${extra.length ? ` (${showVerses(extra)}…)` : ""}`,
  );
}

export async function buildBibles(outDir: string): Promise<CatalogEntry[]> {
  mkdirSync(outDir, { recursive: true });
  const catalog: CatalogEntry[] = [];
  const coverage = new Map<string, Set<number>>();

  for (const source of TRANSLATIONS) {
    const archive = await fetchArchive(source);
    const books = readBooks(source, archive);
    const expectedBooks = source.scope === "bible" ? 66 : 27;
    if (books.length !== expectedBooks) {
      throw new Error(`${source.id}: expected ${expectedBooks} books, found ${books.length}`);
    }
    const fileName = `${source.id}.sqlite`;
    const file = join(outDir, fileName);
    const covered = writeTranslation(source, books, file);
    coverage.set(source.id, covered);
    catalog.push({
      id: source.id,
      language: source.language,
      name: source.name,
      abbreviation: source.abbreviation,
      scope: source.scope,
      licence: source.licence,
      notice: source.notice,
      sourceUrl: source.sourceUrl,
      file: fileName,
      sha256: sha256(readFileSync(file)),
      verses: covered.size,
    });
    console.info(`built ${fileName}: ${books.length} books, ${covered.size} verses`);
  }

  writeFileSync(join(outDir, "catalog.json"), `${JSON.stringify(catalog, null, 2)}\n`);

  const kjv = coverage.get("en-kjv");
  // The KJV is the reference grid; if it is incomplete every comparison below is wrong.
  if (kjv?.size !== 31_102) throw new Error(`en-kjv: expected 31,102 verses, found ${kjv?.size ?? 0}`);
  {
    console.info("coverage against the KJV verse grid:");
    for (const source of TRANSLATIONS) {
      const covered = coverage.get(source.id);
      if (covered && source.id !== "en-kjv") describeGaps(source.id, covered, kjv, source.scope);
    }
  }
  return catalog;
}

const outFlag = process.argv.indexOf("--out");
const outArg = outFlag >= 0 ? process.argv[outFlag + 1] : undefined;
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildBibles(resolve(outArg ?? join(PACKAGE_DIR, "dist")));
}
