/**
 * SOURCE OF TRUTH KEYWORDS: RouterInputs, RouterOutputs, inferRouterOutputs, API types
 * WHAT:  Input/output types derived from the router, for client code. Never hand-write API types.
 */
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "./root";

export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;
