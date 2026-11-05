import type { IncomingMessage, ServerResponse } from "node:http";

import { createRelay, type RelayEnv } from "./handler";

// The local harness (scripts/relay-dev.mjs) builds a relay with recorded publisher answers.
export { createRelay };

/**
 * SOURCE OF TRUTH KEYWORDS: relayNodeHandler, toNodeHandler, Vercel function entry, ESV_API_KEY, NLT_API_KEY, client IP
 * WHAT:  Adapts the relay (Web Request → Response) to a Node (req, res) function, the shape the
 *        Vercel Node runtime calls. The default export is the deployed /api/bible function.
 * WHY:   The relay itself stays runtime-neutral and testable with plain Request objects. This
 *        file is the only place that reads the environment (the two API keys) and the
 *        caller's IP (Vercel's x-real-ip, else the first x-forwarded-for hop).
 * WHERE: built by scripts/build-vercel.mjs into .vercel/output/functions/api/bible.func; the
 *        local harness in scripts/relay-dev.mjs.
 */
export function toNodeHandler(handle: (request: Request, clientIp: string) => Promise<Response>) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers)) {
      if (typeof value === "string") headers.set(name, value);
      else if (Array.isArray(value)) headers.set(name, value.join(", "));
    }
    const host = headers.get("host") ?? "localhost";
    const ip =
      headers.get("x-real-ip") ??
      headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.socket.remoteAddress ??
      "unknown";
    const response = await handle(new Request(`https://${host}${req.url ?? "/"}`, { method: req.method, headers }), ip);
    res.statusCode = response.status;
    response.headers.forEach((value, name) => res.setHeader(name, value));
    res.end(Buffer.from(await response.arrayBuffer()));
  };
}

export function relayFromEnvironment(env: RelayEnv) {
  return toNodeHandler(createRelay({ env, fetch: globalThis.fetch, now: Date.now }));
}

export default relayFromEnvironment({ ESV_API_KEY: process.env.ESV_API_KEY, NLT_API_KEY: process.env.NLT_API_KEY });
