/**
 * SOURCE OF TRUTH KEYWORDS: api, createServerCaller, server caller, createTRPCContext, RSC data, server actions
 * WHAT:  Calls tRPC procedures directly on the server (no HTTP) for Server Components and server actions.
 * WHY:   Every data operation, including ones triggered from server actions, goes through the
 *        same security checkpoint (rate limit, auth, permission, audit) as HTTP calls.
 * WHERE: server components and lib/actions (server actions).
 */
import "server-only";
import { createContext } from "@starter/api/context";
import { createCaller } from "@starter/api/root";
import { headers } from "next/headers";
import { cache } from "react";

import { getServices } from "./services";

/** One caller per request (React cache dedupes within a render). */
export const api = cache(async () => {
  const ctx = await createContext({ headers: new Headers(await headers()), services: getServices() });
  return createCaller(ctx);
});
