import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { TRANSLATIONS } from "./manifest";

/**
 * SOURCE OF TRUTH KEYWORDS: exportPreview, preview bible files, per-book JSON, browser preview data
 * WHAT:  Writes every translation as one JSON file per book (<out>/<translation>/<book ord>.json),
 *        each mapping chapter id → { verses, headings }, read from the built translation databases.
 * WHY:   The browser preview of the desktop app has no SQLite access. Per-book files let it
 *        load only the book being read, so the whole Bible is available without a large download.
 * WHERE: `pnpm --filter @starter/bible-data export:preview --from <db dir> --out <dir>`,
 *        run by the desktop `bibles` script; read by apps/desktop/src/lib/bible/source.ts.
 */
function flag(name: string): string | undefined {
  const at = process.argv.indexOf(name);
  return at >= 0 ? process.argv[at + 1] : undefined;
}

const from = resolve(flag("--from") ?? "dist");
const out = resolve(flag("--out") ?? "dist/preview");
rmSync(out, { recursive: true, force: true });

for (const translation of TRANSLATIONS) {
  const db = new DatabaseSync(join(from, `${translation.id}.sqlite`), { readOnly: true });
  const verses = db.prepare(
    "SELECT vid, span_end AS spanEnd, label, style, text FROM verses WHERE vid BETWEEN ? AND ? ORDER BY vid",
  );
  const headings = db.prepare("SELECT vid, level, text FROM headings WHERE vid BETWEEN ? AND ? ORDER BY vid, seq");
  const books = db.prepare("SELECT ord, chapters FROM books ORDER BY ord").all();
  mkdirSync(join(out, translation.id), { recursive: true });

  for (const book of books) {
    const ord = Number(book.ord);
    const chapters: Record<string, { verses: unknown[]; headings: unknown[] }> = {};
    for (let chapter = 1; chapter <= Number(book.chapters); chapter++) {
      const start = ord * 1_000_000 + chapter * 1000;
      chapters[start] = {
        verses: verses.all(start, start + 999).map((row) => ({ ...row })),
        headings: headings.all(start, start + 999).map((row) => ({ ...row })),
      };
    }
    writeFileSync(join(out, translation.id, `${ord}.json`), JSON.stringify(chapters));
  }
  db.close();
  console.info(`exported ${translation.id}: ${books.length} books`);
}
