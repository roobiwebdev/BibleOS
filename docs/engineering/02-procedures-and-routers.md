# Procedures and routers

Every data operation is a tRPC procedure. Procedures are built from three functions in `packages/api/src/trpc.ts`. This file is the security checkpoint. Never call `initTRPC` anywhere else.

## The three builders

| Builder                     | Who can call                | Default rate limit                     | Audit on mutations           |
| --------------------------- | --------------------------- | -------------------------------------- | ---------------------------- |
| `publicProcedure(opts?)`    | anyone                      | `RATE_LIMITS.default` (120 per minute) | off, unless you pass `audit` |
| `protectedProcedure(opts?)` | signed-in, not banned       | `RATE_LIMITS.default`                  | on                           |
| `adminProcedure(opts?)`     | signed-in with role `admin` | `RATE_LIMITS.default`                  | on                           |

`adminProcedure(opts)` is `protectedProcedure({ ...opts, role: "admin" })`.

### Options

```ts
type ProcedureOptions = {
  role?: "admin"; // global role from the Better Auth admin plugin
  permission?: PermissionCheck; // e.g. { project: ["update"] } from packages/auth/src/permissions.ts
  rateLimit?: RateLimitRule; // e.g. RATE_LIMITS.publicForm, or { max: 3, windowSec: 60 }
  audit?: false | { entity?: string; action?: string; describe?: string };
};
```

`publicProcedure` accepts only `rateLimit` and `audit`.

### What runs, in order

1. **Rate limit.** The key is `<procedure path>:<user id>`, or the IP address for anonymous calls. Over the limit: `TOO_MANY_REQUESTS`.
2. **Sign-in** (protected and admin). No session: `UNAUTHORIZED`. Banned user: `FORBIDDEN`.
3. **Role and permission.** Wrong role: `FORBIDDEN`. A `permission` is checked with Better Auth's `userHasPermission`. Missing: `FORBIDDEN`.
4. **Transaction** (mutations only, all three builders). Your handler receives `ctx.db` already bound to the transaction.
5. **Your handler.**
6. **Audit row** (mutations, unless `audit: false`). Written inside the same transaction.
7. **Commit.** If the handler throws, the change and the audit row roll back together.

Queries do not open a transaction and are never audited.

### Errors

Throw `TRPCError` from `@trpc/server` with a clear code (`BAD_REQUEST`, `NOT_FOUND`, `FORBIDDEN`, `CONFLICT`). In production, `INTERNAL_SERVER_ERROR` messages are replaced with "Something went wrong" and stack traces are removed. Zod failures come back as `data.zodError` (flattened), so forms can show field errors.

## Routers

A router is a file in `packages/api/src/routers/` that exports `<name>Router`. Mount it in `packages/api/src/root.ts`:

```ts
export const appRouter = router({
  health: publicProcedure().query(() => ({ ok: true, time: new Date() })),
  settings: settingsRouter,
  admin: adminRouter,
  // ...
});
```

Routers hold business logic: input validation, decisions, orchestration. `packages/api/src/routers/settings.ts` is a complete example. It shows:

- a curated public read (`settings.public`) that never exposes secrets
- admin reads and writes (`settings.adminGet`, `settings.update`)
- masked secrets (`settings.apiKeys`) and a write that ignores masked values (`settings.saveApiKeys`)
- an explicit audit name (`audit: { entity: "settings", action: "updateApiKeys" }`) and an opt-out (`audit: false` on `testStorage`)

### Naming and the audit convention

Name procedures `<router>.<verb>`: `blog.create`, `notifications.markRead`, `waitlist.join`.

The audit row's `entity` and `action` come from the procedure path. The first segment becomes `entity`, the rest becomes `action`:

| Procedure path                                                                       | entity     | action          |
| ------------------------------------------------------------------------------------ | ---------- | --------------- |
| `blog.create`                                                                        | `blog`     | `create`        |
| `settings.saveApiKeys` with `audit: { entity: "settings", action: "updateApiKeys" }` | `settings` | `updateApiKeys` |

`entityId` is taken from `id` on the handler's return value, or else from `id` on the input, when it is a string. So return `{ id }` from create and update handlers.

Pass `audit: false` for noisy, low-value mutations (for example `notifications.markRead`).

### Input validation

Every procedure that takes input uses `.input(zodSchema)`. Export the schema when a form or another router needs it (`settingsUpdateInput`, `apiKeysInput`, `waitlistJoinInput`).

## Services

Services live in `packages/api/src/services/<name>.ts`. They hold reusable database queries and nothing else: no auth, no business rules.

```ts
import "server-only";
import { schema, type DbExecutor } from "@starter/db";

export async function listPosts(db: DbExecutor, opts: { published: boolean | null; limit: number; offset: number }) { ... }
```

Rules:

- Start with `import "server-only";`.
- Take `db: DbExecutor` as the first argument, so the router can pass `ctx.db` (which is the open transaction inside a mutation).
- Import into routers as a namespace: `import * as blogService from "../services/blog";`.
- Pure helpers with no database access go in a separate file (for example `services/blog-utils.ts`) so they can be unit tested without a database.
- A one-off query can stay inline in the router with `ctx.db`.

## How the web app calls procedures

### Server Components

```ts
import { api } from "@/server/trpc";

export default async function Page() {
  const settings = await (await api()).settings.public();
  // ...
}
```

`api()` builds a caller for the current request (cached per render with React `cache`). There is no HTTP round trip, but the call still goes through the checkpoint.

### Server actions

Server actions in `apps/web/src/lib/actions/*.ts` are thin adapters. They contain no logic and no direct database access:

```ts
"use server";
import type { RouterInputs } from "@starter/api";
import { api } from "@/server/trpc";

export async function updateAppSettings(input: RouterInputs["settings"]["update"]) {
  return (await api()).settings.update(input);
}
```

Most screens ported from Batman call server actions, because that is how Batman was written.

### Client components with `useTRPC`

New client code can call the API directly with typed hooks from `@/lib/trpc/client`:

```tsx
"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";

export function UnreadBadge() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data } = useQuery(trpc.notifications.unreadCount.queryOptions());
  const markAll = useMutation(
    trpc.notifications.markAllRead.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: trpc.notifications.pathKey() }),
    }),
  );
  // ...
}
```

The provider (`TRPCReactProvider`) is mounted by `apps/web/src/components/providers.tsx`. It uses `httpBatchLink` to `/api/trpc` with `superjson`, so `Date` values survive the trip.

### Types for client code

Never hand-write API types. Use:

```ts
import type { RouterInputs, RouterOutputs } from "@starter/api";
type PublicSettings = RouterOutputs["settings"]["public"];
```

## Route handlers

Some endpoints are not procedures: `/api/auth/[...all]` (Better Auth), `/api/trpc/[trpc]`, `/api/upload` and `/api/webhooks/polar`. They use `getServices()` and must do their own checks. `/api/upload` is the model: it checks the session, calls `consumeRateLimit`, validates the body, then calls the storage service.

## Tests

`packages/api/src/trpc.test.ts` tests the builder against a real database: anonymous calls are rejected, non-admins are blocked, a failed mutation rolls back its write and its audit row, and rate limits apply. It is skipped unless `TEST_DATABASE_URL` points at a migrated database:

```bash
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:54329/project_starter pnpm test:integration
```
