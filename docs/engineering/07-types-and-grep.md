# Types and grep

## Type lookup order

When you need a type, check these in order. Write a new type only when none of them fits.

### 1. Drizzle inferred types (anything the database describes)

```ts
import type { schema } from "@starter/db";

type Post = typeof schema.post.$inferSelect; // a row as read
type NewPost = typeof schema.post.$inferInsert; // a row as inserted
```

Some are already named. Reuse them: `AppSettings` and `AppSettingsInsert` in `packages/core/src/types.ts`, `AuditMetadata` in `packages/db/src/schema/content.ts`.

Database client types live in `@starter/db`: `Database` (the root client), `DbTransaction`, and `DbExecutor` (either one). Services take `DbExecutor`.

### 2. Better Auth `$Infer` (anything Better Auth owns)

```ts
import type { Session, AuthUser } from "@starter/auth";
// Session  = Auth["$Infer"]["Session"]   ({ session, user })
// AuthUser = Session["user"]             (includes role, banned, bio, onboardingCompleted)
```

These follow the auth config. Add a plugin or a user field and the types update.

Permission types also come from `@starter/auth`: `PermissionCheck`, `GlobalRole`, `Statement`.

### 3. Router-derived types (anything the API returns or accepts)

```ts
import type { RouterInputs, RouterOutputs } from "@starter/api";

type PublicSettings = RouterOutputs["settings"]["public"];
type SettingsPatch = RouterInputs["settings"]["update"];
```

Change the router, and client code follows. Never hand-write an API response type.

Zod schemas exported from a router or schema file are types too: `z.infer<typeof settingsUpdateInput>`.

### 4. Existing source-of-truth types

Grep before writing (see below). Examples: `NotificationTag` (`packages/core/src/types.ts`), `FeedbackCategory` and `FeedbackStatus` (`packages/config/src/content.ts`), `AppThemeId` (`packages/config/src/themes.ts`), `ModuleKey` and `NavItem` (`packages/config/src/modules.ts`), `StorageFolder` (`packages/core/src/storage.ts`), `RateLimitRule` (`packages/api/src/lib/rate-limit.ts`).

### 5. Only then: a new type

Put it in the owning package's `types.ts` (or next to the code that owns it), with a source-of-truth header. Derive from existing types where you can (`Pick`, `Omit`, `ReturnType`, `typeof X[number]`) instead of copying fields.

## Banned patterns

| Banned                                 | Do this instead                                                                                                                                                         |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `any`                                  | Find the real type. Oxlint fails on `no-explicit-any`.                                                                                                                  |
| `as Foo` assertions                    | A type guard, or fix the source type. Allowed: `as const`, and `as never` for Next typed routes on dynamic hrefs. Test files use `{} as never` for unused test doubles. |
| `value!` non-null assertion            | Handle the `null` / `undefined` path. Oxlint fails on `no-non-null-assertion`.                                                                                          |
| `@ts-ignore`, `@ts-expect-error`       | Fix the type. Oxlint fails on `ban-ts-comment`.                                                                                                                         |
| Casting `unknown`                      | Narrow with `typeof`, `instanceof`, `in`, or Zod `safeParse`. See `pickEntityId` in `packages/api/src/lib/audit.ts`.                                                    |
| A hand-written `interface User`        | `AuthUser` from `@starter/auth`, or `$inferSelect`.                                                                                                                     |
| A hand-written API response type       | `RouterOutputs`.                                                                                                                                                        |
| `process.env` in a package             | Receive values as arguments from `apps/web/src/server/services.ts`.                                                                                                     |
| `middleware.ts`                        | `apps/web/src/proxy.ts` (Next 16).                                                                                                                                      |
| Hex colours, `text-white`, `bg-[#...]` | Theme tokens: `bg-background`, `text-foreground`, `bg-primary`, ...                                                                                                     |

The base config (`packages/config/tsconfig.base.json`) turns on `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters` and `verbatimModuleSyntax`. With `noUncheckedIndexedAccess`, `rows[0]` has type `T | undefined`. Handle it:

```ts
const [row] = await db.select().from(schema.post).where(eq(schema.post.id, id)).limit(1);
if (!row) throw new TRPCError({ code: "NOT_FOUND" });
```

## Source-of-truth headers

Every exported, reusable block gets this header:

```ts
/**
 * SOURCE OF TRUTH KEYWORDS: createSettingsService, SettingsService, getIntegrationKeys, settings cache
 * WHAT:  Reads and writes the single app_settings row with a short in-process cache.
 * WHY:   Every reader goes through here so caching and decryption live in one place.
 * WHERE: apps/web/src/server/services.ts; consumed by auth, api routers.
 */
```

- **KEYWORDS:** the symbols the file owns, plus the words someone would search for (6 to 10).
- **WHAT:** one or two sentences on what it is.
- **WHY:** the reason it exists or the non-obvious choice. Skip it when trivial.
- **WHERE:** who uses it.

The header is a search index. It lets the next person (or agent) find the right file in one grep.

## How to find code

Grep first, read second.

```bash
# Who owns a concept?
grep -rn "SOURCE OF TRUTH KEYWORDS" packages apps/web/src | grep -i "rate"

# Where is a symbol defined and used?
grep -rn "consumeRateLimit" packages apps/web/src

# Which procedures exist on a router?
grep -n "Procedure(" packages/api/src/routers/blog.ts

# Which tables exist?
grep -rn "pgTable(" packages/db/src/schema
```

Then open the file, read the header, and follow the WHERE pointers.

The single sources of truth for common concerns are listed in [CLAUDE.md](../../CLAUDE.md) section 2.

## When you cannot find it

Ask before creating a duplicate. Two types for the same thing drift apart the first time someone adds a column.
