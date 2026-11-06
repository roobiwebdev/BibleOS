import { bookByCode } from "@starter/bible-core/books";
import { MAX_VERSE } from "@starter/bible-core/reference";
import { z } from "zod";

/**
 * SOURCE OF TRUTH KEYWORDS: ONLINE_TRANSLATIONS, OnlineTranslation, online translation, ESV, NLT, licence, copyright notice, publisher API
 * WHAT:  Every translation the app reads over the internet instead of bundling: who publishes
 *        it, its API terms, the notice that must be shown with it, and the link each page needs.
 * WHY:   The ESV and NLT may not be bundled. Their publishers allow free non-commercial apps to
 *        fetch the text from their APIs with limits on how much is shown and kept, so these are
 *        a separate list from TRANSLATIONS: the bundle build never sees them, and every screen
 *        that shows one can find its notice here. Notices are verbatim from the official pages.
 * WHERE: desktop translation catalogue, online BibleSource, Settings → Translations and
 *        licences, the site relay (apps/site/relay).
 */
export interface OnlineTranslation {
  id: OnlineTranslationId;
  delivery: "online";
  language: "en";
  name: string;
  abbreviation: string;
  scope: "bible";
  licence: { name: string; url: string; commercial: false; shareAlike: false };
  /** Shown verbatim on the Licences page. */
  notice: string;
  sourceUrl: string;
  /** The link every page showing this text must carry. */
  link: { label: string; url: string };
  publisher: string;
}

export const ONLINE_TRANSLATION_IDS = ["en-esv", "en-nlt"] as const;
export type OnlineTranslationId = (typeof ONLINE_TRANSLATION_IDS)[number];

/**
 * SOURCE OF TRUTH KEYWORDS: ONLINE_LIMITS, 500 verses, verse cap, display limit, cache limit
 * WHAT:  The limits both publishers set, applied by the relay (per request) and the app (cache
 *        and how much is on screen at once).
 * WHY:   ESV terms (https://api.esv.org/, checked 2026-11-05):
 *        "You may request up to 500 verses per query, or half a book, whichever is less
 *        (excepting single-chapter and double-chapter books)."
 *        "You may not locally store more than 500 verses or one-half of any book of the Bible
 *        (whichever is less)."
 *        "You may not display more than 500 verses or one-half of any book (whichever is less)
 *        on any page."
 *        "You may only perform 5,000 queries per day, with no more than 1,000 requests in an
 *        hour and no more than 60 requests per minute."
 *        NLT terms (https://api.nlt.to/, key-based use): "No more than 500 verses per request
 *        (this matches the NLT copyright statement)" and "No more than 5000 requests per day".
 *        The NLT terms say nothing about caching, so the app keeps the ESV rule for both.
 * WHERE: relay validation, desktop online source cache, reader chapter window.
 */
export const ONLINE_LIMITS = {
  versesPerRequest: 500,
  versesStored: 500,
  versesShown: 500,
  searchResults: 100,
  searchQueryLength: 100,
} as const;

/**
 * SOURCE OF TRUTH KEYWORDS: ONLINE_RELAY, relay origin, bible.roobi.dev/api/bible, CSP connect-src
 * WHAT:  Where the app reaches the publisher APIs: a relay on the landing page's Vercel project
 *        that holds the API keys.
 * WHY:   API keys must never ship inside the app. The origin must match connect-src in
 *        apps/desktop/src-tauri/tauri.conf.json.
 * WHERE: desktop online source, site relay.
 */
export const ONLINE_RELAY = { origin: "https://bible.roobi.dev", path: "/api/bible" } as const;

export const ONLINE_TRANSLATIONS: readonly OnlineTranslation[] = [
  {
    id: "en-esv",
    delivery: "online",
    language: "en",
    name: "English Standard Version",
    abbreviation: "ESV",
    scope: "bible",
    publisher: "Crossway",
    licence: {
      name: "ESV API, non-commercial use",
      url: "https://api.esv.org/",
      commercial: false,
      shareAlike: false,
    },
    // Verbatim from https://api.esv.org/ ("one of the following", the "marked ESV" form,
    // because the app shows several translations).
    notice:
      "Scripture quotations marked “ESV” are from the ESV® Bible (The Holy Bible, English Standard Version®), " +
      "© 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. All rights reserved. " +
      "The ESV text may not be quoted in any publication made available to the public by a Creative Commons license. " +
      "The ESV may not be translated into any other language.\n\n" +
      "Users may not copy or download more than 500 verses of the ESV Bible or more than one half of any book of the ESV Bible.",
    sourceUrl: "https://api.esv.org/",
    // "Each page on which you use the text must include a link to www.esv.org."
    link: { label: "www.esv.org", url: "https://www.esv.org/" },
  },
  {
    id: "en-nlt",
    delivery: "online",
    language: "en",
    name: "New Living Translation",
    abbreviation: "NLT",
    scope: "bible",
    publisher: "Tyndale House Publishers",
    licence: {
      name: "NLT API, non-commercial use",
      url: "https://api.nlt.to/",
      commercial: false,
      shareAlike: false,
    },
    // Verbatim from Tyndale's Permissions and Fair-Use Guidelines (tyndale.com/permissions),
    // "When multiple translations are being used in a project". Read 2026-11-05 from
    // https://hpgqa.tyndale.com/permissions because www.tyndale.com refuses scripted requests.
    notice:
      "Scripture quotations marked (NLT) are taken from the Holy Bible, New Living Translation, copyright © 1996, 2004, 2015 " +
      "by Tyndale House Ministries. Used by permission. All rights reserved.",
    sourceUrl: "https://api.nlt.to/",
    link: { label: "www.newlivingtranslation.com", url: "https://www.newlivingtranslation.com/" },
  },
];

export const isOnlineTranslationId = (id: string): id is OnlineTranslationId =>
  ONLINE_TRANSLATION_IDS.some((known) => known === id);

export const onlineTranslation = (id: string): OnlineTranslation | undefined =>
  ONLINE_TRANSLATIONS.find((t) => t.id === id);

/**
 * SOURCE OF TRUTH KEYWORDS: relayRequestSchema, RelayRequest, relay query, passage request, search request
 * WHAT:  The only requests the relay accepts, as URL query parameters: one chapter, a verse
 *        range inside one chapter, or a search. Anything else is rejected before a key is used.
 * WHY:   One schema for the app (which builds the URL) and the relay (which checks it), so the
 *        two can never disagree and no request can ask a publisher for more than one chapter.
 * WHERE: desktop online source (relayUrl), site relay handler.
 */
export const relayRequestSchema = z
  .discriminatedUnion("kind", [
    z.object({
      kind: z.literal("chapter"),
      t: z.enum(ONLINE_TRANSLATION_IDS),
      book: z.string().regex(/^[1-3A-Z][A-Z0-9]{2}$/),
      chapter: z.coerce.number().int().min(1).max(150),
    }),
    z.object({
      kind: z.literal("verses"),
      t: z.enum(ONLINE_TRANSLATION_IDS),
      book: z.string().regex(/^[1-3A-Z][A-Z0-9]{2}$/),
      chapter: z.coerce.number().int().min(1).max(150),
      from: z.coerce.number().int().min(1).max(MAX_VERSE),
      to: z.coerce.number().int().min(1).max(MAX_VERSE),
    }),
    z.object({
      kind: z.literal("search"),
      t: z.enum(ONLINE_TRANSLATION_IDS),
      q: z.string().trim().min(2).max(ONLINE_LIMITS.searchQueryLength),
    }),
  ])
  .superRefine((request, ctx) => {
    if (request.kind === "search") return;
    const book = bookByCode(request.book);
    if (!book || book.code !== request.book) {
      ctx.addIssue({ code: "custom", path: ["book"], message: "Unknown book" });
    } else if (request.chapter > book.chapters) {
      ctx.addIssue({ code: "custom", path: ["chapter"], message: "No such chapter" });
    }
    if (request.kind === "verses" && request.to < request.from) {
      ctx.addIssue({ code: "custom", path: ["to"], message: "The range ends before it starts" });
    }
  });

export type RelayRequest = z.infer<typeof relayRequestSchema>;

const headingLevel = z.enum(["s", "ms", "d", "r"]);
const verseStyle = z.enum(["p", "c", "q1", "q2"]);

/**
 * SOURCE OF TRUTH KEYWORDS: relayPassageSchema, relaySearchSchema, relayErrorSchema, RelayErrorCode, relay response
 * WHAT:  The one JSON shape the relay returns for both publishers: verses keyed by canonical
 *        VerseId with their paragraph style, section headings, search hits, or a typed error.
 * WHY:   The ESV and NLT APIs answer in different HTML; the relay turns both into what the
 *        reader already draws, and the app checks every response with these schemas.
 * WHERE: site relay (writer), desktop online source (reader).
 */
export const relayPassageSchema = z.object({
  translation: z.enum(ONLINE_TRANSLATION_IDS),
  verses: z
    .array(
      z.object({
        vid: z.number().int(),
        /** Last verse of a combined verse ("20-21"); absent for a single verse. */
        spanEnd: z.number().int().optional(),
        style: verseStyle,
        text: z.string(),
      }),
    )
    .max(ONLINE_LIMITS.versesPerRequest),
  headings: z.array(z.object({ vid: z.number().int(), level: headingLevel, text: z.string() })),
});
export type RelayPassage = z.infer<typeof relayPassageSchema>;

export const relaySearchSchema = z.object({
  translation: z.enum(ONLINE_TRANSLATION_IDS),
  /** How many verses the publisher found; `results` holds at most ONLINE_LIMITS.searchResults. */
  total: z.number().int().min(0),
  results: z.array(z.object({ vid: z.number().int(), text: z.string() })).max(ONLINE_LIMITS.searchResults),
});
export type RelaySearch = z.infer<typeof relaySearchSchema>;

export const RELAY_ERROR_CODES = ["not-configured", "bad-request", "rate-limited", "upstream", "forbidden"] as const;
export type RelayErrorCode = (typeof RELAY_ERROR_CODES)[number];
export const relayErrorSchema = z.object({ error: z.enum(RELAY_ERROR_CODES), message: z.string() });
