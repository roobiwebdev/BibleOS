import { readFileSync } from "node:fs";
import { createServer } from "node:http";

import { relayRequestSchema } from "@starter/bible-data/online";
import { describe, expect, it, vi } from "vitest";

import { parseEsvPassage, parseEsvSearch, esvPassageUrl } from "./esv";
import { createRelay, type RelayDeps } from "./handler";
import { tokenizeHtml } from "./html";
import { nltPassageUrl, nltReferenceToVerseId, parseNltPassage, parseNltSearch } from "./nlt";
import { toNodeHandler } from "./vercel";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const json = (name: string): unknown => JSON.parse(fixture(name));

const MAT_17 = { start: 40_017_001, end: 40_017_999 };
const chapter = (book: string, n: number) => ({ kind: "chapter" as const, t: "en-nlt" as const, book, chapter: n });

describe("relay request validation", () => {
  it("accepts a chapter, verses in one chapter and a search", () => {
    expect(relayRequestSchema.safeParse({ kind: "chapter", t: "en-esv", book: "JHN", chapter: "3" }).success).toBe(
      true,
    );
    expect(
      relayRequestSchema.safeParse({ kind: "verses", t: "en-nlt", book: "PSA", chapter: "119", from: "1", to: "176" })
        .success,
    ).toBe(true);
    expect(relayRequestSchema.safeParse({ kind: "search", t: "en-esv", q: "living water" }).success).toBe(true);
  });

  it.each([
    ["an unknown translation", { kind: "chapter", t: "en-kjv", book: "JHN", chapter: "3" }],
    ["an unknown book", { kind: "chapter", t: "en-esv", book: "XYZ", chapter: "1" }],
    ["a lowercase book", { kind: "chapter", t: "en-esv", book: "jhn", chapter: "1" }],
    ["a chapter past the book", { kind: "chapter", t: "en-esv", book: "JUD", chapter: "2" }],
    ["a backwards range", { kind: "verses", t: "en-esv", book: "JHN", chapter: "3", from: "9", to: "2" }],
    ["a verse past 176", { kind: "verses", t: "en-esv", book: "PSA", chapter: "119", from: "1", to: "177" }],
    ["a one-letter search", { kind: "search", t: "en-nlt", q: "a" }],
    ["a long search", { kind: "search", t: "en-nlt", q: "x".repeat(101) }],
    ["another call", { kind: "audio", t: "en-esv", q: "John 3" }],
  ])("rejects %s", (_, input) => {
    expect(relayRequestSchema.safeParse(input).success).toBe(false);
  });
});

describe("ESV parsing", () => {
  it("reads the documented example response", () => {
    const passage = parseEsvPassage(json("esv-docs-john-11-35.json"), { start: 43_011_035, end: 43_011_035 });
    expect(passage.verses).toEqual([{ vid: 43_011_035, style: "p", text: "Jesus wept." }]);
  });

  it("keeps headings, paragraphs and poetry lines, and leaves out what the ESV omits", () => {
    const { verses, headings } = parseEsvPassage(json("esv-synthetic-matthew-17.json"), MAT_17);
    expect(verses.map((v) => v.vid)).toEqual([
      40_017_001, 40_017_002, 40_017_003, 40_017_004, 40_017_005, 40_017_020, 40_017_022,
    ]);
    expect(verses[0]).toEqual({ vid: 40_017_001, style: "p", text: "Placeholder words of verse one." });
    // Footnote callouts are dropped without gluing words together.
    expect(verses[1]).toEqual({ vid: 40_017_002, style: "c", text: "Placeholder words of verse two continue here." });
    expect(verses[3]).toEqual({
      vid: 40_017_004,
      style: "q1",
      text: "Verse four first line,\nindented second line of verse four.",
    });
    expect(verses[4]?.style).toBe("q2");
    expect(verses.find((v) => v.vid === 40_017_021)).toBeUndefined();
    expect(verses.at(-1)?.text).toContain("with Lord in small caps.");
    expect(headings).toEqual([
      { vid: 40_017_001, level: "s", text: "Synthetic Heading One" },
      { vid: 40_017_020, level: "s", text: "Synthetic Heading Two" },
    ]);
  });

  it("maps search references to verse ids", () => {
    const result = parseEsvSearch(json("esv-docs-search-rabble.json"));
    expect(result.total).toBe(3);
    expect(result.results.map((r) => r.vid)).toEqual([4_011_004, 18_030_012, 44_017_005]);
  });

  it("asks for HTML without the references, footnotes and copyright line the app replaces", () => {
    const url = new URL(esvPassageUrl({ kind: "chapter", t: "en-esv", book: "SNG", chapter: 2 }));
    expect(url.searchParams.get("q")).toBe("Song of Solomon 2");
    expect(url.searchParams.get("include-footnotes")).toBe("false");
    expect(url.searchParams.get("include-short-copyright")).toBe("false");
  });

  it("asks for the whole book in one-chapter books, where Crossway reads '3 John 1' as one verse", () => {
    const q = (book: string) =>
      new URL(esvPassageUrl({ kind: "chapter", t: "en-esv", book, chapter: 1 })).searchParams.get("q");
    expect(q("3JN")).toBe("3 John");
    expect(q("OBA")).toBe("Obadiah");
    expect(q("GEN")).toBe("Genesis 1");
    const range = esvPassageUrl({ kind: "verses", t: "en-esv", book: "3JN", chapter: 1, from: 1, to: 4 });
    expect(new URL(range).searchParams.get("q")).toBe("3 John 1:1-4");
  });
});

describe("NLT parsing (recorded responses)", () => {
  it("reads Psalm 23 with its titles and poetry lines", () => {
    const { verses, headings } = parseNltPassage(fixture("nlt-psalm-23.html"), chapter("PSA", 23), {
      start: 19_023_001,
      end: 19_023_999,
    });
    expect(verses).toHaveLength(6);
    expect(verses[0]).toEqual({
      vid: 19_023_001,
      style: "q1",
      text: "The Lord is my shepherd;\nI have all that I need.",
    });
    expect(verses[2]?.style).toBe("q2");
    expect(headings).toEqual([
      { vid: 19_023_001, level: "s", text: "The Lord Is My Shepherd" },
      { vid: 19_023_001, level: "d", text: "A psalm of David." },
    ]);
  });

  it("leaves out Matthew 17:21, drops footnotes and keeps the headings in place", () => {
    const { verses, headings } = parseNltPassage(fixture("nlt-matthew-17.html"), chapter("MAT", 17), MAT_17);
    expect(verses).toHaveLength(26);
    expect(verses.some((v) => v.vid === 40_017_021)).toBe(false);
    const v4 = verses.find((v) => v.vid === 40_017_004);
    expect(v4?.style).toBe("p");
    expect(v4?.text).not.toContain("*");
    expect(v4?.text).not.toContain("tabernacles");
    expect(verses.find((v) => v.vid === 40_017_002)?.style).toBe("c");
    expect(headings.map((h) => [h.vid, h.text])).toEqual([
      [40_017_001, "The Transfiguration"],
      [40_017_014, "Jesus Heals a Demon-Possessed Boy"],
      [40_017_022, "Jesus Again Predicts His Death"],
      [40_017_024, "Payment of the Temple Tax"],
    ]);
    for (const verse of verses) expect(verse.text).not.toMatch(/^\d/);
  });

  it("reads John 3 (36 verses)", () => {
    const { verses } = parseNltPassage(fixture("nlt-john-3.html"), chapter("JHN", 3), {
      start: 43_003_001,
      end: 43_003_999,
    });
    expect(verses).toHaveLength(36);
    expect(verses.find((v) => v.vid === 43_003_016)?.text).toMatch(/^“For this is how God loved the world/);
  });

  it("keeps Psalm 119's Hebrew letters as headings, not verse text", () => {
    const { verses, headings } = parseNltPassage(fixture("nlt-psalm-119-1-9.html"), chapter("PSA", 119), {
      start: 19_119_001,
      end: 19_119_009,
    });
    expect(verses).toHaveLength(9);
    expect(verses[0]?.text).toMatch(/^Joyful are people of integrity/);
    expect(verses.find((v) => v.vid === 19_119_009)?.text).toMatch(/^How can a young person/);
    expect(headings.map((h) => [h.vid, h.text])).toEqual(
      expect.arrayContaining([
        [19_119_001, "Aleph"],
        [19_119_009, "Beth"],
      ]),
    );
  });

  it("reads Numbers 1: combined verses and the table of tribes, with every verse accounted for", () => {
    const { verses } = parseNltPassage(fixture("nlt-numbers-1.html"), chapter("NUM", 1), {
      start: 4_001_001,
      end: 4_001_999,
    });
    const covered = verses.flatMap((v) =>
      Array.from({ length: (v.spanEnd ?? v.vid) - v.vid + 1 }, (_, i) => (v.vid % 1000) + i),
    );
    expect(covered).toEqual(Array.from({ length: 54 }, (_, i) => i + 1));
    const verse = (n: number) => verses.find((v) => v.vid === 4_001_000 + n);
    // The table starts inside verse 5 and gives each tribe its own verse and line.
    expect(verse(5)?.text).toBe(
      "“These are the tribes and the names of the leaders who will assist you:\nTribe Leader\nReuben Elizur son of Shedeur",
    );
    expect(verse(6)).toEqual({ vid: 4_001_006, style: "q1", text: "Simeon Shelumiel son of Zurishaddai" });
    expect(verse(10)?.text).toMatch(/^Ephraim son of Joseph Elishama son of Ammihud\nManasseh son of Joseph /);
    expect(verse(20)).toMatchObject({ spanEnd: 4_001_021, text: expect.stringMatching(/^This is the number of men/) });
    expect(verse(21)).toBeUndefined();
    expect(verse(1)?.spanEnd).toBeUndefined();
  });

  it("reads a first verse numbered '4:1' that comes before the chapter heading (1 Samuel 4)", () => {
    const { verses, headings } = parseNltPassage(fixture("nlt-1-samuel-4.html"), chapter("1SA", 4), {
      start: 9_004_001,
      end: 9_004_999,
    });
    expect(verses[0]).toMatchObject({
      vid: 9_004_001,
      text: expect.stringMatching(/^And Samuel’s words went out .* At that time Israel was at war/),
    });
    expect(verses).toHaveLength(22);
    expect(headings[0]).toMatchObject({ vid: 9_004_002, text: "The Philistines Capture the Ark" });
  });

  it("reads search rows and the result count", () => {
    const result = parseNltSearch(fixture("nlt-search-living-water.html"));
    expect(result.total).toBe(24);
    expect(result.results).toHaveLength(24);
    expect(result.results[0]).toEqual({
      vid: 1_001_021,
      text: expect.stringMatching(/^So God created great sea creatures and every living thing/),
    });
  });

  it.each([
    ["2Sam.14.14", 10_014_014],
    ["Pr.3.5", 20_003_005],
    ["Phlm.1.10", 57_001_010],
    ["Song.2.1", 22_002_001],
    ["1John.4.8", 62_004_008],
    ["Nope.1.1", undefined],
  ])("maps %s", (ref, vid) => {
    expect(nltReferenceToVerseId(ref)).toBe(vid);
  });

  it("names books the way the NLT parser accepts", () => {
    const url = new URL(nltPassageUrl({ kind: "verses", t: "en-nlt", book: "1SA", chapter: 3, from: 1, to: 4 }, "K"));
    expect(url.searchParams.get("ref")).toBe("1 Samuel 3:1-4");
    expect(url.searchParams.get("key")).toBe("K");
  });
});

describe("tokenizer", () => {
  it("decodes entities and keeps attributes", () => {
    expect(tokenizeHtml('<b class="x" id=v1>a&nbsp;&amp;&#8217;</b>')).toEqual([
      { kind: "open", tag: "b", attrs: { class: "x", id: "v1" }, selfClosing: false },
      { kind: "text", text: "a &’" },
      { kind: "close", tag: "b" },
    ]);
  });
});

function relay(overrides: Partial<RelayDeps> = {}) {
  const fetchMock = vi.fn<typeof fetch>();
  let clock = 1_000_000;
  const handle = createRelay({
    env: { ESV_API_KEY: "esv-secret", NLT_API_KEY: "nlt-secret" },
    fetch: fetchMock,
    now: () => clock,
    ...overrides,
  });
  return {
    fetchMock,
    advance: (ms: number) => {
      clock += ms;
    },
    get: (query: string, init: { origin?: string; ip?: string; method?: string } = {}) =>
      handle(
        new Request(`https://bible.roobi.dev/api/bible?${query}`, {
          method: init.method ?? "GET",
          headers: init.origin ? { origin: init.origin } : {},
        }),
        init.ip ?? "203.0.113.7",
      ),
  };
}

describe("relay handler", () => {
  it("relays an NLT chapter as normalised JSON with no-store and CORS for the app", async () => {
    const r = relay();
    r.fetchMock.mockResolvedValue(new Response(fixture("nlt-psalm-23.html"), { status: 200 }));
    const response = await r.get("kind=chapter&t=en-nlt&book=PSA&chapter=23", { origin: "tauri://localhost" });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("access-control-allow-origin")).toBe("tauri://localhost");
    const body: unknown = await response.json();
    expect(body).toMatchObject({ translation: "en-nlt", verses: expect.any(Array) });
    const [url] = r.fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain("api.nlt.to/api/passages");
    expect(String(url)).toContain("key=nlt-secret");
  });

  it("sends the ESV key as a header, never in the URL", async () => {
    const r = relay();
    r.fetchMock.mockResolvedValue(Response.json(json("esv-docs-john-11-35.json")));
    const response = await r.get("kind=verses&t=en-esv&book=JHN&chapter=11&from=35&to=35", {
      origin: "http://tauri.localhost",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      translation: "en-esv",
      verses: [{ vid: 43_011_035, style: "p", text: "Jesus wept." }],
      headings: [],
    });
    const [url, init] = r.fetchMock.mock.calls[0] ?? [];
    expect(String(url)).not.toContain("esv-secret");
    expect(new Headers(init?.headers).get("authorization")).toBe("Token esv-secret");
  });

  it("relays an ESV search", async () => {
    const r = relay();
    r.fetchMock.mockResolvedValue(Response.json(json("esv-docs-search-rabble.json")));
    const response = await r.get(`kind=search&t=en-esv&q=${encodeURIComponent("rabble")}`);
    expect(await response.json()).toMatchObject({ translation: "en-esv", total: 3 });
  });

  it("says when a key is not configured, without calling the publisher", async () => {
    const r = relay({ env: { ESV_API_KEY: "esv-secret" } });
    const response = await r.get("kind=chapter&t=en-nlt&book=JHN&chapter=3");
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: "not-configured" });
    expect(r.fetchMock).not.toHaveBeenCalled();
  });

  it("rejects bad input, other methods and other origins before using a key", async () => {
    const r = relay();
    expect((await r.get("kind=chapter&t=en-esv&book=JHN&chapter=99")).status).toBe(400);
    expect((await r.get("kind=chapter&t=en-esv&book=JHN&chapter=3", { method: "POST" })).status).toBe(405);
    const foreign = await r.get("kind=chapter&t=en-esv&book=JHN&chapter=3", { origin: "https://example.com" });
    expect(foreign.status).toBe(403);
    expect(foreign.headers.get("access-control-allow-origin")).toBeNull();
    expect(r.fetchMock).not.toHaveBeenCalled();
  });

  it("answers the CORS preflight for the browser preview", async () => {
    const r = relay();
    const response = await r.get("", { method: "OPTIONS", origin: "http://localhost:1420" });
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:1420");
  });

  it("limits each IP to 30 requests a minute", async () => {
    const r = relay({ env: {} });
    for (let i = 0; i < 30; i++) expect((await r.get("kind=chapter&t=en-esv&book=JHN&chapter=3")).status).toBe(503);
    expect((await r.get("kind=chapter&t=en-esv&book=JHN&chapter=3")).status).toBe(429);
    expect((await r.get("kind=chapter&t=en-esv&book=JHN&chapter=3", { ip: "198.51.100.1" })).status).toBe(503);
    r.advance(60_000);
    expect((await r.get("kind=chapter&t=en-esv&book=JHN&chapter=3")).status).toBe(503);
  });

  it("keeps under the ESV's 60 requests a minute across all callers", async () => {
    const r = relay();
    r.fetchMock.mockImplementation(async () => Response.json(json("esv-docs-john-11-35.json")));
    for (let i = 0; i < 60; i++) {
      expect(
        (await r.get("kind=verses&t=en-esv&book=JHN&chapter=11&from=35&to=35", { ip: `10.0.0.${i}` })).status,
      ).toBe(200);
    }
    expect((await r.get("kind=verses&t=en-esv&book=JHN&chapter=11&from=35&to=35", { ip: "10.0.1.1" })).status).toBe(
      429,
    );
  });

  it("maps publisher failures without leaking the URL", async () => {
    const r = relay();
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    r.fetchMock.mockResolvedValueOnce(new Response("nope", { status: 401 }));
    const failed = await r.get("kind=chapter&t=en-nlt&book=JHN&chapter=3");
    expect(failed.status).toBe(502);
    expect(await failed.json()).toMatchObject({ error: "upstream" });
    expect(JSON.stringify(errors.mock.calls)).not.toContain("nlt-secret");
    r.fetchMock.mockResolvedValueOnce(new Response("slow down", { status: 429 }));
    expect((await r.get("kind=chapter&t=en-nlt&book=JHN&chapter=3")).status).toBe(429);
    r.fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect((await r.get("kind=chapter&t=en-nlt&book=JHN&chapter=3")).status).toBe(502);
    errors.mockRestore();
  });
});

describe("Node adapter", () => {
  it("serves the relay over HTTP with the caller's IP", async () => {
    const seen: string[] = [];
    const server = createServer(
      toNodeHandler(async (request, ip) => {
        seen.push(ip);
        return Response.json({ path: new URL(request.url).search }, { headers: { "Cache-Control": "no-store" } });
      }),
    );
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const port = typeof address === "object" && address !== null ? address.port : 0;
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/bible?kind=search&q=x`, {
        headers: { "x-forwarded-for": "198.51.100.9, 10.0.0.1" },
      });
      expect(await response.json()).toEqual({ path: "?kind=search&q=x" });
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(seen).toEqual(["198.51.100.9"]);
    } finally {
      server.close();
    }
  });
});
