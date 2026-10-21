# Architecture

## The workspace

| Folder            | Job                                                                                         | May depend on               |
| ----------------- | ------------------------------------------------------------------------------------------- | --------------------------- |
| `apps/web`        | Next.js 16 app: pages, layouts, route handlers, server actions. The only place env is read. | every package               |
| `apps/native`     | Expo app. Calls the web app's `/api/auth` and `/api/trpc`.                                  | `@starter/api` (types only) |
| `apps/docs`       | Fumadocs documentation site.                                                                | nothing in the workspace    |
| `packages/api`    | tRPC: the procedure builder, routers, services, rate limit and audit helpers.               | auth, core, db, config      |
| `packages/auth`   | Better Auth factory (`createAuthProvider`) and global roles / permissions.                  | core, db                    |
| `packages/core`   | Server building blocks: settings, secrets, email, storage, payments, notify, logger.        | db                          |
| `packages/db`     | Drizzle schema, relations, migrations, `createDb()`. Database shape only.                   | nothing in the workspace    |
| `packages/config` | Module registry, branding, themes, option lists, base `tsconfig`. No runtime dependencies.  | nothing                     |
| `packages/ui`     | shadcn/ui primitives and theme tokens (`src/styles/globals.css`).                           | nothing in the workspace    |

Packages are TypeScript source (no build step). `apps/web/next.config.ts` lists them in `transpilePackages`.

## Request flow

```
Browser / Expo
   │
   ├─ Server Component ──────────► await api()           (apps/web/src/server/trpc.ts, no HTTP)
   ├─ Client component ──────────► server action          (apps/web/src/lib/actions/*.ts) ──► await api()
   │                     or ─────► useTRPC() hook         (apps/web/src/lib/trpc/client.tsx) ──► /api/trpc
   ├─ Expo app ──────────────────► /api/trpc, /api/auth
   └─ Uploads, webhooks, auth ───► route handlers in apps/web/src/app/api/*  ──► getServices()
                                              │
                                              ▼
                   procedure builder (packages/api/src/trpc.ts)
                   rate limit → sign-in → role / permission → transaction (mutations)
                                              │
                                              ▼
                   router (packages/api/src/routers/*.ts)      business logic
                                              │
                                              ▼
                   service (packages/api/src/services/*.ts) or ctx.db    queries only
                                              │
                                              ▼
                                         Postgres
```

Server Components and server actions call procedures in-process through `createCaller`. The HTTP route at `/api/trpc` serves the same router to client hooks and the Expo app. So every path goes through the same checkpoint.

## The composition root

`apps/web/src/server/services.ts` is the only file that wires the app together. `getServices()` builds this once per process and caches it on `globalThis` (so hot reloads in development do not open new database pools):

| Service    | Built by                                                | Used for                                           |
| ---------- | ------------------------------------------------------- | -------------------------------------------------- |
| `db`       | `createDb()` from `@starter/db`                         | every query                                        |
| `settings` | `createSettingsService()` from `@starter/core/settings` | the `app_settings` row, decrypted integration keys |
| `email`    | `createEmailService()` from `@starter/core/email`       | Resend, or the dev outbox                          |
| `storage`  | `createStorageService()` from `@starter/core/storage`   | R2 uploads and deletes                             |
| `payments` | `createPaymentsService()` from `@starter/core/payments` | Polar products, checkout, webhook                  |
| `getAuth`  | `createAuthProvider()` from `@starter/auth`             | the current Better Auth instance                   |
| `appUrl`   | `BETTER_AUTH_URL`                                       | absolute links                                     |

Who calls `getServices()`:

- `apps/web/src/server/trpc.ts` (the server caller, `api()`)
- `apps/web/src/server/session.ts` (`getSession`, `requireSession`, `requireAdmin`)
- route handlers in `apps/web/src/app/api/*`
- `apps/web/scripts/seed.ts`
- the root layout (for settings used in metadata and the theme)

## Why env is read only in `services.ts`

- **Packages stay portable.** `packages/api` routers run the same way in Next.js, in a test with a fake context, or behind another server. They never assume where config comes from.
- **One place to swap a provider.** To replace R2 or Polar, you change one constructor call.
- **Secrets stay server-side.** `server/env.ts` and `services.ts` import `server-only`, so a client bundle that imports them fails to build.
- **Validation happens once.** Varlock validates `apps/web/.env.schema` when Next.js or `varlock run` starts. `apps/web/src/env.ts` is generated from it.

Known exceptions in the current code: the logger (`packages/core/src/logger.ts`) and the tRPC error formatter (`packages/api/src/trpc.ts`) read `process.env.NODE_ENV`. The database tooling (`packages/db/drizzle.config.ts` and `packages/db/src/reset.ts`) reads the database URLs, because it runs as a CLI outside the app. Do not add new ones.

## Where things live

| You want to...           | Go to                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------- |
| Add a table              | `packages/db/src/schema/*.ts`, then `relations.ts`                                                      |
| Add an API endpoint      | a router in `packages/api/src/routers/`, mounted in `packages/api/src/root.ts`                          |
| Add a reusable query     | `packages/api/src/services/<name>.ts`                                                                   |
| Call the API from a page | `await api()` in a Server Component, or a server action in `apps/web/src/lib/actions/`                  |
| Add a page               | `apps/web/src/app/...`                                                                                  |
| Add a nav entry          | `packages/config/src/modules.ts`                                                                        |
| Add a runtime toggle     | a column in `packages/db/src/schema/app.ts` and the Zod input in `packages/api/src/routers/settings.ts` |
| Add an env variable      | `apps/web/.env.schema`, then `services.ts`                                                              |
| Add a role or permission | `packages/auth/src/permissions.ts`                                                                      |

## Guards outside the procedure builder

- **`apps/web/src/proxy.ts`** runs on every request. It only returns 404 for routes of disabled modules. Next 16 uses `proxy.ts`; never create `middleware.ts`.
- **Layouts** handle redirects that need the session or settings: sign-in required, maintenance mode, email verification and onboarding. Helpers live in `apps/web/src/server/session.ts`.
- **Route handlers** (`/api/upload`, `/api/webhooks/polar`, `/api/auth/[...all]`) check their own auth, because they are not tRPC procedures. The upload route uses the same rate limiter as procedures.
