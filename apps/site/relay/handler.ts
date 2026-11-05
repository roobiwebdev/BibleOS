import { bookByCode } from "@starter/bible-core/books";
import { makeVerseId } from "@starter/bible-core/verse-id";
import {
  relayPassageSchema,
  relayRequestSchema,
  relaySearchSchema,
  type OnlineTranslationId,
  type RelayErrorCode,
  type RelayRequest,
} from "@starter/bible-data/online";

import { esvHeaders, esvPassageUrl, esvSearchUrl, parseEsvPassage, parseEsvSearch } from "./esv";
import { nltPassageUrl, nltSearchUrl, parseNltPassage, parseNltSearch } from "./nlt";
import { createRateLimiter } from "./rate-limit";

/**
 * SOURCE OF TRUTH KEYWORDS: RELAY_ALLOWED_ORIGINS, CORS origins, tauri://localhost, http://tauri.localhost, preview origin
 * WHAT:  The only web origins allowed to call the relay from a browser engine: the desktop app
 *        on macOS/Linux (tauri://localhost) and Windows (http://tauri.localhost), and the desktop
 *        browser preview (http://localhost:1420).
 * WHERE: relay handler (CORS headers, and requests from any other origin are refused).
 */
export const RELAY_ALLOWED_ORIGINS: readonly string[] = [
  "tauri://localhost",
  "http://tauri.localhost",
  "http://localhost:1420",
];

export interface RelayEnv {
  ESV_API_KEY?: string | undefined;
  NLT_API_KEY?: string | undefined;
}

export interface RelayDeps {
  env: RelayEnv;
  fetch: typeof fetch;
  now: () => number;
  /** Abort a publisher call after this long, so a slow API never holds the function open. */
  timeoutMs?: number;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * SOURCE OF TRUTH KEYWORDS: createRelay, handleRelayRequest, Bible API relay, ESV relay, NLT relay, pass-through, no-store
 * WHAT:  The relay between the app and the publisher APIs. It accepts only the requests in
 *        relayRequestSchema, adds the secret key from the environment, calls the publisher,
 *        normalises the answer into one JSON shape and returns it with Cache-Control: no-store.
 * WHY:   Keys must never ship in the app. The relay stores nothing: no text cache, no logs of
 *        text or keys (the NLT key travels in the publisher URL, so URLs are never logged).
 *        Rate limits are per instance (best effort): 30 requests a minute per IP, and each
 *        publisher's own caps (ESV: 60 a minute, 1,000 an hour, 5,000 a day; NLT: 5,000 a day).
 * WHERE: apps/site/relay/vercel.ts (the deployed function), relay tests, the local test harness.
 */
export function createRelay(deps: RelayDeps) {
  const perIp = createRateLimiter({ limit: 30, windowMs: MINUTE });
  const publisher = {
    "en-esv": [
      createRateLimiter({ limit: 60, windowMs: MINUTE }),
      createRateLimiter({ limit: 1_000, windowMs: HOUR }),
      createRateLimiter({ limit: 5_000, windowMs: DAY }),
    ],
    "en-nlt": [createRateLimiter({ limit: 60, windowMs: MINUTE }), createRateLimiter({ limit: 5_000, windowMs: DAY })],
  } satisfies Record<OnlineTranslationId, unknown>;

  const keyFor = (t: OnlineTranslationId) => (t === "en-esv" ? deps.env.ESV_API_KEY : deps.env.NLT_API_KEY)?.trim();

  async function callPublisher(request: RelayRequest, key: string): Promise<unknown> {
    const signal = AbortSignal.timeout(deps.timeoutMs ?? 10_000);
    if (request.t === "en-esv") {
      const url = request.kind === "search" ? esvSearchUrl(request.q) : esvPassageUrl(request);
      const response = await deps.fetch(url, { headers: esvHeaders(key), signal });
      if (!response.ok) throw new PublisherError(response.status);
      const json: unknown = await response.json();
      if (request.kind === "search") return { translation: request.t, ...parseEsvSearch(json) };
      return { translation: request.t, ...parseEsvPassage(json, rangeOf(request)) };
    }
    const url = request.kind === "search" ? nltSearchUrl(request.q, key) : nltPassageUrl(request, key);
    const response = await deps.fetch(url, { signal });
    if (!response.ok) throw new PublisherError(response.status);
    const html = await response.text();
    if (request.kind === "search") return { translation: request.t, ...parseNltSearch(html) };
    return { translation: request.t, ...parseNltPassage(html, request, rangeOf(request)) };
  }

  return async function handle(request: Request, clientIp: string): Promise<Response> {
    const origin = request.headers.get("origin");
    const allowed = origin !== null && RELAY_ALLOWED_ORIGINS.includes(origin);
    const cors: Record<string, string> = allowed ? { "Access-Control-Allow-Origin": origin } : {};
    const reply = (status: number, body: unknown, extra: Record<string, string> = {}) =>
      new Response(JSON.stringify(body), {
        status,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
          Vary: "Origin",
          ...cors,
          ...extra,
        },
      });
    const fail = (status: number, error: RelayErrorCode, message: string, extra?: Record<string, string>) =>
      reply(status, { error, message }, extra);

    // A browser page on any other site may not use the relay (keys and quota are for the app).
    if (origin !== null && !allowed) return fail(403, "forbidden", "This origin may not use the relay.");
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: { ...cors, "Access-Control-Allow-Methods": "GET", "Access-Control-Max-Age": "600", Vary: "Origin" },
      });
    }
    if (request.method !== "GET") return fail(405, "bad-request", "Only GET is allowed.", { Allow: "GET, OPTIONS" });

    const now = deps.now();
    if (!perIp.take(clientIp, now)) {
      return fail(429, "rate-limited", "Too many requests. Try again in a minute.", { "Retry-After": "60" });
    }

    const parsed = relayRequestSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) return fail(400, "bad-request", "Ask for one chapter, verses in one chapter, or a search.");
    const input = parsed.data;

    const key = keyFor(input.t);
    if (!key)
      return fail(503, "not-configured", `${input.t === "en-esv" ? "ESV" : "NLT"} is not configured on this server.`);
    if (!publisher[input.t].every((limiter) => limiter.take("all", now))) {
      return fail(429, "rate-limited", "The publisher's limit is reached for now. Try again later.", {
        "Retry-After": "60",
      });
    }

    try {
      const body = await callPublisher(input, key);
      const checked = input.kind === "search" ? relaySearchSchema.safeParse(body) : relayPassageSchema.safeParse(body);
      if (!checked.success) return fail(502, "upstream", "The publisher sent text the relay could not read.");
      return reply(200, checked.data);
    } catch (error) {
      if (error instanceof PublisherError && error.status === 429) {
        return fail(429, "rate-limited", "The publisher's limit is reached for now. Try again later.", {
          "Retry-After": "60",
        });
      }
      // Status only: URLs carry the NLT key, and bodies carry scripture.
      console.error(
        "relay: publisher call failed",
        input.t,
        error instanceof PublisherError ? error.status : error instanceof Error ? error.name : "unknown",
      );
      return fail(502, "upstream", "The publisher could not be reached.");
    }
  };
}

class PublisherError extends Error {
  constructor(readonly status: number) {
    super(`Publisher answered ${status}`);
  }
}

function rangeOf(request: Extract<RelayRequest, { kind: "chapter" | "verses" }>) {
  const ord = bookByCode(request.book)?.ord ?? 0;
  return request.kind === "verses"
    ? { start: makeVerseId(ord, request.chapter, request.from), end: makeVerseId(ord, request.chapter, request.to) }
    : { start: makeVerseId(ord, request.chapter, 1), end: makeVerseId(ord, request.chapter, 999) };
}
