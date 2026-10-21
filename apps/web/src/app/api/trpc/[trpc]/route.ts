/**
 * SOURCE OF TRUTH KEYWORDS: trpc route, fetchRequestHandler, /api/trpc, HTTP API, native client
 * WHAT:  Serves the tRPC API over HTTP for client components and the Expo app.
 */
import { createContext } from "@starter/api/context";
import { appRouter } from "@starter/api/root";
import { createLogger } from "@starter/core/logger";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { getServices } from "@/server/services";

const log = createLogger("trpc");

function handler(req: Request) {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createContext({ headers: req.headers, services: getServices() }),
    onError: ({ path, error }) => {
      if (error.code === "INTERNAL_SERVER_ERROR") log.error("procedure failed", { path: path ?? "unknown" }, error);
    },
  });
}

export { handler as GET, handler as POST };
