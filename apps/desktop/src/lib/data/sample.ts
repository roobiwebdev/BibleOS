import { BOOKS } from "@starter/bible-core/books";
import { addDays, dayKeyOf } from "@starter/bible-core/calendar";
import { makeVerseId, verseIdFromCode, type VerseId } from "@starter/bible-core/verse-id";
import { commands, type LocalApi } from "@starter/local-api/api";
import type { Command } from "@starter/local-api/command";

/**
 * SOURCE OF TRUTH KEYWORDS: seedSample, sample study data, preview data, demo notes
 * WHAT:  Fills an empty study database with realistic sample notes, highlights, collections,
 *        chapters read and a year of reading sessions, written through the real commands.
 * WHY:   The browser preview should show every screen with content and exercise the same
 *        command path as the app. The real app never runs this; it starts empty.
 * WHERE: lib/data/local-api.ts, browser preview only.
 */
const v = (code: string, chapter: number, verse = 0): VerseId => verseIdFromCode(code, chapter, verse) ?? 0;
const range = (code: string, chapter: number, start: number, end = start) => ({
  start: v(code, chapter, start),
  end: v(code, chapter, end),
});

/** Deterministic pseudo-random numbers so the sample year looks the same on every load. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1_103_515_245 + 12_345) % 2_147_483_648;
    return s / 2_147_483_648;
  };
}

export async function seedSample(api: LocalApi): Promise<void> {
  const run = async <I, O>(command: Command<I, O>, input: I) => {
    const result = await api.run(command, input);
    if (!result.ok) throw new Error(`Sample data failed: ${result.error.code}`);
  };

  const highlights = [
    [range("JHN", 3, 16), "promise"],
    [range("JHN", 1, 1), "insight"],
    [range("JHN", 1, 14), "insight"],
    [range("PSA", 23, 1), "promise"],
    [range("PSA", 23, 4), "prayer"],
    [range("PSA", 91, 1, 2), "prayer"],
    [range("ROM", 8, 28), "insight"],
    [range("ROM", 8, 38, 39), "promise"],
    [range("1CO", 13, 4, 7), "command"],
    [range("GEN", 1, 1), "question"],
  ] as const;
  for (const [r, color] of highlights) await run(commands.highlights.set, { range: r, color });

  const notes = [
    {
      kind: "note",
      title: "Love goes first",
      body: "God's love is not a reward for being lovable. He gave before anyone asked. Compare [[Romans 5:8]] and [[1 John 4:19]].",
      tags: ["love", "gospel"],
      anchors: [range("JHN", 3, 16)],
    },
    {
      kind: "note",
      title: "እረኛዬ",
      body: "«እግዚአብሔር እረኛዬ ነው» — እረኛ መንገዱን ያውቃል፤ በጨለማው ሸለቆም አብሮ ይሄዳል። ከ[[ዮሐ 10፥11]] ጋር አወዳድር።",
      tags: ["trust", "psalms"],
      anchors: [range("PSA", 23, 1, 4)],
    },
    {
      kind: "note",
      title: "All things, not some things",
      body: "Verse 28 doesn't say all things are good. It says God works in all things for good. The chapter ends with nothing able to separate us ([[Romans 8:38-39]]).",
      tags: ["hope", "suffering"],
      anchors: [range("ROM", 8, 28)],
    },
    {
      kind: "note",
      title: "The Word was there",
      body: 'John starts where Genesis starts: "In the beginning". Read with [[Genesis 1:1]].',
      tags: ["gospel", "creation"],
      anchors: [range("JHN", 1, 1, 3)],
    },
    {
      kind: "journal",
      title: "Psalm 91 before the exam",
      body: 'Read Psalm 91 slowly this morning. "Under his wings" stayed with me all day.',
      tags: ["journal"],
      anchors: [range("PSA", 91, 4)],
    },
  ] as const;
  for (const note of notes)
    await run(commands.notes.save, { ...note, tags: [...note.tags], anchors: [...note.anchors] });

  const collections = [
    ["Comfort", [range("PSA", 23, 1, 6), range("PSA", 91, 1, 2), range("ROM", 8, 38, 39)]],
    ["Memorize this year", [range("JHN", 3, 16), range("ROM", 8, 28), range("1CO", 13, 4, 7)]],
    ["Creation and new creation", [range("GEN", 1, 1), range("JHN", 1, 1, 5)]],
  ] as const;
  for (const [name, items] of collections) {
    const created = await api.run(commands.collections.create, { name, first: items[0] });
    if (created.ok)
      for (const item of items.slice(1))
        await run(commands.collections.addItem, { collectionId: created.data.id, range: item });
  }

  const whole = ["MRK", "RUT", "JON", "GAL", "EPH", "PHP", "COL", "JAS", "1JN", "ROM", "JHN"];
  const partial: Record<string, number> = { GEN: 25, PSA: 60, MAT: 14, PRO: 10 };
  for (const book of BOOKS) {
    const upTo = whole.includes(book.code) ? book.chapters : (partial[book.code] ?? 0);
    for (let c = 1; c <= upTo; c++)
      await run(commands.reading.markChapterRead, { chapterVid: makeVerseId(book.ord, c) });
  }
  // Read last (a moment later, so timestamps don't tie), so "continue reading" opens John 3.
  await new Promise((resolve) => setTimeout(resolve, 5));
  await run(commands.reading.markChapterRead, { chapterVid: v("JHN", 3) });

  const random = seeded(7);
  const today = dayKeyOf(new Date());
  for (let back = 330; back >= 0; back--) {
    // Earlier months are patchier; the last ten days show a steady rhythm with one missed day.
    const reads = back <= 9 ? back !== 4 : random() < 0.58 + (back < 120 ? 0.15 : 0);
    if (!reads) continue;
    const minutes = back === 0 ? 9 : Math.round(4 + random() * 30);
    const endedAt = Date.now() - back * 86_400_000;
    await run(commands.reading.recordSession, {
      startedAt: endedAt - minutes * 60_000,
      endedAt,
      focusedSeconds: minutes * 60,
      localDay: addDays(today, -back),
      translationId: "en-bsb",
      vid: v("JHN", 3),
    });
  }
}
