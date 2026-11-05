import { describe, expect, it, vi } from "vitest";

import { fitsOnlineLimits, trimForOnline, type WindowChapter } from "../../features/reader/use-chapter-window";
import { createOnlineSource, createVerseCache, OnlineTextError } from "./online-source";

const JHN = 43;
const vid = (ord: number, chapter: number, verse: number) => ord * 1_000_000 + chapter * 1_000 + verse;

/** A relay answer with `count` verses for one chapter. */
function chapterBody(t: string, ord: number, chapter: number, count: number) {
  return {
    translation: t,
    verses: Array.from({ length: count }, (_, i) => ({
      vid: vid(ord, chapter, i + 1),
      style: "c",
      text: `Verse ${i + 1}.`,
    })),
    headings: [{ vid: vid(ord, chapter, 1), level: "s", text: "Heading" }],
  };
}

/** A fake relay that answers chapters with `versesPerChapter` verses each. */
function relay(versesPerChapter = 30) {
  return vi.fn<typeof fetch>(async (input) => {
    const url = new URL(String(input));
    const p = url.searchParams;
    if (p.get("kind") === "search") {
      return Response.json({
        translation: p.get("t"),
        total: 250,
        results: [
          { vid: vid(1, 1, 2), text: "The earth was without form, and the waters." },
          { vid: vid(JHN, 4, 10), text: "He would have given you living water." },
          { vid: vid(JHN, 7, 38), text: "Rivers of living water will flow." },
        ],
      });
    }
    const chapter = Number(p.get("chapter"));
    const book = p.get("book") === "PSA" ? 19 : JHN;
    if (p.get("kind") === "verses") {
      const from = Number(p.get("from"));
      const to = Number(p.get("to"));
      const body = chapterBody(p.get("t") ?? "", book, chapter, to);
      return Response.json({ ...body, verses: body.verses.slice(from - 1) });
    }
    return Response.json(chapterBody(p.get("t") ?? "", book, chapter, versesPerChapter));
  });
}

describe("createVerseCache", () => {
  it("never keeps more than 500 verses and drops the least recently used first", () => {
    const cache = createVerseCache<string>();
    for (let i = 0; i < 20; i++) cache.set(`c${i}`, `chapter ${i}`, 40);
    expect(cache.size).toBeLessThanOrEqual(500);
    expect(cache.size).toBe(480);
    expect(cache.get("c0")).toBeUndefined();
    expect(cache.get("c19")).toBe("chapter 19");
    // Touching an entry keeps it when the next one pushes others out.
    cache.get("c8");
    cache.set("big", "Psalm 119", 176);
    expect(cache.get("c8")).toBe("chapter 8");
    expect(cache.get("c9")).toBeUndefined();
    expect(cache.size).toBeLessThanOrEqual(500);
  });

  it("does not keep a single entry larger than the cap", () => {
    const cache = createVerseCache<string>(100);
    cache.set("huge", "x", 101);
    expect(cache.get("huge")).toBeUndefined();
    expect(cache.size).toBe(0);
  });
});

describe("createOnlineSource", () => {
  it("loads a chapter from the relay as reader verses keyed by VerseId", async () => {
    const fetch = relay();
    const source = createOnlineSource({ fetch, origin: "https://relay.test" });
    const chapter = await source.getChapter("en-esv", vid(JHN, 3, 0));
    expect(chapter.verses).toHaveLength(30);
    expect(chapter.verses[15]).toEqual({
      vid: vid(JHN, 3, 16),
      spanEnd: vid(JHN, 3, 16),
      label: "16",
      style: "c",
      text: "Verse 16.",
    });
    expect(chapter.headings).toEqual([{ vid: vid(JHN, 3, 1), level: "s", text: "Heading" }]);
    const url = new URL(String(fetch.mock.calls[0]?.[0]));
    expect(url.origin + url.pathname).toBe("https://relay.test/api/bible");
    expect(Object.fromEntries(url.searchParams)).toEqual({ kind: "chapter", t: "en-esv", book: "JHN", chapter: "3" });
  });

  it("serves repeats from memory and shares a request already on its way", async () => {
    const fetch = relay();
    const source = createOnlineSource({ fetch });
    await Promise.all([source.getChapter("en-nlt", vid(JHN, 1, 0)), source.getChapter("en-nlt", vid(JHN, 1, 0))]);
    await source.getChapter("en-nlt", vid(JHN, 1, 0));
    // A verse inside a cached chapter needs no request either.
    expect(await source.getPassage("en-nlt", { start: vid(JHN, 1, 14), end: vid(JHN, 1, 14) })).toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("keeps at most 500 verses per translation however much is read", async () => {
    const source = createOnlineSource({ fetch: relay(40) });
    for (let chapter = 1; chapter <= 21; chapter++) await source.getChapter("en-esv", vid(JHN, chapter, 0));
    expect(source.cachedVerses("en-esv")).toBeLessThanOrEqual(500);
    expect(source.cachedVerses("en-esv")).toBe(480);
    await source.getChapter("en-nlt", vid(JHN, 1, 0));
    expect(source.cachedVerses("en-nlt")).toBe(40);
  });

  it("asks for just the verses of a short passage", async () => {
    const fetch = relay();
    const source = createOnlineSource({ fetch });
    const verses = await source.getPassage("en-esv", { start: vid(JHN, 3, 16), end: vid(JHN, 3, 17) });
    expect(verses.map((v) => v.label)).toEqual(["16", "17"]);
    const params = new URL(String(fetch.mock.calls[0]?.[0])).searchParams;
    expect(Object.fromEntries(params)).toEqual({
      kind: "verses",
      t: "en-esv",
      book: "JHN",
      chapter: "3",
      from: "16",
      to: "17",
    });
  });

  it("reports no connection as offline, and asks again on retry", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValueOnce(new TypeError("Load failed"));
    fetchMock.mockImplementation(relay());
    const source = createOnlineSource({ fetch: fetchMock });
    const failed = source.getChapter("en-esv", vid(JHN, 3, 0));
    await expect(failed).rejects.toBeInstanceOf(OnlineTextError);
    await expect(failed).rejects.toMatchObject({ reason: "offline" });
    expect((await source.getChapter("en-esv", vid(JHN, 3, 0))).verses).toHaveLength(30);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not even try when the system is offline", async () => {
    const fetch = relay();
    const source = createOnlineSource({ fetch, isOffline: () => true });
    await expect(source.getChapter("en-nlt", vid(JHN, 3, 0))).rejects.toMatchObject({ reason: "offline" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    [503, { error: "not-configured", message: "ESV is not configured on this server." }, "not-configured"],
    [429, { error: "rate-limited", message: "Too many" }, "rate-limited"],
    [502, { error: "upstream", message: "x" }, "failed"],
    [404, "<html>Not found</html>", "failed"],
  ])("maps a %i from the relay", async (status, body, reason) => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      typeof body === "string" ? new Response(body, { status }) : Response.json(body, { status }),
    );
    const source = createOnlineSource({ fetch: fetchMock });
    await expect(source.getChapter("en-esv", vid(JHN, 3, 0))).rejects.toMatchObject({ reason });
  });

  it("rejects an answer that is not the relay's shape", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json({ translation: "en-esv", verses: "nope" }));
    await expect(createOnlineSource({ fetch: fetchMock }).getChapter("en-esv", vid(JHN, 3, 0))).rejects.toMatchObject({
      reason: "failed",
    });
  });

  it("refuses bundled translation ids", async () => {
    const fetch = relay();
    await expect(createOnlineSource({ fetch }).getChapter("en-kjv", vid(JHN, 3, 0))).rejects.toBeInstanceOf(
      OnlineTextError,
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("searches online, then applies scope, whole words and highlights locally", async () => {
    const fetch = relay();
    const source = createOnlineSource({ fetch });
    const all = await source.search("en-nlt", "living water", { scope: "all", mode: "partial", limit: 50 });
    expect(all.results.map((r) => r.label)).toEqual(["10", "38"]);
    expect(all.results[0]?.matches.length).toBeGreaterThan(0);
    expect(all.online).toEqual({ total: 250, received: 3 });
    const ot = await source.search("en-nlt", "living water", { scope: "OT", mode: "partial", limit: 50 });
    expect(ot.total).toBe(0);
    // Same words, so the second search came from memory.
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(new URL(String(fetch.mock.calls[0]?.[0])).searchParams.get("q")).toBe("living water");
  });
});

const windowChapter = (ord: number, n: number, verses: number, id = "en-esv"): WindowChapter => ({
  vid: vid(ord, n, 0),
  main: {
    id,
    data: {
      verses: Array.from({ length: verses }, (_, i) => ({
        vid: vid(ord, n, i + 1),
        spanEnd: vid(ord, n, i + 1),
        label: String(i + 1),
        style: "c" as const,
        text: "x",
      })),
      headings: [],
    },
  },
  second: undefined,
});

describe("online display limit in the reader", () => {
  it("allows at most half a book's chapters of an online translation", () => {
    // Ruth has 4 chapters: two may be on screen, not three.
    expect(fitsOnlineLimits([windowChapter(8, 1, 22), windowChapter(8, 2, 23)])).toBe(true);
    expect(fitsOnlineLimits([windowChapter(8, 1, 22), windowChapter(8, 2, 23), windowChapter(8, 3, 18)])).toBe(false);
    // One chapter is always allowed (Jude is one chapter long).
    expect(fitsOnlineLimits([windowChapter(65, 1, 25)])).toBe(true);
    // Bundled text has no limit.
    expect(
      fitsOnlineLimits([
        windowChapter(8, 1, 22, "en-kjv"),
        windowChapter(8, 2, 23, "en-kjv"),
        windowChapter(8, 3, 18, "en-kjv"),
      ]),
    ).toBe(true);
  });

  it("allows at most 500 online verses on screen", () => {
    expect(fitsOnlineLimits([windowChapter(19, 118, 29), windowChapter(19, 119, 176), windowChapter(19, 120, 7)])).toBe(
      true,
    );
    const many = Array.from({ length: 14 }, (_, i) => windowChapter(19, i + 1, 40));
    expect(fitsOnlineLimits(many)).toBe(false);
  });

  it("trims from the side the reader moves away from and keeps the chapter in view", () => {
    const window = [windowChapter(8, 1, 22), windowChapter(8, 2, 23), windowChapter(8, 3, 18)];
    expect(trimForOnline(window, vid(8, 2, 0), 1).map((c) => c.vid)).toEqual([vid(8, 2, 0), vid(8, 3, 0)]);
    expect(trimForOnline(window, vid(8, 1, 0), 1).map((c) => c.vid)).toEqual([vid(8, 1, 0), vid(8, 2, 0)]);
  });
});
