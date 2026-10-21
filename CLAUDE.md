# Project Starter: rules for AI coding agents

Every rule here is mandatory. The "why" behind each rule is in `docs/engineering/`.
`AGENTS.md` points here so every agent reads the same rules.

## 0. How to work

1. **Plan before code.** For any feature, use the `architect-feature` skill. Restate the goal, break it into building blocks, find what already exists, place it at the root, run the security pass, and propose a build order. Get approval before writing implementation code.
2. **Explore cheaply.** Grep for `SOURCE OF TRUTH KEYWORDS` and similar names before reading whole files. Read only what you need.
3. **Reuse before you create.** Never create a type, function, component, constant or pattern without first grepping for an existing one. Duplicates are bugs.
4. **Root cause, not symptoms.** Fix problems where they originate so every caller benefits.
5. **Finish the whole feature.** Never leave a piece half-built. If something is out of scope or blocked, say so explicitly in your handover.
6. **Prove it.** Before handing over, run `pnpm check-types` and `pnpm lint`, plus the tests for what you touched (`pnpm test`). Report real results. Never claim a pass you did not see.
7. **Git belongs to the user.** Suggest a branch per feature and commit points. Do not run git write commands unless asked.

## 1. Architecture: where code goes

```
apps/web            Next.js 16 app (pages, layouts, route handlers, server actions)
apps/native         Expo app (talks to the same tRPC API)
apps/docs           Fumadocs documentation site
packages/db         Drizzle schema, relations, migrations  (database shape only)
packages/core       Server building blocks: settings, secrets, email, storage, payments, notify, logger
packages/auth       Better Auth factory + global roles/permissions
packages/api        tRPC: procedure builder (security checkpoint), routers, services
packages/config     Module registry, branding, themes, shared option lists (no runtime deps)
packages/ui         shadcn/ui primitives + theme tokens (globals.css)
```

Request flow: **UI → server action or tRPC hook → router (business logic) → service / ctx.db (data) → Postgres.**

- **Env is read in exactly one place:** `apps/web/src/server/services.ts` (via `server/env.ts`). Packages receive config and clients as arguments. Never read `process.env` in a package. (Existing exceptions, do not add more: `NODE_ENV` checks in `packages/core/src/logger.ts` and the tRPC error formatter, and the database CLI tooling in `packages/db/drizzle.config.ts` and `src/reset.ts`.)
- **Every data operation goes through a tRPC procedure** from `packages/api/src/trpc.ts`:
  - `publicProcedure()` for anonymous reads and public forms (rate limited by IP, or by user ID when signed in; mutations are audited only if you pass `audit`)
  - `protectedProcedure({ role?, permission?, rateLimit?, audit? })` for signed-in users
  - `adminProcedure()` for admin-only endpoints
    This builder is the security checkpoint. It runs rate limiting, authentication, role and permission checks. For mutations it also opens a transaction and writes the audit row. Never re-implement these checks in a handler.
- **Routers** (`packages/api/src/routers/*.ts`) hold business logic: validation, orchestration, decisions. Name procedures `<router>.<verb>`. Mutations are audited automatically as `entity=<router>, action=<verb>`.
- **Services** (`packages/api/src/services/*.ts`) hold reusable database queries only. No auth, no business rules. Add `import "server-only";` at the top. Import them into routers with `import * as fooService from "../services/foo"`. Trivial one-off queries can live inline in the router using `ctx.db`.
- **Server actions** (`apps/web/src/lib/actions/*.ts`) are thin adapters: `"use server"`, then call `(await api()).<router>.<proc>(input)`. No logic, no direct database access.
- **Server Components** call `await api()` from `@/server/trpc` or the session helpers in `@/server/session`.
- **Client components** use existing server actions, or `useTRPC()` from `@/lib/trpc/client` with TanStack Query.
- **Route handlers** (uploads, webhooks, auth) use `getServices()`. Keep them thin.
- **Next 16 uses `src/proxy.ts`. Never create `middleware.ts`.**

## 2. Single sources of truth (grep these first)

| Concern                                                         | Lives in                                                                     |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Database tables and types                                       | `packages/db/src/schema/*` (`typeof table.$inferSelect`)                     |
| Runtime settings, feature toggles, site modes, integration keys | `app_settings` via `ctx.services.settings` (`packages/core/src/settings.ts`) |
| Which modules exist, nav items                                  | `packages/config/src/modules.ts`                                             |
| Branding defaults                                               | `packages/config/src/branding.ts`                                            |
| Theme presets                                                   | `packages/config/src/themes.ts` + `packages/ui/src/styles/globals.css`       |
| Roles and permissions                                           | `packages/auth/src/permissions.ts`                                           |
| Rate-limit presets                                              | `packages/api/src/lib/rate-limit.ts`                                         |
| Notification tags                                               | `packages/core/src/types.ts`                                                 |
| Feedback categories and statuses                                | `packages/config/src/content.ts`                                             |
| Env variables                                                   | `apps/web/.env.schema` (Varlock). Add new variables here first.              |
| API input/output types for clients                              | `RouterInputs` / `RouterOutputs` from `@starter/api`                         |

## 3. TypeScript (production grade)

- No `any`. No `as` assertions, except `as const` and the `as never` needed for Next typed routes on dynamic hrefs. No `!` non-null assertions. No `@ts-ignore` or `@ts-expect-error`. Narrow `unknown` with type guards, never by casting.
- **Type lookup order:** Drizzle inferred types, then Better Auth `$Infer` (`Session`, `AuthUser` from `@starter/auth`), then router-derived types (`RouterOutputs`), then existing SOT types (grep). Only then write a new type, in the owning package's `types.ts`, with a SOT header.
- Strict config is on (`strict`, `noUncheckedIndexedAccess`). Fix the real type instead of fighting it.

## 4. Validation and security

- **Zod on every input boundary:** every procedure `.input()`, every route handler body, every form.
- Forms use **TanStack Form** (`@tanstack/react-form`) with Zod validators, matching the existing forms.
- Secrets never reach the client. Integration keys are read through `settings.getIntegrationKeys()` (server-only). The admin UI only receives masked values.
- New third-party secrets: add an encrypted column (`SECRET_KEYS` in `packages/core/src/types.ts`), an env fallback in `.env.schema`, and wire it in `services.ts`.
- Escape user text in emails with `escapeHtml`. Sanitize rendered rich text (blog) on the server.
- Never log secrets, tokens or full request bodies. Use `createLogger(scope)` from `@starter/core/logger`.

## 5. Source-of-truth comments

Put this header above every exported, reusable block (functions, components, schemas, services):

```ts
/**
 * SOURCE OF TRUTH KEYWORDS: Symbol1, Symbol2, related words (around 6 to 10)
 * WHAT:  what this is
 * WHY:   why it exists and why it is built this way
 * WHERE: where it is used
 */
```

Inline comments explain outcomes and intent, not syntax. Keep them short.

## 6. UI rules

- Check `packages/ui/src/components` and `apps/web/src/components` before creating a component. Extend or compose instead of duplicating.
- Reused across routes: `apps/web/src/components/<name>` (or `packages/ui` for design-system primitives). Used by one route only: `<route>/_components/`.
- Global components take props and slots. No hardcoded data or copy inside them.
- **Theme tokens only:** `bg-background`, `text-foreground`, `text-muted-foreground`, `bg-card`, `bg-primary`, `border`, and so on. No hex values, no `text-white`, no `bg-[#...]`, no forced `dark` classes.
- When importing shadcn blocks, fix their copy and branding to match the app.
- Complex new components: ask the user for a shadcn block link to use as reference.
- Icons: `lucide-react`.

## 7. Database changes

1. Edit `packages/db/src/schema/*.ts` and update `relations.ts`.
2. Run `pnpm db:generate` to create a SQL migration. Review the SQL, and commit it with the schema change.
3. Run `pnpm db:migrate` to apply it. Use `db:push` only for throwaway prototyping, never for shared databases.
4. Better Auth tables: after changing auth plugins or `additionalFields`, run `pnpm auth:check`. It fails and lists any table or column Better Auth expects that is missing from `packages/db/src/schema`. Add them, then generate a migration.
5. Seeds belong in `apps/web/scripts/seed.ts` and must be idempotent. This is the only allowed script for manual data changes. Ask the user before adding any other script.

## 8. Adding or removing a module

See `docs/engineering/modules.md`. In short, a module is:

- schema file(s)
- a router mounted in `packages/api/src/root.ts`
- pages under `apps/web/src/app/...`
- an entry in `packages/config/src/modules.ts`

Set `enabled: false` to switch a module off. `proxy.ts` then returns 404 for its routes, and its nav entries disappear.

## 9. Commands

```
pnpm bootstrap          first-run setup (env, database, migrate, seed)
pnpm dev                web app on http://localhost:3001
pnpm check              lint + format check + type check + tests
pnpm test:integration   API tests against a real database (needs TEST_DATABASE_URL)
pnpm auth:check         verify the Drizzle schema has every table/column Better Auth expects
pnpm db:generate | db:migrate | db:seed | db:reset | db:studio
pnpm build              production build (web + docs)
```

Keep this file and `docs/engineering/` updated when you change structure, commands or conventions.
